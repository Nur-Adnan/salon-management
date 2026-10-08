import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomerSubscription,
  type CustomerSubscriptionDocument,
} from '../../crm/schemas/customer-subscription.schema.js';
import {
  SubscriptionPlan,
  type SubscriptionPlanDocument,
} from '../../crm/schemas/subscription-plan.schema.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { PaymentGateway } from './providers.js';

export interface RenewalResult {
  subscriptionId: string;
  success: boolean;
  status: 'active' | 'cancelled';
  error?: string;
}

@Injectable()
export class RecurringBillingService {
  private readonly logger = new Logger(RecurringBillingService.name);

  constructor(
    @InjectModel(CustomerSubscription.name)
    private readonly subscriptions: Model<CustomerSubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name)
    private readonly plans: Model<SubscriptionPlanDocument>,
    private readonly paymentGateway: PaymentGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Processes recurring billing renewal for a specific subscription.
   * Auto-debits using saved provider reference and advances billing period.
   */
  async processRenewal(subscriptionId: string, tenantId: string): Promise<RenewalResult> {
    const sub = await this.subscriptions.findOne({
      _id: new Types.ObjectId(subscriptionId),
      tenantId: new Types.ObjectId(tenantId),
    });

    if (!sub || sub.status === 'cancelled') {
      return {
        subscriptionId,
        success: false,
        status: sub?.status ?? 'cancelled',
        error: 'Subscription not found or already cancelled',
      };
    }

    const plan = await this.plans.findById(sub.planId);
    const planName = plan?.name?.en || 'Subscription';
    const priceMinor = plan?.price?.amount || 0;

    this.logger.log(
      `Attempting renewal charge for subscription ${sub._id} (${planName})`,
    );

    const chargeResult = await this.paymentGateway.charge('bkash', {
      amountMinor: priceMinor,
      reference: `SUB-RENEW-${sub._id}-${Date.now()}`,
      tenantId: sub.tenantId.toHexString(),
      branchId: new Types.ObjectId().toHexString(),
    });

    if (chargeResult.status === 'captured') {
      // Advance billing cycle by plan billing period (default 30 days)
      const periodDays = plan?.billingPeriodDays || 30;
      const nextDate = new Date(sub.nextBillingDate);
      nextDate.setDate(nextDate.getDate() + periodDays);

      await this.subscriptions.updateOne(
        { _id: sub._id },
        {
          $set: {
            currentPeriodStart: sub.nextBillingDate,
            nextBillingDate: nextDate,
          },
        },
      );

      // Send upcoming renewal notice for next period
      await this.notifications.queueNotification({
        tenantId: sub.tenantId,
        channel: 'sms',
        recipient: sub.customerId.toHexString(),
        template: 'subscription_renewal_upcoming',
        data: {
          customerName: 'Customer',
          planName,
          renewalDate: nextDate.toISOString().slice(0, 10),
          amountMinor: priceMinor,
        },
        idempotencyKey: `sub-renew-${sub._id}-${nextDate.getTime()}`,
      });

      return { subscriptionId, success: true, status: 'active' };
    }

    // Payment failed: notify customer
    await this.notifications.queueNotification({
      tenantId: sub.tenantId,
      channel: 'sms',
      recipient: sub.customerId.toHexString(),
      template: 'subscription_renewal_failed',
      data: {
        customerName: 'Customer',
        planName,
        error: chargeResult.failureReason || 'Charge declined',
      },
      idempotencyKey: `sub-failed-${sub._id}-${Date.now()}`,
    });

    return {
      subscriptionId,
      success: false,
      status: 'active',
      error: chargeResult.failureReason || 'Payment declined',
    };
  }
}
