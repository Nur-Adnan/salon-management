import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { NotificationsService } from './notifications.service.js';
import { EmailProvider } from './providers/email.provider.js';
import { SmsProvider } from './providers/sms.provider.js';
import { WhatsAppProvider } from './providers/whatsapp.provider.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockLogsModel: any;
  let mockQueue: any;
  let mockCtx: any;
  let mockEmail: any;
  let mockSms: any;
  let mockWa: any;

  beforeEach(() => {
    mockLogsModel = {
      findOne: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      find: vi.fn(),
    };

    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockCtx = {
      get: vi.fn().mockReturnValue({ tenantId: new Types.ObjectId().toHexString() }),
    };

    mockEmail = {
      channel: 'email',
      send: vi.fn().mockResolvedValue({ success: true, externalMessageId: 'email-123' }),
    };

    mockSms = {
      channel: 'sms',
      send: vi.fn().mockResolvedValue({ success: true, externalMessageId: 'sms-456' }),
    };

    mockWa = {
      channel: 'whatsapp',
      send: vi.fn().mockResolvedValue({ success: true, externalMessageId: 'wa-789' }),
    };

    service = new NotificationsService(
      mockLogsModel,
      mockQueue,
      mockCtx,
      mockEmail,
      mockSms,
      mockWa,
    );
  });

  it('queues a new notification and adds a BullMQ job with backoff and idempotency', async () => {
    mockLogsModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    const createdDoc = {
      _id: new Types.ObjectId(),
      tenantId: new Types.ObjectId(),
      channel: 'sms',
      recipient: '+8801712345678',
      status: 'queued',
      idempotencyKey: 'rem:1',
    };
    mockLogsModel.create.mockResolvedValue(createdDoc);

    const res = await service.queueNotification({
      tenantId: createdDoc.tenantId.toHexString(),
      channel: 'sms',
      recipient: '+8801712345678',
      template: 'appointment_reminder_24h',
      data: {
        customerName: 'Amina',
        serviceNames: ['Haircut'],
        startTimeFormatted: 'Tomorrow at 10 AM',
        branchName: 'Gulshan Branch',
      },
      idempotencyKey: 'rem:1',
    });

    expect(res).toBe(createdDoc);
    expect(mockLogsModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'sms',
        recipient: '+8801712345678',
        template: 'appointment_reminder_24h',
        status: 'queued',
        idempotencyKey: 'rem:1',
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send_notification',
      expect.objectContaining({ notificationLogId: String(createdDoc._id) }),
      expect.objectContaining({
        jobId: 'rem:1',
        attempts: 3,
        backoff: expect.objectContaining({ type: 'exponential', delay: 2000 }),
      }),
    );
  });

  it('deduplicates notification if already exists for idempotencyKey', async () => {
    const existingDoc = {
      _id: new Types.ObjectId(),
      status: 'sent',
      idempotencyKey: 'rem:dup',
    };
    mockLogsModel.findOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue(existingDoc),
    });

    const res = await service.queueNotification({
      tenantId: new Types.ObjectId().toHexString(),
      channel: 'sms',
      recipient: '+8801712345678',
      template: 'appointment_reminder_24h',
      data: { customerName: 'Amina', serviceNames: ['Haircut'], startTimeFormatted: '', branchName: '' },
      idempotencyKey: 'rem:dup',
    });

    expect(res).toBe(existingDoc);
    expect(mockLogsModel.create).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('dispatches notification via chosen channel provider and updates status', async () => {
    const logDoc: any = {
      _id: new Types.ObjectId(),
      channel: 'sms',
      recipient: '+8801712345678',
      body: 'Hello Amina',
      subject: null,
      status: 'queued',
      attempts: 0,
      metadata: {},
      save: vi.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };

    mockLogsModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(logDoc),
    });

    const updated = await service.dispatch(String(logDoc._id));

    expect(mockSms.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '+8801712345678',
        body: 'Hello Amina',
      }),
    );
    expect(updated.status).toBe('sent');
    expect(updated.attempts).toBe(1);
    expect(logDoc.save).toHaveBeenCalled();
  });

  it('marks log as failed if provider returns failure', async () => {
    mockSms.send.mockResolvedValue({ success: false, error: 'Network timeout to SMS gateway' });

    const logDoc: any = {
      _id: new Types.ObjectId(),
      channel: 'sms',
      recipient: '+8801712345678',
      body: 'Hello',
      status: 'queued',
      attempts: 0,
      metadata: {},
      save: vi.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };

    mockLogsModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(logDoc),
    });

    await expect(service.dispatch(String(logDoc._id))).rejects.toThrow('Network timeout to SMS gateway');
    expect(logDoc.status).toBe('failed');
    expect(logDoc.error).toBe('Network timeout to SMS gateway');
  });
});
