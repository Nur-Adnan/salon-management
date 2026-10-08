import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomerSubscription,
  type CustomerSubscriptionDocument,
} from '../../crm/schemas/customer-subscription.schema.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { PaymentGateway } from './providers.js';

export interface RenewalResult {
  subscriptionId: string;
  success: boolean;
  status: 'current' | 'past_due' | 'cancelled';
  error?: string;
}

@Injectable()
export class RecurringBillingService {
  private readonly logger = new Logger(RecurringBillingService.name);

  constructor(
    @InjectModel(CustomerSubscription.name)
    private readonly subscriptions: Model<CustomerSubscriptionDocument>,
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

    if (!sub || (sub as any).status === 'cancelled') {
      return {
        subscriptionId,
        success: false,
        status: (sub as any)?.status ?? 'cancelled',
        error: 'Subscription not found or already cancelled',
      };
    }

    const planName = (sub as any).planName || 'VIP Monthly';
    const priceMinor = (sub as any).pricePerIntervalMinor || 0;
    const paymentMethod = (sub as any).preferredPaymentMethod || 'bkash';
    const tokenizedRef = (sub as any).tokenizedPaymentRef;

    const subIdHex =
      typeof sub._id === 'object' && 'toHexString' in sub._id
        ? (sub._id as Types.ObjectId).toHexString()
        : String(sub._id);
    const tenantIdHex =
      typeof sub.tenantId === 'object' && 'toHexString' in sub.tenantId
        ? (sub.tenantId as Types.ObjectId).toHexString()
        : String(sub.tenantId);
    const custIdHex =
      (sub as any).customerId && typeof (sub as any).customerId === 'object' && 'toHexString' in (sub as any).customerId
        ? (sub as any).customerId.toHexString()
        : String((sub as any).customerId || 'customer');

    this.logger.log(
      `Attempting renewal charge for subscription ${subIdHex} (${planName}) via ${paymentMethod}`,
    );

    const chargeResult = await this.paymentGateway.charge(paymentMethod as any, {
      amountMinor: priceMinor,
      reference: `SUB-RENEW-${subIdHex}-${Date.now()}`,
      providerRef: tokenizedRef,
      tenantId: tenantIdHex,
      branchId: new Types.ObjectId().toHexString(),
    });

    if (chargeResult.status === 'captured') {
      const periodEnd = (sub as any).currentPeriodEnd
        ? new Date((sub as any).currentPeriodEnd)
        : new Date();
      const newPeriodEnd = new Date(periodEnd);
      if ((sub as any).interval === 'year') {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }

      await this.subscriptions.updateOne(
        { _id: sub._id },
        {
          $set: {
            status: 'current',
            currentPeriodStart: periodEnd,
            currentPeriodEnd: newPeriodEnd,
            failedPaymentAttempts: 0,
            lastPaymentStatus: 'succeeded',
            lastRenewedAt: new Date(),
          },
        },
      );

      await this.notifications.queueNotification({
        tenantId: sub.tenantId,
        channel: 'sms',
        recipient: custIdHex,
        template: 'subscription_renewed',
        data: {
          customerName: 'Customer',
          planName,
          amountFormatted: `৳${(priceMinor / 100).toLocaleString()}`,
          renewalDateFormatted: newPeriodEnd.toISOString().slice(0, 10),
        },
        idempotencyKey: `sub-renew-${subIdHex}-${newPeriodEnd.getTime()}`,
      });

      return { subscriptionId, success: true, status: 'current' };
    }

    // Payment failed: increment retry count
    const currentAttempts = ((sub as any).failedPaymentAttempts || 0) + 1;
    const maxAttempts = 3;

    if (currentAttempts < maxAttempts) {
      await this.subscriptions.updateOne(
        { _id: sub._id },
        {
          $set: {
            status: 'past_due',
            failedPaymentAttempts: currentAttempts,
            lastPaymentStatus: 'failed',
            lastFailedAt: new Date(),
          },
        },
      );

      await this.notifications.queueNotification({
        tenantId: sub.tenantId,
        channel: 'sms',
        recipient: custIdHex,
        template: 'subscription_payment_failed',
        data: {
          customerName: 'Customer',
          planName,
          attempt: currentAttempts,
        },
        idempotencyKey: `sub-failed-${subIdHex}-${Date.now()}`,
      });

      return {
        subscriptionId,
        success: false,
        status: 'past_due',
        error: chargeResult.failureReason || 'Payment declined',
      };
    }

    // Max attempts exceeded: cancel subscription
    await this.subscriptions.updateOne(
      { _id: sub._id },
      {
        $set: {
          status: 'cancelled',
          failedPaymentAttempts: currentAttempts,
          lastPaymentStatus: 'failed',
          cancelledAt: new Date(),
          cancellationReason: 'Payment retry limit exceeded',
        },
      },
    );

    await this.notifications.queueNotification({
      tenantId: sub.tenantId,
      channel: 'sms',
      recipient: custIdHex,
      template: 'subscription_cancelled_payment_failure',
      data: {
        customerName: 'Customer',
        planName,
      },
      idempotencyKey: `sub-cancel-${subIdHex}-${Date.now()}`,
    });

    return {
      subscriptionId,
      success: false,
      status: 'cancelled',
      error: 'Exceeded maximum payment attempts. Subscription cancelled.',
    };
  }
}
