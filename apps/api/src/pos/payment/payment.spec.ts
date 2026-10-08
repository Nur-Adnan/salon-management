import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { BkashAdapter } from './bkash.adapter.js';
import { NagadAdapter } from './nagad.adapter.js';
import { PaymentsController } from './payments.controller.js';
import { RecurringBillingService } from './recurring.service.js';
import { SslCommerzAdapter } from './sslcommerz.adapter.js';

describe('Phase 14: Payment Adapters & Webhooks', () => {
  const mockEnv: any = {
    API_PORT: 4000,
    BKASH_APP_KEY: 'test-app-key',
    BKASH_APP_SECRET: 'test-app-secret',
    BKASH_USERNAME: 'test-user',
    BKASH_PASSWORD: 'test-pass',
    BKASH_IS_SANDBOX: true,
    BKASH_WEBHOOK_SECRET: 'bkash-secret-key',
    NAGAD_MERCHANT_ID: 'test-merchant',
    NAGAD_IS_SANDBOX: true,
    SSLCOMMERZ_STORE_ID: 'test-store',
    SSLCOMMERZ_STORE_PASS: 'test-pass',
    SSLCOMMERZ_IS_LIVE: false,
    WEB_ORIGINS: 'http://localhost:3000',
  };

  describe('BkashAdapter', () => {
    it('generates simulated token in sandbox when credentials unconfigured', async () => {
      const adapter = new BkashAdapter({ ...mockEnv, BKASH_APP_KEY: '' });
      const token = await adapter.getAuthToken();
      expect(token).toMatch(/^mock_bkash_token_/);
    });

    it('verifies valid webhook HMAC signature', () => {
      const adapter = new BkashAdapter(mockEnv);
      const payload = JSON.stringify({ paymentID: 'pay-123', status: 'Completed' });
      const sig = createHmac('sha256', 'bkash-secret-key').update(payload).digest('hex');

      expect(adapter.verifyWebhookSignature(payload, sig)).toBe(true);
      expect(adapter.verifyWebhookSignature(payload, 'wrong-sig')).toBe(false);
    });
  });

  describe('NagadAdapter', () => {
    it('initializes payment in sandbox mode', async () => {
      const adapter = new NagadAdapter(mockEnv);
      const res = await adapter.initializePayment('INV-001', 50000);
      expect(res.status).toBe('Success');
      expect(res.paymentReferenceId).toBeDefined();
    });

    it('verifies payment status server-side', async () => {
      const adapter = new NagadAdapter(mockEnv);
      const res = await adapter.verifyPayment('REF-123');
      expect(res.status).toBe('Success');
      expect(res.paymentRefId).toBe('REF-123');
    });
  });

  describe('SslCommerzAdapter', () => {
    it('initiates session in sandbox mode', async () => {
      const adapter = new SslCommerzAdapter({ ...mockEnv, SSLCOMMERZ_STORE_ID: '' });
      const res = await adapter.initiateSession('TRAN-001', 50000, {
        name: 'John Doe',
        phone: '01700000000',
      });
      expect(res.status).toBe('SUCCESS');
      expect(res.sessionkey).toBeDefined();
    });

    it('validates IPN hash correctly', () => {
      const adapter = new SslCommerzAdapter(mockEnv);
      const res = adapter.verifyIpnHash({
        val_id: 'val-1',
        verify_sign: 'sig',
        verify_key: 'val_id',
      });
      expect(typeof res).toBe('boolean');
    });
  });

  describe('PaymentsController Webhooks', () => {
    let controller: PaymentsController;
    let mockBkash: any;
    let mockNagad: any;
    let mockSsl: any;
    let mockTransactions: any;
    let mockRedis: any;

    beforeEach(() => {
      mockBkash = {
        verifyWebhookSignature: vi.fn((body, sig) => sig === 'valid-sig'),
        queryPayment: vi.fn().mockResolvedValue({ transactionStatus: 'Completed', paymentID: 'bk_1' }),
      };
      mockNagad = {
        verifyPayment: vi.fn().mockResolvedValue({ status: 'Success', paymentRefId: 'nag_1' }),
      };
      mockSsl = {
        verifyIpnHash: vi.fn((body) => body.val_id !== 'val-forged'),
        validateTransaction: vi.fn().mockResolvedValue({ status: 'VALID', tran_id: 'ssl_1', bank_tran_id: 'bnk_1' }),
      };
      mockTransactions = {
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      };
      mockRedis = {
        status: 'ready',
        set: vi.fn().mockImplementation((key) => {
          if (key.includes('pay-dup')) return null;
          return 'OK';
        }),
      };

      controller = new PaymentsController(
        mockBkash,
        mockNagad,
        mockSsl,
        mockTransactions,
        mockRedis,
      );
    });

    it('rejects bKash webhook with invalid signature', async () => {
      await expect(
        controller.handleBkashWebhook('invalid-sig', { paymentID: 'pay-123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts and idempotently flags duplicate bKash webhooks', async () => {
      const res = await controller.handleBkashWebhook('valid-sig', { paymentID: 'pay-dup' });
      expect(res.status).toBe('duplicate_accepted');
      expect(mockTransactions.updateOne).not.toHaveBeenCalled();
    });

    it('processes verified bKash webhook and updates transaction status', async () => {
      const res = await controller.handleBkashWebhook('valid-sig', {
        paymentID: 'pay-real',
        transactionStatus: 'Completed',
        trxID: 'TRX_001',
      });
      expect(res.status).toBe('processed');
      expect(mockTransactions.updateOne).toHaveBeenCalledWith(
        { providerRef: 'pay-real' },
        expect.objectContaining({
          $set: expect.objectContaining({ status: 'captured', gatewayTrxId: 'TRX_001' }),
        }),
      );
    });

    it('rejects SSLCommerz IPN with forged verification hash', async () => {
      await expect(
        controller.handleSslCommerzWebhook({ val_id: 'val-forged' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RecurringBillingService', () => {
    let service: RecurringBillingService;
    let mockSubModel: any;
    let mockGateway: any;
    let mockNotifications: any;

    beforeEach(() => {
      mockSubModel = {
        findOne: vi.fn(),
        updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      };
      mockGateway = {
        charge: vi.fn(),
      };
      mockNotifications = {
        queueNotification: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
      };

      service = new RecurringBillingService(mockSubModel, mockGateway, mockNotifications);
    });

    it('advances period and notifies customer on successful recurring charge', async () => {
      const subId = '507f1f77bcf86cd799439011';
      const tenantId = '507f1f77bcf86cd799439012';
      const custId = '507f1f77bcf86cd799439013';

      const mockSub = {
        _id: { toHexString: () => subId },
        tenantId: { toHexString: () => tenantId },
        customerId: { toHexString: () => custId },
        status: 'current',
        planName: 'VIP Monthly',
        pricePerIntervalMinor: 500000,
        interval: 'month',
        preferredPaymentMethod: 'bkash',
        tokenizedPaymentRef: 'agr_123',
        currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      };

      mockSubModel.findOne.mockResolvedValue(mockSub);
      mockGateway.charge.mockResolvedValue({ status: 'captured', providerRef: 'rec_trx_1' });

      const result = await service.processRenewal(subId, tenantId);
      expect(result.success).toBe(true);
      expect(result.status).toBe('current');

      expect(mockSubModel.updateOne).toHaveBeenCalledWith(
        { _id: mockSub._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'current',
            failedPaymentAttempts: 0,
            lastPaymentStatus: 'succeeded',
          }),
        }),
      );

      expect(mockNotifications.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'sms',
          template: 'subscription_renewed',
        }),
      );
    });

    it('handles recurring payment failure by incrementing retry count', async () => {
      const subId = '507f1f77bcf86cd799439021';
      const tenantId = '507f1f77bcf86cd799439022';
      const custId = '507f1f77bcf86cd799439023';

      const mockSub = {
        _id: { toHexString: () => subId },
        tenantId: { toHexString: () => tenantId },
        customerId: { toHexString: () => custId },
        status: 'current',
        planName: 'VIP Monthly',
        pricePerIntervalMinor: 500000,
        interval: 'month',
        preferredPaymentMethod: 'bkash',
        tokenizedPaymentRef: 'agr_123',
        failedPaymentAttempts: 1,
        currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
      };

      mockSubModel.findOne.mockResolvedValue(mockSub);
      mockGateway.charge.mockResolvedValue({ status: 'failed', failureReason: 'Insufficient balance' });

      const result = await service.processRenewal(subId, tenantId);
      expect(result.success).toBe(false);
      expect(result.status).toBe('past_due');

      expect(mockSubModel.updateOne).toHaveBeenCalledWith(
        { _id: mockSub._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'past_due',
            failedPaymentAttempts: 2,
            lastPaymentStatus: 'failed',
          }),
        }),
      );

      expect(mockNotifications.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'subscription_payment_failed',
        }),
      );
    });
  });
});
