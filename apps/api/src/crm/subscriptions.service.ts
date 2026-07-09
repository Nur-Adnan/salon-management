import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  CreateSubscriptionPlan,
  PaymentInputDto,
  SubscriptionBillingState,
  UpdateSubscriptionPlan,
} from '@salon/shared';
import { subscriptionBillingState } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { CustomerRepository } from '../customers/customer.repository.js';
import { SalesService } from '../pos/sales.service.js';
import type { SaleDocument } from '../pos/schemas/sale.schema.js';
import {
  CustomerSubscription,
  type CustomerSubscriptionDocument,
} from './schemas/customer-subscription.schema.js';
import { SubscriptionPlan, type SubscriptionPlanDocument } from './schemas/subscription-plan.schema.js';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(SubscriptionPlan.name) private readonly plans: Model<SubscriptionPlanDocument>,
    @InjectModel(CustomerSubscription.name)
    private readonly subscriptions: Model<CustomerSubscriptionDocument>,
    private readonly sales: SalesService,
    private readonly customers: CustomerRepository,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  // ---- plans ----

  listPlans(): Promise<SubscriptionPlanDocument[]> {
    return this.plans.find({ tenantId: this.tenantId(), deletedAt: null }).exec();
  }

  createPlan(dto: CreateSubscriptionPlan): Promise<SubscriptionPlanDocument> {
    return this.plans.create({ ...dto, tenantId: this.tenantId() } as never);
  }

  async updatePlan(id: string, dto: UpdateSubscriptionPlan): Promise<SubscriptionPlanDocument> {
    const p = await this.plans
      .findOneAndUpdate({ _id: new Types.ObjectId(id), tenantId: this.tenantId(), deletedAt: null }, dto, {
        new: true,
      })
      .exec();
    if (!p) throw new NotFoundException('subscription plan not found');
    return p;
  }

  // ---- customer subscriptions ----

  async subscribe(customerId: string, planId: string): Promise<CustomerSubscriptionDocument> {
    const tenantId = this.tenantId();
    const plan = await this.plans.findOne({ _id: new Types.ObjectId(planId), tenantId, deletedAt: null }).exec();
    if (!plan || !plan.active) throw new BadRequestException('unknown or inactive subscription plan');
    if (!(await this.customers.findById(customerId))) throw new BadRequestException('unknown customer');

    const now = new Date();
    const nextBillingDate = new Date(now.getTime() + plan.billingPeriodDays * 86_400_000);
    return this.subscriptions.create({
      tenantId,
      customerId: new Types.ObjectId(customerId),
      planId: plan._id,
      status: 'active',
      currentPeriodStart: now,
      nextBillingDate,
    } as never);
  }

  async listForCustomer(
    customerId: string,
  ): Promise<Array<{ doc: CustomerSubscriptionDocument; billingState: SubscriptionBillingState }>> {
    const subs = await this.subscriptions
      .find({ tenantId: this.tenantId(), customerId: new Types.ObjectId(customerId) })
      .sort({ createdAt: -1 })
      .exec();
    const now = new Date();
    return subs.map((doc) => ({
      doc,
      billingState: doc.status === 'active' ? subscriptionBillingState(doc.nextBillingDate, now) : 'current',
    }));
  }

  async cancel(id: string): Promise<CustomerSubscriptionDocument> {
    const s = await this.subscriptions
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId: this.tenantId() },
        { $set: { status: 'cancelled' } },
        { new: true },
      )
      .exec();
    if (!s) throw new NotFoundException('subscription not found');
    return s;
  }

  // Manual renew ONLY — see docs/phase-5.md. Reuses the exact same idempotent
  // checkout path Phase 4 proved (unique-index + transaction), so there is no
  // new payment-capture code for subscriptions at all. The period advances
  // whether or not the sale is fully paid — an unpaid renewal simply shows up
  // in the customer's due balance, same as any other under-paid sale.
  async renew(
    id: string,
    payments: PaymentInputDto[],
    idempotencyKey: string | null,
  ): Promise<{ subscription: CustomerSubscriptionDocument; sale: SaleDocument }> {
    const tenantId = this.tenantId();
    const sub = await this.subscriptions.findOne({ _id: new Types.ObjectId(id), tenantId }).exec();
    if (!sub) throw new NotFoundException('subscription not found');
    if (sub.status !== 'active') throw new BadRequestException('cannot renew a cancelled subscription');

    const { sale, wasReplayed } = await this.sales.checkout(
      {
        customerId: String(sub.customerId),
        lines: [{ kind: 'subscription', refId: String(sub.planId), quantity: 1, discount: 0 }],
        tip: 0,
        payments,
      },
      idempotencyKey,
      { allowSubscriptionLines: true },
    );

    // A replayed checkout (same idempotency key, or a concurrent double-submit
    // that lost checkout's own race) must NOT advance the billing period a
    // second time for one payment — checkout() itself is the single source of
    // truth for "did this request actually create a new sale".
    if (!wasReplayed) {
      const days = await this.planBillingDays(sub.planId, tenantId);
      // Advance atomically, GUARDED on nextBillingDate being unchanged since we
      // read it: two concurrent renews carrying DISTINCT idempotency keys would
      // otherwise each read the same period and last-write-wins the advance (a
      // lost update). Only the first advance matches the guard; a later one
      // no-ops rather than clobbering the already-advanced period.
      const advanced = await this.subscriptions
        .findOneAndUpdate(
          { _id: sub._id, tenantId, nextBillingDate: sub.nextBillingDate },
          {
            $set: {
              currentPeriodStart: sub.nextBillingDate,
              nextBillingDate: new Date(sub.nextBillingDate.getTime() + days * 86_400_000),
            },
          },
          { new: true },
        )
        .exec();
      // advanced === null means a concurrent renew already advanced this period;
      // return the current persisted state rather than our stale in-memory doc.
      const subscription = advanced ?? (await this.subscriptions.findOne({ _id: sub._id, tenantId }).exec()) ?? sub;
      return { subscription, sale };
    }
    return { subscription: sub, sale };
  }

  private async planBillingDays(planId: Types.ObjectId, tenantId: Types.ObjectId): Promise<number> {
    const plan = await this.plans.findOne({ _id: planId, tenantId }).exec();
    return plan?.billingPeriodDays ?? 30;
  }
}
