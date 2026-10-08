import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { PaymentMethod } from '@salon/shared';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { BkashAdapter } from './bkash.adapter.js';
import { NagadAdapter } from './nagad.adapter.js';
import { PaymentTransaction, type PaymentTransactionDocument } from './payment-transaction.schema.js';
import { SslCommerzAdapter } from './sslcommerz.adapter.js';

export interface ChargeInput {
  amountMinor: number;
  reference: string; // invoice number, passed to the provider
  providerRef?: string; // e.g. a pre-authorized terminal/txn id / paymentID
  tenantId?: string;
  branchId?: string;
  saleId?: string;
  idempotencyKey?: string;
  customer?: { name: string; email?: string; phone: string };
}

export interface ChargeResult {
  status: 'captured' | 'pending' | 'failed';
  providerRef: string | null;
  gatewayTrxId?: string;
  failureReason?: string;
}

export interface RefundInput {
  tenantId: string;
  providerRef: string;
  amountMinor: number;
  trxId?: string;
  reason?: string;
}

export interface PaymentProvider {
  readonly method: PaymentMethod;
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund?(input: RefundInput): Promise<{ success: boolean; refundRef?: string }>;
}

class InstantProvider implements PaymentProvider {
  constructor(
    readonly method: PaymentMethod,
    private readonly refPrefix: string | null,
  ) {}

  charge(input: ChargeInput): Promise<ChargeResult> {
    const providerRef =
      input.providerRef ?? (this.refPrefix ? `${this.refPrefix}_${randomUUID()}` : null);
    return Promise.resolve({ status: 'captured', providerRef });
  }
}

class DeferredProvider implements PaymentProvider {
  constructor(readonly method: PaymentMethod) {}

  charge(input: ChargeInput): Promise<ChargeResult> {
    return Promise.resolve({ status: 'pending', providerRef: input.providerRef ?? null });
  }
}

class BkashPaymentProvider implements PaymentProvider {
  readonly method: PaymentMethod = 'bkash';

  constructor(private readonly adapter: BkashAdapter) {}

  async charge(input: ChargeInput): Promise<ChargeResult> {
    try {
      if (input.providerRef) {
        // Execute already initiated payment
        const res = await this.adapter.executePayment(input.providerRef);
        return {
          status: res.transactionStatus === 'Completed' ? 'captured' : 'failed',
          providerRef: res.paymentID,
          gatewayTrxId: res.trxID,
        };
      }

      // Initiate payment
      const res = await this.adapter.createPayment(
        input.amountMinor,
        input.reference,
        input.customer?.phone,
      );
      return {
        status: 'pending',
        providerRef: res.paymentID,
      };
    } catch (err: unknown) {
      return {
        status: 'failed',
        providerRef: input.providerRef ?? null,
        failureReason: (err as Error).message,
      };
    }
  }

  async refund(input: RefundInput): Promise<{ success: boolean; refundRef?: string }> {
    try {
      const res = await this.adapter.refund(
        input.providerRef,
        input.amountMinor,
        input.trxId || `TRX_${Date.now()}`,
        input.reason,
      );
      return { success: res.statusCode === '0000', refundRef: res.refundTrxID };
    } catch {
      return { success: false };
    }
  }
}

class NagadPaymentProvider implements PaymentProvider {
  readonly method: PaymentMethod = 'nagad';

  constructor(private readonly adapter: NagadAdapter) {}

  async charge(input: ChargeInput): Promise<ChargeResult> {
    try {
      if (input.providerRef) {
        const verifyRes = await this.adapter.verifyPayment(input.providerRef);
        return {
          status: verifyRes.status === 'Success' ? 'captured' : 'failed',
          providerRef: verifyRes.paymentRefId,
          gatewayTrxId: verifyRes.issuerPaymentRefNo || verifyRes.paymentRefId,
        };
      }

      const initRes = await this.adapter.initializePayment(input.reference, input.amountMinor);
      return {
        status: 'pending',
        providerRef: initRes.paymentReferenceId,
      };
    } catch (err: unknown) {
      return {
        status: 'failed',
        providerRef: input.providerRef ?? null,
        failureReason: (err as Error).message,
      };
    }
  }
}

