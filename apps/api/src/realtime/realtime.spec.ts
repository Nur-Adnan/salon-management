import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeAppointmentCreatedHandler } from './handlers/calendar-events.handler.js';
import { RealtimeSaleCompletedHandler } from './handlers/pos-events.handler.js';
import { RealtimeWaitlistAddedHandler } from './handlers/queue-events.handler.js';

describe('Phase 12 Real-Time Data Sync', () => {
  let gateway: RealtimeGateway;
  let mockMemberships: any;
  let mockUsers: any;
  let mockConfig: any;
  let mockServer: any;

  beforeEach(() => {
    mockMemberships = { findOne: vi.fn() };
    mockUsers = { findOne: vi.fn() };
    mockConfig = { get: vi.fn().mockReturnValue('test-secret') };

    mockServer = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    gateway = new RealtimeGateway(mockMemberships, mockUsers, mockConfig);
    gateway.server = mockServer;
  });

  describe('RealtimeGateway connection and authorization', () => {
    it('disconnects unauthenticated client missing a token', async () => {
      const mockClient: any = {
        id: 'sock-1',
        handshake: { auth: {}, headers: {}, query: {} },
        disconnect: vi.fn(),
      };

      await gateway.handleConnection(mockClient);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('allows client with valid membership to join their tenant room', async () => {
      const tenantId = new Types.ObjectId();
      const branchId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      mockMemberships.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          tenantId,
          userId,
          branchId,
          status: 'active',
        }),
      });

      const mockClient: any = {
        id: 'sock-auth',
        data: { userId: userId.toHexString() },
        join: vi.fn(),
      };

      const res = await gateway.handleJoinRoom(mockClient, {
        tenantId: tenantId.toHexString(),
        branchId: branchId.toHexString(),
        channel: 'calendar',
      });

      expect(res.status).toBe('ok');
      expect(mockClient.join).toHaveBeenCalledWith(
        `tenant:${tenantId}:branch:${branchId}:calendar`,
      );
    });

    it('rejects cross-tenant room join attempt (tenant isolation)', async () => {
      const _tenantId = new Types.ObjectId();
      const otherTenantId = new Types.ObjectId();
      const branchId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      // User belongs to tenantId, but tries to join otherTenantId
      mockMemberships.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null), // No membership in otherTenantId
      });

      const mockClient: any = {
        id: 'sock-malicious',
        data: { userId: userId.toHexString() },
        join: vi.fn(),
      };

      const res = await gateway.handleJoinRoom(mockClient, {
        tenantId: otherTenantId.toHexString(),
        branchId: branchId.toHexString(),
        channel: 'calendar',
      });

      expect(res.status).toBe('forbidden');
      expect(mockClient.join).not.toHaveBeenCalled();
    });
  });

  describe('Scoped Broadcasts', () => {
    it('broadcasts calendar events strictly to isolated tenant+branch room', () => {
      const tenantId = 't-1';
      const branchId = 'b-1';

      gateway.broadcastCalendarEvent(tenantId, branchId, 'calendar.appointment_created', {
        appointmentId: 'appt-1',
      });

      expect(mockServer.to).toHaveBeenCalledWith('tenant:t-1:branch:b-1:calendar');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'calendar.appointment_created',
        expect.objectContaining({
          version: 1,
          event: 'calendar.appointment_created',
          tenantId: 't-1',
          branchId: 'b-1',
          data: { appointmentId: 'appt-1' },
        }),
      );
    });
  });

  describe('Realtime Event Handlers', () => {
    it('handles AppointmentCreated by broadcasting to branch calendar room', async () => {
      const mockAppts = {
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(),
            customerId: new Types.ObjectId(),
            status: 'booked',
            source: 'online',
            lines: [{ start: new Date() }],
            depositAmount: { amount: 0, currency: 'BDT' },
          }),
        }),
      };

      const handler = new RealtimeAppointmentCreatedHandler(mockAppts as any, gateway);
      const spy = vi.spyOn(gateway, 'broadcastCalendarEvent');

      const tenantId = new Types.ObjectId().toHexString();
      const branchId = new Types.ObjectId().toHexString();
      const appointmentId = new Types.ObjectId().toHexString();

      await handler.handle({
        tenantId,
        branchId,
        appointmentId,
      });

      expect(spy).toHaveBeenCalledWith(
        tenantId,
        branchId,
        'calendar.appointment_created',
        expect.objectContaining({ appointmentId, status: 'booked' }),
      );
    });

    it('handles SaleCompleted by broadcasting to branch POS room', async () => {
      const tenantId = new Types.ObjectId().toHexString();
      const branchId = new Types.ObjectId().toHexString();
      const saleId = new Types.ObjectId().toHexString();

      const mockSales = {
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(saleId),
            invoiceNumber: 'INV-001',
            total: { amount: 15000, currency: 'BDT' },
            status: 'completed',
            lines: [{}],
          }),
        }),
      };

      const handler = new RealtimeSaleCompletedHandler(mockSales as any, gateway);
      const spy = vi.spyOn(gateway, 'broadcastPosEvent');

      await handler.handle({
        tenantId,
        branchId,
        saleId,
      });

      expect(spy).toHaveBeenCalledWith(
        tenantId,
        branchId,
        'pos.sale_completed',
        expect.objectContaining({ saleId, invoiceNumber: 'INV-001' }),
      );
    });

    it('handles WaitlistAdded by broadcasting to branch queue room', async () => {
      const tenantId = new Types.ObjectId().toHexString();
      const branchId = new Types.ObjectId().toHexString();
      const entryId = new Types.ObjectId().toHexString();

      const mockWaitlist = {
        findOne: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(entryId),
            customerId: new Types.ObjectId(),
            status: 'waiting',
            createdAt: new Date(),
          }),
        }),
      };

      const handler = new RealtimeWaitlistAddedHandler(mockWaitlist as any, gateway);
      const spy = vi.spyOn(gateway, 'broadcastQueueEvent');

      await handler.handle({
        tenantId,
        branchId,
        entryId,
      });

      expect(spy).toHaveBeenCalledWith(
        tenantId,
        branchId,
        'queue.entry_added',
        expect.objectContaining({ entryId, status: 'waiting' }),
      );
    });
  });
});
