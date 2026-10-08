import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.js';

export interface BkashCreateResponse {
  paymentID: string;
  createTime: string;
  orgLogo: string;
  orgName: string;
  transactionStatus: string;
  amount: string;
  currency: string;
  intent: string;
  bkashURL: string;
  statusCode: string;
  statusMessage: string;
}

export interface BkashExecuteResponse {
  paymentID: string;
  trxID: string;
  transactionStatus: string;
  amount: string;
  currency: string;
  intent: string;
  paymentExecuteTime: string;
  merchantInvoiceNumber: string;
  statusCode: string;
  statusMessage: string;
}

export interface BkashRefundResponse {
  refundTrxID: string;
  transactionStatus: string;
  amount: string;
  currency: string;
  statusCode: string;
  statusMessage: string;
}

@Injectable()
export class BkashAdapter {
  private readonly logger = new Logger(BkashAdapter.name);
  private token: string | null = null;
  private tokenExpiry = 0;
  private readonly env: Env;

  constructor(@Optional() @Inject(ConfigService) configOrEnv?: ConfigService<Env, true> | Partial<Env>) {
    if (configOrEnv && typeof (configOrEnv as Record<string, unknown>).get === 'function') {
      const cfg = configOrEnv as ConfigService<Env, true>;
      this.env = {
        BKASH_APP_KEY: cfg.get('BKASH_APP_KEY', { infer: true }) ?? '',
        BKASH_APP_SECRET: cfg.get('BKASH_APP_SECRET', { infer: true }) ?? '',
        BKASH_USERNAME: cfg.get('BKASH_USERNAME', { infer: true }) ?? '',
        BKASH_PASSWORD: cfg.get('BKASH_PASSWORD', { infer: true }) ?? '',
        BKASH_WEBHOOK_SECRET: cfg.get('BKASH_WEBHOOK_SECRET', { infer: true }) ?? '',
        BKASH_IS_SANDBOX: cfg.get('BKASH_IS_SANDBOX', { infer: true }) ?? true,
        WEB_ORIGINS: cfg.get('WEB_ORIGINS', { infer: true }) ?? 'http://localhost:3000',
      } as Env;
    } else {
      this.env = {
        WEB_ORIGINS: 'http://localhost:3000',
        BKASH_IS_SANDBOX: true,
        BKASH_APP_KEY: '',
        BKASH_APP_SECRET: '',
        BKASH_USERNAME: '',
        BKASH_PASSWORD: '',
        BKASH_WEBHOOK_SECRET: '',
        ...((configOrEnv as Partial<Env>) ?? {}),
      } as Env;
    }
  }

  private get baseUrl(): string {
    return this.env.BKASH_IS_SANDBOX
      ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout'
      : 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout';
  }

  isConfigured(): boolean {
    return Boolean(this.env.BKASH_APP_KEY && this.env.BKASH_APP_SECRET);
  }

  async getAuthToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    if (!this.isConfigured()) {
      this.logger.debug('bKash credentials not set; using simulated sandbox token');
      this.token = `mock_bkash_token_${randomUUID()}`;
      this.tokenExpiry = Date.now() + 3600 * 1000;
      return this.token;
    }