class SslCommerzPaymentProvider implements PaymentProvider {
  readonly method: PaymentMethod = 'sslcommerz';

  constructor(private readonly adapter: SslCommerzAdapter) {}

  async charge(input: ChargeInput): Promise<ChargeResult> {
    try {
      if (input.providerRef) {
        const validRes = await this.adapter.validateTransaction(input.providerRef);
        return {
          status: validRes.status === 'VALID' || validRes.status === 'VALIDATED' ? 'captured' : 'failed',
          providerRef: validRes.val_id,
          gatewayTrxId: validRes.bank_tran_id,
        };
      }

      const sessionRes = await this.adapter.initiateSession(
        input.reference,
        input.amountMinor,
        input.customer || { name: 'Customer', phone: '01700000000' },
      );
      return {
        status: 'pending',
        providerRef: sessionRes.sessionkey ?? null,
      };
    } catch (err: unknown) {
      return {
        status: 'failed',
        providerRef: input.providerRef ?? null,
        failureReason: (err as Error).message,
      };
    }
  }
}

@Injectable()
export class PaymentGateway {
  private readonly logger = new Logger(PaymentGateway.name);
  private readonly providers = new Map<PaymentMethod, PaymentProvider>();

  constructor(
    @Optional() private readonly bkashAdapter?: BkashAdapter,
    @Optional() private readonly nagadAdapter?: NagadAdapter,
    @Optional() private readonly sslCommerzAdapter?: SslCommerzAdapter,
    @Optional()
    @InjectModel(PaymentTransaction.name)
    private readonly transactions?: Model<PaymentTransactionDocument>,
  ) {
    this.providers.set('cash', new InstantProvider('cash', null));
    this.providers.set('card', new InstantProvider('card', 'card'));
    this.providers.set('gift_card', new DeferredProvider('gift_card'));
    this.providers.set('due', new DeferredProvider('due'));

    if (this.bkashAdapter) {
      this.providers.set('bkash', new BkashPaymentProvider(this.bkashAdapter));
    } else {
      this.providers.set('bkash', new InstantProvider('bkash', 'bkash'));
    }

    if (this.nagadAdapter) {
      this.providers.set('nagad', new NagadPaymentProvider(this.nagadAdapter));
    } else {
      this.providers.set('nagad', new InstantProvider('nagad', 'nagad'));
    }

    if (this.sslCommerzAdapter) {
      this.providers.set('sslcommerz', new SslCommerzPaymentProvider(this.sslCommerzAdapter));
    } else {
      this.providers.set('sslcommerz', new InstantProvider('sslcommerz', 'ssl'));
    }
  }

  async charge(method: PaymentMethod, input: ChargeInput): Promise<ChargeResult> {
    const provider = this.providers.get(method);
    if (!provider) {
      return { status: 'failed', providerRef: null, failureReason: `Unknown method: ${method}` };
    }

    const result = await provider.charge(input);

    // Audit transaction state if models are present
    if (this.transactions && input.tenantId && input.branchId) {
      try {
        await this.transactions.create({
          tenantId: new Types.ObjectId(input.tenantId),
          branchId: new Types.ObjectId(input.branchId),
          saleId: input.saleId ? new Types.ObjectId(input.saleId) : undefined,
          method,
          amountMinor: input.amountMinor,
          providerRef: result.providerRef ?? undefined,
          gatewayTrxId: result.gatewayTrxId,
          status: result.status,
          idempotencyKey: input.idempotencyKey,
          failureReason: result.failureReason,
        });
      } catch (err: unknown) {
        this.logger.warn(`Failed to audit payment transaction: ${(err as Error).message}`);
      }
    }

    return result;
  }

  async refund(
    method: PaymentMethod,
    input: RefundInput,
  ): Promise<{ success: boolean; refundRef?: string }> {
    const provider = this.providers.get(method);
    if (!provider || !provider.refund) {
      return { success: false };
    }

    const res = await provider.refund(input);
    if (res.success && this.transactions) {
      await this.transactions.updateOne(
        { tenantId: new Types.ObjectId(input.tenantId), providerRef: input.providerRef },
        {
          $set: {
            status: 'refunded',
            refundedAt: new Date(),
            refundedAmountMinor: input.amountMinor,
          },
        },
      );
    }
    return res;
  }
}
