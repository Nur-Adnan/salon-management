import { Injectable, Logger } from '@nestjs/common';
import { createSign, createVerify, publicEncrypt, randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.js';

export interface NagadInitResponse {
  paymentReferenceId: string;
  callBackUrl: string;
  status: string;
  message?: string;
}

export interface NagadVerifyResponse {
  merchantId: string;
  orderId: string;
  paymentRefId: string;
  amount: string;
  clientMobileNo?: string;
  merchantMobileNo?: string;
  orderDateTime?: string;
  issuerPaymentDateTime?: string;
  issuerPaymentRefNo?: string;
  status: 'Success' | 'Failed' | 'Aborted';
  statusCode: string;
}

@Injectable()
export class NagadAdapter {
  private readonly logger = new Logger(NagadAdapter.name);

  constructor(private readonly env: Env) {}

  private get baseUrl(): string {
    return this.env.NAGAD_IS_SANDBOX
      ? 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs'
      : 'https://api.mynagad.com/api/dfs';
  }

  isConfigured(): boolean {
    return Boolean(
      this.env.NAGAD_MERCHANT_ID &&
      this.env.NAGAD_PUBLIC_KEY &&
      this.env.NAGAD_PRIVATE_KEY,
    );
  }

  sign(data: string): string {
    if (!this.isConfigured()) return `simulated_sig_${randomUUID()}`;
    const signer = createSign('SHA256');
    signer.update(data);
    signer.end();
    return signer.sign(this.env.NAGAD_PRIVATE_KEY, 'base64');
  }

  verifySignature(data: string, signature: string): boolean {
    if (!this.isConfigured()) return true;
    try {
      const verifier = createVerify('SHA256');
      verifier.update(data);
      verifier.end();
      return verifier.verify(this.env.NAGAD_PUBLIC_KEY, signature, 'base64');
    } catch {
      return false;
    }
  }

  async initializePayment(
    orderId: string,
    amountMinor: number,
  ): Promise<NagadInitResponse> {
    const _amount = (amountMinor / 100).toFixed(2);

    if (!this.isConfigured()) {
      const paymentReferenceId = `NAGAD_REF_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      return {
        paymentReferenceId,
        callBackUrl: `http://sandbox.mynagad.com:10080/check-out/${paymentReferenceId}`,
        status: 'Success',
      };
    }

    const dateTime = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const sensitiveData = {
      merchantId: this.env.NAGAD_MERCHANT_ID,
      datetime: dateTime,
      orderId,
      challenge: randomUUID(),
    };

    const encryptedData = publicEncrypt(
      this.env.NAGAD_PUBLIC_KEY,
      Buffer.from(JSON.stringify(sensitiveData)),
    ).toString('base64');

    const signature = this.sign(JSON.stringify(sensitiveData));

    const res = await fetch(`${this.baseUrl}/check-out/initialize/${this.env.NAGAD_MERCHANT_ID}/${orderId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': '127.0.0.1',
        'X-KM-Client-Type': 'PC_WEB',
      },
      body: JSON.stringify({
        dateTime,
        sensitiveData: encryptedData,
        signature,
      }),
    });

    const data = (await res.json()) as NagadInitResponse;
    if (data.status !== 'Success') {
      throw new Error(`Nagad payment init failed: ${data.message || data.status}`);
    }
    return data;
  }

  async verifyPayment(paymentRefId: string): Promise<NagadVerifyResponse> {
    if (!this.isConfigured()) {
      return {
        merchantId: 'MOCK_NAGAD_MERCHANT',
        orderId: `ORD_${Date.now()}`,
        paymentRefId,
        amount: '0.00',
        status: 'Success',
        statusCode: '000',
      };
    }

    const res = await fetch(`${this.baseUrl}/verify/payment/${paymentRefId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
      },
    });

    const data = (await res.json()) as NagadVerifyResponse;
    if (data.status !== 'Success') {
      throw new Error(`Nagad payment verification failed with status: ${data.status}`);
    }
    return data;
  }
}
