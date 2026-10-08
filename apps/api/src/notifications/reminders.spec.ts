import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { AppointmentCreatedReminderHandler } from './events/appointment-reminders.handler.js';
import { ReminderProcessor } from '../queue/reminder.processor.js';

describe('Appointment Reminders & Processors', () => {
  describe('AppointmentCreatedReminderHandler', () => {
    let handler: AppointmentCreatedReminderHandler;
    let mockAppts: any;
    let mockQueue: any;

    beforeEach(() => {
      mockAppts = { findOne: vi.fn() };
      mockQueue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };
      handler = new AppointmentCreatedReminderHandler(mockAppts, mockQueue);
    });

    it('schedules both 24h and 2h reminders for an appointment 48h in future', async () => {
      const futureStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const apptDoc = {
        _id: new Types.ObjectId(),
        lines: [{ start: futureStart }],
      };
      mockAppts.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(apptDoc),
      });

      await handler.handle({
        tenantId: new Types.ObjectId().toHexString(),
        branchId: new Types.ObjectId().toHexString(),
        appointmentId: apptDoc._id.toHexString(),
      });

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'appointment_reminder',
        expect.objectContaining({ reminderType: '24h' }),
        expect.objectContaining({ jobId: expect.stringContaining(':24h') }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'appointment_reminder',
        expect.objectContaining({ reminderType: '2h' }),
        expect.objectContaining({ jobId: expect.stringContaining(':2h') }),
      );
    });
  });

  describe('ReminderProcessor', () => {
    let processor: ReminderProcessor;
    let mockAppts: any;
    let mockCustomers: any;
    let mockBranches: any;
    let mockSubs: any;
    let mockGifts: any;
    let mockNotificationService: any;

    beforeEach(() => {
      mockAppts = { findOne: vi.fn() };
      mockCustomers = { findOne: vi.fn() };
      mockBranches = { findOne: vi.fn() };
      mockSubs = { findOne: vi.fn() };
      mockGifts = { findOne: vi.fn() };
      mockNotificationService = { queueNotification: vi.fn().mockResolvedValue({}) };

      processor = new ReminderProcessor(
        mockAppts,
        mockCustomers,
        mockBranches,
        mockSubs,
        mockGifts,
        mockNotificationService,
      );
    });

    it('drops reminder if appointment was cancelled', async () => {
      const appt = {
        _id: new Types.ObjectId(),
        status: 'cancelled',
        lines: [{ start: new Date() }],
      };
      mockAppts.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(appt) });

      await processor.process({
        name: 'appointment_reminder',
        data: {
          appointmentId: appt._id.toHexString(),
          tenantId: new Types.ObjectId().toHexString(),
          branchId: new Types.ObjectId().toHexString(),
          reminderType: '24h',
          expectedStart: appt.lines[0].start.toISOString(),
        },
      } as any);

      expect(mockNotificationService.queueNotification).not.toHaveBeenCalled();
    });

    it('drops reminder if appointment was rescheduled (start time mismatch)', async () => {
      const originalTime = new Date('2026-10-15T10:00:00Z');
      const rescheduledTime = new Date('2026-10-16T14:00:00Z');

      const appt = {
        _id: new Types.ObjectId(),
        status: 'booked',
        lines: [{ start: rescheduledTime }],
      };
      mockAppts.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(appt) });

      await processor.process({
        name: 'appointment_reminder',
        data: {
          appointmentId: appt._id.toHexString(),
          tenantId: new Types.ObjectId().toHexString(),
          branchId: new Types.ObjectId().toHexString(),
          reminderType: '24h',
          expectedStart: originalTime.toISOString(),
        },
      } as any);

      expect(mockNotificationService.queueNotification).not.toHaveBeenCalled();
    });

    it('queues notification if appointment is active and time matches', async () => {
      const startTime = new Date('2026-10-15T10:00:00Z');
      const appt = {
        _id: new Types.ObjectId(),
        customerId: new Types.ObjectId(),
        status: 'booked',
        lines: [{ start: startTime }],
      };
      const customer = {
        _id: appt.customerId,
        name: 'Fatima',
        phone: '+8801700000000',
        email: 'fatima@example.com',
      };
      const branch = {
        _id: new Types.ObjectId(),
        name: 'Gulshan 2',
        timezone: 'Asia/Dhaka',
      };

      mockAppts.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(appt) });
      mockCustomers.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(customer) });
      mockBranches.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(branch) });

      await processor.process({
        name: 'appointment_reminder',
        data: {
          appointmentId: appt._id.toHexString(),
          tenantId: new Types.ObjectId().toHexString(),
          branchId: branch._id.toHexString(),
          reminderType: '24h',
          expectedStart: startTime.toISOString(),
        },
      } as any);

      expect(mockNotificationService.queueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'sms',
          recipient: '+8801700000000',
          template: 'appointment_reminder_24h',
          idempotencyKey: `reminder:appt:${appt._id}:24h`,
        }),
      );
    });
  });
});