    try {
      const res = await fetch(`${this.baseUrl}/token/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          username: this.env.BKASH_USERNAME,
          password: this.env.BKASH_PASSWORD,
        },
        body: JSON.stringify({
          app_key: this.env.BKASH_APP_KEY,
          app_secret: this.env.BKASH_APP_SECRET,
        }),
      });

      const data = (await res.json()) as { id_token?: string; expiresIn?: number; statusMessage?: string };
      if (!res.ok || !data.id_token) {
        throw new Error(data.statusMessage || `Failed to grant bKash token: ${res.statusText}`);
      }

      this.token = data.id_token;
      this.tokenExpiry = Date.now() + (data.expiresIn ? data.expiresIn * 1000 : 3500 * 1000);
      return this.token;
    } catch (err: unknown) {
      this.logger.error(`bKash token grant error: ${(err as Error).message}`);
      throw err;
    }
  }

  async createPayment(
    amountMinor: number,
    merchantInvoiceNumber: string,
    payerReference?: string,
  ): Promise<BkashCreateResponse> {
    const amount = (amountMinor / 100).toFixed(2);

    if (!this.isConfigured()) {
      const mockId = `bkash_pay_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      return {
        paymentID: mockId,
        createTime: new Date().toISOString(),
        orgLogo: '',
        orgName: 'Salon Demo',
        transactionStatus: 'Initiated',
        amount,
        currency: 'BDT',
        intent: 'sale',
        bkashURL: `https://sandbox.bka.sh/checkout?paymentID=${mockId}`,
        statusCode: '0000',
        statusMessage: 'Successful',
      };
    }

    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-APP-Key': this.env.BKASH_APP_KEY,
      },
      body: JSON.stringify({
        mode: '0011',
        payerReference: payerReference || 'CUSTOMER',
        callbackURL: `${this.env.WEB_ORIGINS.split(',')[0]}/payment/bkash/callback`,
        amount,
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber,
      }),
    });

    const data = (await res.json()) as BkashCreateResponse;
    if (data.statusCode !== '0000') {
      throw new Error(`bKash create payment failed: ${data.statusMessage} (${data.statusCode})`);
    }
    return data;
  }

  async executePayment(paymentID: string): Promise<BkashExecuteResponse> {
    if (!this.isConfigured()) {
      const mockTrxId = `TRX${Date.now()}`;
      return {
        paymentID,
        trxID: mockTrxId,
        transactionStatus: 'Completed',
        amount: '0.00',
        currency: 'BDT',
        intent: 'sale',
        paymentExecuteTime: new Date().toISOString(),
        merchantInvoiceNumber: `INV-${Date.now()}`,
        statusCode: '0000',
        statusMessage: 'Successful',
      };
    }

    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-APP-Key': this.env.BKASH_APP_KEY,
      },
      body: JSON.stringify({ paymentID }),
    });

    const data = (await res.json()) as BkashExecuteResponse;
    if (data.statusCode !== '0000' || data.transactionStatus !== 'Completed') {
      throw new Error(`bKash execute failed: ${data.statusMessage} (${data.statusCode})`);
    }
    return data;
  }

  async queryPayment(paymentID: string): Promise<BkashExecuteResponse> {
    if (!this.isConfigured()) {
      return {
        paymentID,
        trxID: `TRX_QRY_${Date.now()}`,
        transactionStatus: 'Completed',
        amount: '0.00',
        currency: 'BDT',
        intent: 'sale',
        paymentExecuteTime: new Date().toISOString(),
        merchantInvoiceNumber: 'INV_QRY',
        statusCode: '0000',
        statusMessage: 'Successful',
      };
    }

    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl}/payment/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-APP-Key': this.env.BKASH_APP_KEY,
      },
      body: JSON.stringify({ paymentID }),
    });

    return (await res.json()) as BkashExecuteResponse;
  }

  async refund(
    paymentID: string,
    amountMinor: number,
    trxID: string,
    reason = 'Customer refund',
  ): Promise<BkashRefundResponse> {
    const amount = (amountMinor / 100).toFixed(2);
    if (!this.isConfigured()) {
      return {
        refundTrxID: `REF_${Date.now()}`,
        transactionStatus: 'Completed',
        amount,
        currency: 'BDT',
        statusCode: '0000',
        statusMessage: 'Successful',
      };
    }

    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl}/payment/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'X-APP-Key': this.env.BKASH_APP_KEY,
      },
      body: JSON.stringify({
        paymentID,
        amount,
        trxID,
        sku: 'SERVICE',
        reason,
      }),
    });

    const data = (await res.json()) as BkashRefundResponse;
    if (data.statusCode !== '0000') {
      throw new Error(`bKash refund failed: ${data.statusMessage}`);
    }
    return data;
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.isConfigured() || !this.env.BKASH_WEBHOOK_SECRET) {
      // In sandbox mode with no secret configured, accept signature verification
      return true;
    }
    const computed = createHmac('sha256', this.env.BKASH_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return computed === signature;
  }
}
