import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Optional,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Redis } from 'ioredis';
import { Model } from 'mongoose';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard.js';
import { Public } from '../../iam/auth/public.decorator.js';
import { REDIS } from '../../infra/redis/redis.module.js';
import { BkashAdapter } from './bkash.adapter.js';
import { NagadAdapter } from './nagad.adapter.js';
import { PaymentTransaction, type PaymentTransactionDocument } from './payment-transaction.schema.js';
import { SslCommerzAdapter } from './sslcommerz.adapter.js';

@UseGuards(RateLimitGuard)
@RateLimit({ points: 120, durationSeconds: 60, keyPrefix: 'payments' })
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly bkash: BkashAdapter,
    private readonly nagad: NagadAdapter,
    private readonly sslcommerz: SslCommerzAdapter,
    @Optional()
    @InjectModel(PaymentTransaction.name)
    private readonly transactions?: Model<PaymentTransactionDocument>,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}

  private async isDuplicateWebhook(key: string): Promise<boolean> {
    if (!this.redis || this.redis.status !== 'ready') return false;
    const res = await this.redis.set(`webhook:processed:${key}`, '1', 'EX', 86400, 'NX');
    return res === null;
  }

  @Public()
  @Post('webhooks/bkash')
  @HttpCode(HttpStatus.OK)
  async handleBkashWebhook(
    @Headers('x-signature') signature: string,
    @Body() body: Record<string, unknown>,
  ): Promise<{ status: string }> {
    const rawBody = JSON.stringify(body);
    if (signature && !this.bkash.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('bKash webhook signature mismatch');
      throw new BadRequestException('Invalid signature');
    }

    const paymentID = (body.paymentID as string) || (body.paymentId as string);
    if (!paymentID) {
      return { status: 'ignored' };
    }

    if (await this.isDuplicateWebhook(`bkash:${paymentID}`)) {
      this.logger.debug(`Duplicate bKash webhook for ${paymentID}, returning 200`);
      return { status: 'duplicate_accepted' };
    }

    this.logger.log(`Processing bKash webhook for paymentID: ${paymentID}`);
    if (this.transactions) {
      await this.transactions.updateOne(
        { providerRef: paymentID },
        {
          $set: {
            status: body.transactionStatus === 'Completed' ? 'captured' : 'failed',
            gatewayTrxId: body.trxID as string | undefined,
            webhookReceivedAt: new Date(),
          },
        },
      );
    }

    return { status: 'processed' };
  }

  @Public()
  @Post('webhooks/nagad')
  @HttpCode(HttpStatus.OK)
  async handleNagadWebhook(@Body() body: Record<string, string>): Promise<{ status: string }> {
    const paymentRefId = body.payment_ref_id || body.paymentRefId;
    if (!paymentRefId) {
      return { status: 'ignored' };
    }

    if (await this.isDuplicateWebhook(`nagad:${paymentRefId}`)) {
      return { status: 'duplicate_accepted' };
    }

    // Server-side verification (never trust webhook body alone)
    const verification = await this.nagad.verifyPayment(paymentRefId);

    if (this.transactions) {
      await this.transactions.updateOne(
        { providerRef: paymentRefId },
        {
          $set: {
            status: verification.status === 'Success' ? 'captured' : 'failed',
            gatewayTrxId: verification.issuerPaymentRefNo || paymentRefId,
            webhookReceivedAt: new Date(),
          },
        },
      );
    }

    return { status: 'processed' };
  }

  @Public()
  @Post('webhooks/sslcommerz')
  @HttpCode(HttpStatus.OK)
  async handleSslCommerzWebhook(@Body() body: Record<string, string>): Promise<{ status: string }> {
    const valId = body.val_id;
    if (!valId) {
      return { status: 'ignored' };
    }

    if (!this.sslcommerz.verifyIpnHash(body)) {
      this.logger.warn(`SSLCommerz IPN hash verification failed for val_id: ${valId}`);
      throw new BadRequestException('Invalid IPN hash');
    }

    if (await this.isDuplicateWebhook(`ssl:${valId}`)) {
      return { status: 'duplicate_accepted' };
    }

    // Call SSLCommerz validation API server-to-server
    const validation = await this.sslcommerz.validateTransaction(valId);

    if (this.transactions) {
      await this.transactions.updateOne(
        { providerRef: validation.tran_id },
        {
          $set: {
            status:
              validation.status === 'VALID' || validation.status === 'VALIDATED'
                ? 'captured'
                : 'failed',
            gatewayTrxId: validation.bank_tran_id,
            webhookReceivedAt: new Date(),
          },
        },
      );
    }

    return { status: 'processed' };
  }

  @Public()
  @Get('verify/:provider/:id')
  async verifyStatus(
    @Param('provider') provider: string,
    @Param('id') id: string,
  ): Promise<{ status: string; providerRef: string; rawStatus?: string }> {
    if (provider === 'bkash') {
      const res = await this.bkash.queryPayment(id);
      return {
        status: res.transactionStatus === 'Completed' ? 'captured' : 'pending',
        providerRef: res.paymentID,
        rawStatus: res.transactionStatus,
      };
    }

    if (provider === 'nagad') {
      const res = await this.nagad.verifyPayment(id);
      return {
        status: res.status === 'Success' ? 'captured' : 'failed',
        providerRef: res.paymentRefId,
        rawStatus: res.status,
      };
    }

    if (provider === 'sslcommerz') {
      const res = await this.sslcommerz.validateTransaction(id);
      return {
        status: res.status === 'VALID' || res.status === 'VALIDATED' ? 'captured' : 'failed',
        providerRef: res.val_id,
        rawStatus: res.status,
      };
    }

    throw new BadRequestException(`Unknown payment provider: ${provider}`);
  }
}
