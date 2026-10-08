import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  matchesSegmentFilter,
  type CustomerMarketingMetrics,
  type CustomerSegmentFilter,
} from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { CustomerSubscription, type CustomerSubscriptionDocument } from '../crm/schemas/customer-subscription.schema.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from '../crm/schemas/loyalty-account.schema.js';
import { Customer, type CustomerDocument } from '../customers/customer.schema.js';
import { Sale, type SaleDocument } from '../pos/schemas/sale.schema.js';
import { Appointment, type AppointmentDocument } from '../scheduling/schemas/appointment.schema.js';

@Injectable()
export class SegmentationService {
  private readonly logger = new Logger(SegmentationService.name);

  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    @InjectModel(Appointment.name) private readonly appointments: Model<AppointmentDocument>,
    @InjectModel(CustomerSubscription.name)
    private readonly subscriptions: Model<CustomerSubscriptionDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyAccounts: Model<LoyaltyAccountDocument>,
  ) {}

  async resolveAudience(
    tenantId: Types.ObjectId,
    filter: CustomerSegmentFilter,
  ): Promise<CustomerDocument[]> {
    const customerQuery: Record<string, unknown> = { tenantId, deletedAt: null };
    if (filter.excludeOptedOut !== false) {
      customerQuery.marketingOptOut = { $ne: true };
    }
    const allCustomers = await this.customers.find(customerQuery).exec();
    if (!allCustomers.length) return [];

    const customerIds = allCustomers.map((c) => c._id);

    // 1. Aggregate Sales per customer (total spend in minor units, visit count)
    const salesAgg = await this.sales.aggregate([
      {
        $match: {
          tenantId,
          customerId: { $in: customerIds },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$customerId',
          totalSpendMinor: { $sum: '$grandTotal.amount' },
          visitCount: { $sum: 1 },
        },
      },
    ]);
    const salesMap = new Map<string, { totalSpendMinor: number; visitCount: number }>();
    for (const s of salesAgg) {
      salesMap.set(String(s._id), {
        totalSpendMinor: s.totalSpendMinor ?? 0,
        visitCount: s.visitCount ?? 0,
      });
    }

    // 2. Aggregate Last Visit (completed appointment)
    const apptsAgg = await this.appointments.aggregate([
      {
        $match: {
          tenantId,
          customerId: { $in: customerIds },
          status: 'completed',
          deletedAt: null,
        },
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$customerId',
          lastVisitAt: { $max: '$lines.start' },
        },
      },
    ]);
    const apptMap = new Map<string, Date>();
    for (const a of apptsAgg) {
      if (a.lastVisitAt) {
        apptMap.set(String(a._id), new Date(a.lastVisitAt));
      }
    }

    // 3. Active Subscriptions
    const activeSubs = await this.subscriptions
      .find({
        tenantId,
        customerId: { $in: customerIds },
        status: 'active',
      })
      .select('customerId')
      .exec();
    const subSet = new Set<string>(activeSubs.map((s) => String(s.customerId)));

    // 4. Loyalty Accounts
    const loyaltyList = await this.loyaltyAccounts
      .find({
        tenantId,
        customerId: { $in: customerIds },
      })
      .select('customerId balance')
      .exec();
    const loyaltyMap = new Map<string, number>();
    for (const l of loyaltyList) {
      loyaltyMap.set(String(l.customerId), l.balance ?? 0);
    }

    const now = new Date();
    const matched: CustomerDocument[] = [];

    for (const cust of allCustomers) {
      const custIdStr = String(cust._id);
      const saleInfo = salesMap.get(custIdStr) ?? { totalSpendMinor: 0, visitCount: 0 };
      const lastVisitAt = apptMap.get(custIdStr) ?? null;
      const hasActiveSubscription = subSet.has(custIdStr);
      const loyaltyPoints = loyaltyMap.get(custIdStr) ?? 0;

      const metrics: CustomerMarketingMetrics = {
        customerId: custIdStr,
        totalSpendMinor: saleInfo.totalSpendMinor,
        visitCount: saleInfo.visitCount,
        lastVisitAt,
        hasActiveSubscription,
        loyaltyPoints,
        preferredBranchId: cust.preferredStaffId ? String(cust.preferredStaffId) : null,
        marketingOptOut: cust.marketingOptOut ?? false,
      };

      if (matchesSegmentFilter(metrics, filter, now)) {
        matched.push(cust);
      }
    }

    return matched;
  }
}
