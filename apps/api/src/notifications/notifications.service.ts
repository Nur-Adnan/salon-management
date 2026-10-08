import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  type NotificationChannel,
  type NotificationTemplate,
  renderNotificationTemplate,
} from '@salon/shared';
import type { Queue } from 'bullmq';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { NOTIFICATION_QUEUE } from '../queue/queue.constants.js';
import { EmailProvider } from './providers/email.provider.js';
import type { INotificationProvider } from './providers/notification-provider.interface.js';
import { SmsProvider } from './providers/sms.provider.js';
import { WhatsAppProvider } from './providers/whatsapp.provider.js';
import {
  NotificationLog,
  type NotificationLogDocument,
} from './schemas/notification-log.schema.js';

export interface QueueNotificationDto {
  tenantId: string | Types.ObjectId;
  branchId?: string | Types.ObjectId | null;
  channel: NotificationChannel;
  recipient: string;
  template: NotificationTemplate;
  data: Record<string, any>;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly providers: Map<NotificationChannel, INotificationProvider>;

  constructor(
    @InjectModel(NotificationLog.name)
    private readonly logs: Model<NotificationLogDocument>,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    private readonly ctx: RequestContextService,
    emailProvider: EmailProvider,
    smsProvider: SmsProvider,
    whatsappProvider: WhatsAppProvider,
  ) {
    this.providers = new Map<NotificationChannel, INotificationProvider>([
      ['email', emailProvider],
      ['sms', smsProvider],
      ['whatsapp', whatsappProvider],
    ]);
  }

  private scopeTenant(): Types.ObjectId {
    const c = this.ctx.get();
    if (!c?.tenantId) throw new ForbiddenException('tenant context required');
    return new Types.ObjectId(c.tenantId);
  }

  async queueNotification(dto: QueueNotificationDto): Promise<NotificationLogDocument> {
    const tenantId = new Types.ObjectId(dto.tenantId);
    const branchId = dto.branchId ? new Types.ObjectId(dto.branchId) : null;

    // Check existing log for idempotency
    const existing = await this.logs
      .findOne({ tenantId, idempotencyKey: dto.idempotencyKey })
      .exec();

    if (existing) {
      this.logger.debug(
        `Notification already queued/sent for key ${dto.idempotencyKey}, skipping duplicate.`,
      );
      return existing;
    }

    const { subject, body } = renderNotificationTemplate(
      dto.template,
      dto.channel,
      dto.data,
    );

    const log = await this.logs.create({
      tenantId,
      branchId,
      channel: dto.channel,
      recipient: dto.recipient,
      subject: subject ?? null,
      body,
      template: dto.template,
      status: 'queued',
      attempts: 0,
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata ?? {},
    });

    try {
      await this.notificationQueue.add(
        'send_notification',
        { notificationLogId: String(log._id), tenantId: String(tenantId) },
        {
          jobId: dto.idempotencyKey,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue notification job for ${log._id}: ${err.message}`,
        err.stack,
      );
    }

    return log;
  }

  async dispatch(logId: string): Promise<NotificationLogDocument> {
    const log = await this.logs.findById(logId).exec();
    if (!log) throw new NotFoundException(`NotificationLog ${logId} not found`);

    if (log.status === 'sent' || log.status === 'delivered') {
      return log;
    }

    const provider = this.providers.get(log.channel);
    if (!provider) {
      log.status = 'failed';
      log.error = `No provider available for channel: ${log.channel}`;
      await log.save();
      throw new BadRequestException(log.error);
    }

    log.attempts += 1;
    try {
      const result = await provider.send({
        recipient: log.recipient,
        subject: log.subject ?? undefined,
        body: log.body,
        metadata: log.metadata,
      });

      if (result.success) {
        log.status = 'sent';
        log.error = null;
        if (result.externalMessageId) {
          log.metadata = { ...log.metadata, externalMessageId: result.externalMessageId };
        }
      } else {
        log.status = 'failed';
        log.error = result.error ?? 'Unknown provider failure';
        throw new Error(log.error);
      }
    } catch (err: any) {
      log.status = 'failed';
      log.error = err.message;
      await log.save();
      throw err;
    }

    return log.save();
  }

  async list(filter: {
    channel?: NotificationChannel;
    status?: string;
    recipient?: string;
    limit?: number;
  }): Promise<NotificationLogDocument[]> {
    const tenantId = this.scopeTenant();
    const q: Record<string, unknown> = { tenantId };
    if (filter.channel) q.channel = filter.channel;
    if (filter.status) q.status = filter.status;
    if (filter.recipient) q.recipient = { $regex: filter.recipient, $options: 'i' };

    return this.logs
      .find(q)
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 100)
      .exec();
  }

  async resend(id: string): Promise<NotificationLogDocument> {
    const tenantId = this.scopeTenant();
    const log = await this.logs.findOne({ _id: new Types.ObjectId(id), tenantId }).exec();
    if (!log) throw new NotFoundException('Notification log not found');

    log.status = 'queued';
    log.error = null;
    await log.save();

    await this.notificationQueue.add(
      'send_notification',
      { notificationLogId: String(log._id), tenantId: String(tenantId) },
      {
        jobId: `resend-${log._id}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    return log;
  }
}
