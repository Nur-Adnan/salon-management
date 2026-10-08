import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { ClientPortalService } from './client-portal.service.js';

describe('Phase 13 Client Portal Service', () => {
  let service: ClientPortalService;
  let mockConn: any;
  let mockCustomers: any;
  let mockOrgs: any;
  let mockAppts: any;
  let mockReservations: any;
  let mockLoyalty: any;
  let mockLoyaltyLedger: any;
  let mockSubs: any;
  let mockGiftCards: any;
  let mockRedis: any;
  let mockNotifications: any;
  let mockConfig: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockConn = {
      startSession: vi.fn().mockResolvedValue({
        withTransaction: vi.fn().mockImplementation((fn) => fn()),
        endSession: vi.fn(),
      }),
    };

    mockCustomers = {
      findOne: vi.fn(),
      create: vi.fn(),
      findOneAndUpdate: vi.fn(),
    };

    mockOrgs = {
      findOne: vi.fn(),
    };

    mockAppts = {
      find: vi.fn(),
      findOne: vi.fn(),
      updateOne: vi.fn(),
    };

    mockReservations = {
      deleteMany: vi.fn(),
    };

    mockLoyalty = { findOne: vi.fn() };
    mockLoyaltyLedger = { find: vi.fn() };
    mockSubs = { countDocuments: vi.fn(), find: vi.fn() };
    mockGiftCards = { find: vi.fn() };

    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue('123456'),
      del: vi.fn().mockResolvedValue(1),
    };

    mockNotifications = {
      queueNotification: vi.fn().mockResolvedValue({}),
    };

    mockConfig = {
      get: vi.fn().mockImplementation((key) => {
        if (key === 'SUPABASE_JWT_SECRET') return 'test-client-secret';
        if (key === 'NODE_ENV') return 'development';
        return null;
      }),
    };

    mockEventBus = { publish: vi.fn() };

    service = new ClientPortalService(
      mockConn,
      mockCustomers,
      mockOrgs,
      mockAppts,
      mockReservations,
      mockLoyalty,
      mockLoyaltyLedger,
      mockSubs,
      mockGiftCards,
      mockRedis,
      mockNotifications,
      mockConfig,
      mockEventBus,
    );
  });

  describe('OTP Authentication', () => {
    it('requests OTP and stores code in Redis', async () => {
      const orgId = new Types.ObjectId();
      mockOrgs.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: orgId, name: 'Luxe Salon', slug: 'luxe' }),
      });

      const res = await service.requestOtp('luxe', '01712345678');
      expect(res.success).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining(`otp:${orgId}:+8801712345678`),
        expect.any(String),
        'EX',
        300,
      );
      expect(mockNotifications.queueNotification).toHaveBeenCalled();
    });

    it('verifies valid OTP and returns JWT client token', async () => {
      const orgId = new Types.ObjectId();
      const custId = new Types.ObjectId();

      mockOrgs.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: orgId, slug: 'luxe' }),
      });

      mockCustomers.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: custId,
          tenantId: orgId,
          phone: '+8801712345678',
          name: 'Existing Customer',
        }),
      });

      const res = await service.verifyOtp('luxe', '01712345678', '123456');
      expect(res.token).toBeDefined();
      expect(res.customer.id).toBe(custId.toHexString());
      expect(res.customer.name).toBe('Existing Customer');
    });

    it('rejects invalid OTP with UnauthorizedException', async () => {
      const orgId = new Types.ObjectId();
      mockOrgs.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: orgId, slug: 'luxe' }),
      });
      mockRedis.get.mockResolvedValue('999999');

      mockConfig.get.mockReturnValue('production'); // in prod, fallback code is disabled

      await expect(service.verifyOtp('luxe', '01712345678', '000000')).rejects.toThrow(
        'Invalid or expired verification code',
      );
    });
  });

  describe('Appointment Management & IDOR Protection', () => {
    it('prevents IDOR: throws NotFound if appointment belongs to different customer', async () => {
      const tenantId = new Types.ObjectId();
      const myCustId = new Types.ObjectId();
      const targetApptId = new Types.ObjectId();

      // Appt belongs to another customer
      mockAppts.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.cancelAppointment(
          tenantId.toHexString(),
          myCustId.toHexString(),
          targetApptId.toHexString(),
        ),
      ).rejects.toThrow('Appointment not found');
    });

    it('enforces cancellation window: rejects cancellation within 2 hours of start time', async () => {
      const tenantId = new Types.ObjectId();
      const custId = new Types.ObjectId();
      const apptId = new Types.ObjectId();

      // Starts in 45 minutes
      const soonStart = new Date(Date.now() + 45 * 60 * 1000);
      const appt = {
        _id: apptId,
        tenantId,
        customerId: custId,
        status: 'booked',
        lines: [{ start: soonStart }],
      };

      mockAppts.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(appt),
      });

      await expect(
        service.cancelAppointment(tenantId.toHexString(), custId.toHexString(), apptId.toHexString()),
      ).rejects.toThrow('within 2 hours');
    });

    it('allows cancellation outside cutoff window and frees slot reservations', async () => {
      const tenantId = new Types.ObjectId();
      const branchId = new Types.ObjectId();
      const custId = new Types.ObjectId();
      const apptId = new Types.ObjectId();

      // Starts in 24 hours
      const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const appt = {
        _id: apptId,
        tenantId,
        branchId,
        customerId: custId,
        status: 'booked',
        lines: [{ start: futureStart }],
      };

      mockAppts.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(appt),
      });

      const res = await service.cancelAppointment(
        tenantId.toHexString(),
        custId.toHexString(),
        apptId.toHexString(),
      );

      expect(res.success).toBe(true);
      expect(mockAppts.updateOne).toHaveBeenCalledWith(
        { _id: apptId, tenantId },
        { $set: { status: 'cancelled' } },
        expect.any(Object),
      );
      expect(mockReservations.deleteMany).toHaveBeenCalledWith(
        { tenantId, appointmentId: apptId },
        expect.any(Object),
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });
});
