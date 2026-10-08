import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { formatMoney } from '@salon/shared';
import type { Job } from 'bullmq';
import { DateTime } from 'luxon';
import { type Model, Types } from 'mongoose';
import { CustomerSubscription, type CustomerSubscriptionDocument } from '../crm/schemas/customer-subscription.schema.js';
import { GiftCard, type GiftCardDocument } from '../crm/schemas/gift-card.schema.js';
import { Customer, type CustomerDocument } from '../customers/customer.schema.js';
import { Branch, type BranchDocument } from '../iam/schemas/branch.schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Appointment, type AppointmentDocument } from '../scheduling/schemas/appointment.schema.js';
import { REMINDER_QUEUE } from './queue.constants.js';

export interface AppointmentReminderJobData {
  appointmentId: string;
  tenantId: string;
  branchId: string;
  reminderType: '24h' | '2h';
  expectedStart: string;
}

export interface SubscriptionRenewalJobData {
  subscriptionId: string;
  tenantId: string;
}

export interface GiftCardExpiryJobData {
  giftCardId: string;
  tenantId: string;
}

@Injectable()
@Processor(REMINDER_QUEUE, {
  concurrency: 5,
})
export class ReminderProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(CustomerSubscription.name)
    private readonly subscriptions: Model<CustomerSubscriptionDocument>,
    @InjectModel(GiftCard.name) private readonly giftCards: Model<GiftCardDocument>,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.on('error', (err) => {
      this.logger.warn(`Reminder worker redis error: ${err.message}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Reminder job ${job?.id} (${job?.name}) failed: ${err.message}`,
        err.stack,
      );
    });
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'appointment_reminder':
        await this.processAppointmentReminder(job.data as AppointmentReminderJobData);
        break;
      case 'subscription_renewal_reminder':
        await this.processSubscriptionRenewalReminder(job.data as SubscriptionRenewalJobData);
        break;
      case 'gift_card_expiry_reminder':
        await this.processGiftCardExpiryReminder(job.data as GiftCardExpiryJobData);
        break;
      default:
        this.logger.warn(`Unknown reminder job name: ${job.name}`);
    }
  }

  private async processAppointmentReminder(data: AppointmentReminderJobData): Promise<void> {
    const { appointmentId, tenantId, branchId, reminderType, expectedStart } = data;
    const appt = await this.appts
      .findOne({
        _id: new Types.ObjectId(appointmentId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
      .exec();

    if (!appt) {
      this.logger.debug(`Appointment ${appointmentId} not found or deleted, skipping reminder.`);
      return;
    }

    if (appt.status !== 'booked' && appt.status !== 'confirmed') {
      this.logger.debug(
        `Appointment ${appointmentId} status is ${appt.status} (not booked/confirmed), skipping reminder.`,
      );
      return;
    }

    const firstLine = appt.lines[0];
    if (!firstLine) {
      return;
    }

    // Reschedule check: if start time has changed from what this job was scheduled for,
    // this reminder is stale. A new reminder was or will be scheduled for the new time.
    if (firstLine.start.toISOString() !== expectedStart) {
      this.logger.debug(
        `Appointment ${appointmentId} was rescheduled (${firstLine.start.toISOString()} vs expected ${expectedStart}), dropping stale reminder.`,
      );
      return;
    }

    const customer = await this.customers
      .findOne({ _id: appt.customerId, tenantId: new Types.ObjectId(tenantId) })
      .exec();

    if (!customer) {
      this.logger.warn(`Customer ${appt.customerId} not found for appointment reminder.`);
      return;
    }

    const branch = await this.branches
      .findOne({ _id: new Types.ObjectId(branchId), tenantId: new Types.ObjectId(tenantId) })
      .exec();

    const tz = branch?.timezone ?? 'Asia/Dhaka';
    const startTimeFormatted = DateTime.fromJSDate(firstLine.start)
      .setZone(tz)
      .toFormat('ccc, d LLL yyyy @ h:mm a');

    const channel = customer.phone ? 'sms' : 'email';
    const recipient = customer.phone || customer.email;
    if (!recipient) {
      this.logger.warn(`No contact method available for customer ${customer._id}`);
      return;
    }

    const template =
      reminderType === '24h'
        ? 'appointment_reminder_24h'
        : 'appointment_reminder_2h';

    await this.notificationsService.queueNotification({
      tenantId,
      branchId,
      channel,
      recipient,
      template,
      data: {
        customerName: customer.name,
        serviceNames: ['Salon Service'],
        startTimeFormatted,
        branchName: branch?.name ?? 'Our Salon',
        address: branch?.address ?? undefined,
      },
      idempotencyKey: `reminder:appt:${appointmentId}:${reminderType}`,
      metadata: {
        appointmentId,
        customerId: String(customer._id),
        reminderType,
      },
    });
  }

  private async processSubscriptionRenewalReminder(data: SubscriptionRenewalJobData): Promise<void> {
    const { subscriptionId, tenantId } = data;
    const sub = await this.subscriptions
      .findOne({ _id: new Types.ObjectId(subscriptionId), tenantId: new Types.ObjectId(tenantId) })
      .exec();

    if (!sub || sub.status !== 'active') return;

    const customer = await this.customers
      .findOne({ _id: sub.customerId, tenantId: new Types.ObjectId(tenantId) })
      .exec();
    if (!customer) return;

    const recipient = customer.email || customer.phone;
    if (!recipient) return;
    const channel = customer.email ? 'email' : 'sms';

    const renewalDateFormatted = DateTime.fromJSDate(sub.nextBillingDate).toFormat('d LLL yyyy');

    await this.notificationsService.queueNotification({
      tenantId,
      channel,
      recipient,
      template: 'subscription_renewal_upcoming',
      data: {
        customerName: customer.name,
        planName: 'Membership Plan',
        renewalDateFormatted,
        amountFormatted: '৳—',
      },
      idempotencyKey: `reminder:sub:${subscriptionId}:${renewalDateFormatted}`,
      metadata: {
        subscriptionId,
        customerId: String(customer._id),
      },
    });
  }

  private async processGiftCardExpiryReminder(data: GiftCardExpiryJobData): Promise<void> {
    const { giftCardId, tenantId } = data;
    const card = await this.giftCards
      .findOne({ _id: new Types.ObjectId(giftCardId), tenantId: new Types.ObjectId(tenantId) })
      .exec();

    if (!card || card.status !== 'active' || card.balance.amount <= 0 || !card.expiresAt) return;
    if (!card.issuedToCustomerId) return;

    const customer = await this.customers
      .findOne({ _id: card.issuedToCustomerId, tenantId: new Types.ObjectId(tenantId) })
      .exec();
    if (!customer) return;

    const recipient = customer.phone || customer.email;
    if (!recipient) return;
    const channel = customer.phone ? 'sms' : 'email';

    const expiryDateFormatted = DateTime.fromJSDate(card.expiresAt).toFormat('d LLL yyyy');

    await this.notificationsService.queueNotification({
      tenantId,
      channel,
      recipient,
      template: 'gift_card_expiry_warning',
      data: {
        customerName: customer.name,
        code: card.code,
        balanceFormatted: formatMoney({ amount: card.balance.amount, currency: 'BDT' }),
        expiryDateFormatted,
      },
      idempotencyKey: `reminder:gift:${giftCardId}:${expiryDateFormatted}`,
      metadata: {
        giftCardId,
        customerId: String(customer._id),
      },
    });
  }
}
