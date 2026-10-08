import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Queue } from 'bullmq';
import { type Model, Types } from 'mongoose';
import { CustomerSubscription, type CustomerSubscriptionDocument } from '../crm/schemas/customer-subscription.schema.js';
import { GiftCard, type GiftCardDocument } from '../crm/schemas/gift-card.schema.js';
import { REMINDER_QUEUE } from '../queue/queue.constants.js';

@Injectable()
export class LifecycleScannerService {
  private readonly logger = new Logger(LifecycleScannerService.name);

  constructor(
    @InjectModel(CustomerSubscription.name)
    private readonly subscriptions: Model<CustomerSubscriptionDocument>,
    @InjectModel(GiftCard.name) private readonly giftCards: Model<GiftCardDocument>,
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue,
  ) {}

  /**
   * Scans for upcoming subscription renewals (e.g. within next 3 days)
   * and queues reminder jobs.
   */
  async scanSubscriptionRenewals(): Promise<number> {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const subs = await this.subscriptions
      .find({
        status: 'active',
        nextBillingDate: { $gte: now, $lte: in3Days },
      })
      .limit(500)
      .exec();

    let queued = 0;
    for (const sub of subs) {
      const jobId = `reminder:sub:${sub._id}:${sub.nextBillingDate.toISOString().slice(0, 10)}`;
      await this.reminderQueue.add(
        'subscription_renewal_reminder',
        {
          subscriptionId: String(sub._id),
          tenantId: String(sub.tenantId),
        },
        { jobId, removeOnComplete: true },
      );
      queued++;
    }

    this.logger.log(`Subscription renewal scan complete: queued ${queued} reminders.`);
    return queued;
  }

  /**
   * Scans for gift cards nearing expiration (within 7 days) and
   * marks cards past expiration as 'expired'.
   */
  async scanGiftCardExpirations(): Promise<{ warned: number; expired: number }> {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Mark expired cards
    const expiredRes = await this.giftCards
      .updateMany(
        {
          status: 'active',
          expiresAt: { $lt: now, $ne: null },
        },
        { $set: { status: 'expired' } },
      )
      .exec();

    // 2. Warn cards expiring within 7 days
    const nearingExpiry = await this.giftCards
      .find({
        status: 'active',
        'balance.amount': { $gt: 0 },
        expiresAt: { $gte: now, $lte: in7Days },
        issuedToCustomerId: { $ne: null },
      })
      .limit(500)
      .exec();

    let warned = 0;
    for (const card of nearingExpiry) {
      const expiryStr = card.expiresAt?.toISOString().slice(0, 10) ?? 'soon';
      const jobId = `reminder:gift:${card._id}:${expiryStr}`;
      await this.reminderQueue.add(
        'gift_card_expiry_reminder',
        {
          giftCardId: String(card._id),
          tenantId: String(card.tenantId),
        },
        { jobId, removeOnComplete: true },
      );
      warned++;
    }

    this.logger.log(
      `Gift card scan complete: ${expiredRes.modifiedCount} expired, ${warned} warnings queued.`,
    );
    return { warned, expired: expiredRes.modifiedCount };
  }
}
