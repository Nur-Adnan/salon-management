import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Env } from '../../config/env.js';

export interface SslSessionResponse {
  status: 'SUCCESS' | 'FAILED';
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  redirectGatewayURL?: string;
}

export interface SslValidationResponse {
  status: 'VALID' | 'VALIDATED' | 'FAILED' | 'INVALID_TRANSACTION';
  tran_date: string;
  tran_id: string;
  val_id: string;
  amount: string;
  store_amount: string;
  currency: string;
  bank_tran_id: string;
  card_type: string;
  card_no: string;
  card_issuer: string;
  card_brand: string;
  card_sub_brand?: string;
  card_issuer_country?: string;
  error?: string;
}

@Injectable()
export class SslCommerzAdapter {
  private readonly logger = new Logger(SslCommerzAdapter.name);

  constructor(private readonly env: Env) {}

  private get baseUrl(): string {
    return this.env.SSLCOMMERZ_IS_LIVE
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
  }

  isConfigured(): boolean {
    return Boolean(this.env.SSLCOMMERZ_STORE_ID && this.env.SSLCOMMERZ_STORE_PASS);
  }

  async initiateSession(
    tranId: string,
    amountMinor: number,
    customer: { name: string; email?: string; phone: string; address?: string },
  ): Promise<SslSessionResponse> {
    const totalAmount = (amountMinor / 100).toFixed(2);
    const callbackBase =
      (this.env.WEB_ORIGINS || 'http://localhost:3000').split(',')[0]?.trim() || 'http://localhost:3000';

    if (!this.isConfigured()) {
      const mockSession = `SSL_SESSION_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      return {
        status: 'SUCCESS',
        sessionkey: mockSession,
        GatewayPageURL: `https://sandbox.sslcommerz.com/EasyCheckOut/testcde${mockSession}`,
        redirectGatewayURL: `https://sandbox.sslcommerz.com/EasyCheckOut/testcde${mockSession}`,
      };
    }

    const payload = new URLSearchParams({
      store_id: this.env.SSLCOMMERZ_STORE_ID,
      store_passwd: this.env.SSLCOMMERZ_STORE_PASS,
      total_amount: totalAmount,
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${callbackBase}/payment/sslcommerz/success`,
      fail_url: `${callbackBase}/payment/sslcommerz/fail`,
      cancel_url: `${callbackBase}/payment/sslcommerz/cancel`,
      ipn_url: `${callbackBase}/api/payments/webhooks/sslcommerz`,
      cus_name: customer.name || 'Valued Customer',
      cus_email: customer.email || 'customer@example.com',
      cus_add1: customer.address || 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: customer.phone,
      shipping_method: 'NO',
      product_name: 'Salon Service',
      product_category: 'Service',
      product_profile: 'general',
    });

    const res = await fetch(`${this.baseUrl}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    });

    const data = (await res.json()) as SslSessionResponse;
    if (data.status !== 'SUCCESS') {
      throw new Error(`SSLCommerz session init failed: ${data.failedreason || data.status}`);
    }
    return data;
  }

  async validateTransaction(valId: string): Promise<SslValidationResponse> {
    if (!this.isConfigured()) {
      return {
        status: 'VALID',
        tran_date: new Date().toISOString(),
        tran_id: `TRAN_${Date.now()}`,
        val_id: valId,
        amount: '0.00',
        store_amount: '0.00',
        currency: 'BDT',
        bank_tran_id: `BANK_${Date.now()}`,
        card_type: 'VISA',
        card_no: '411111XXXXXX1111',
        card_issuer: 'Bank',
        card_brand: 'VISA',
      };
    }

    const url = new URL(`${this.baseUrl}/validator/api/validationserverAPI.php`);
    url.searchParams.set('val_id', valId);
    url.searchParams.set('store_id', this.env.SSLCOMMERZ_STORE_ID);
    url.searchParams.set('store_passwd', this.env.SSLCOMMERZ_STORE_PASS);
    url.searchParams.set('v', '1');
    url.searchParams.set('format', 'json');

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = (await res.json()) as SslValidationResponse;

    if (data.status !== 'VALID' && data.status !== 'VALIDATED') {
      throw new Error(`SSLCommerz validation failed: ${data.error || data.status}`);
    }
    return data;
  }

  verifyIpnHash(payload: Record<string, string>): boolean {
    if (!this.isConfigured()) return true;
    if (!payload.verify_sign || !payload.verify_key) return false;

    // SSLCommerz creates MD5 signature of sorted verify_key attributes + md5(store_passwd)
    try {
      const keys = payload.verify_key.split(',');
      const parts: string[] = [];
      for (const k of keys) {
        if (payload[k]) {
          parts.push(`${k}=${payload[k]}`);
        }
      }
      const passHash = createHash('md5').update(this.env.SSLCOMMERZ_STORE_PASS).digest('hex');
      parts.push(`store_passwd=${passHash}`);
      const rawString = parts.join('&');
      const hash = createHash('md5').update(rawString).digest('hex');
      return hash === payload.verify_sign;
    } catch {
      return false;
    }
  }
}
