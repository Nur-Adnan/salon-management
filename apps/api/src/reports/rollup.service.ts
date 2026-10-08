import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { calculateAov, calculateChurnRate, safeRate } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { Customer, type CustomerDocument } from '../customers/customer.schema.js';
import { StaffEarningEntry, type StaffEarningEntryDocument } from '../hr/schemas/staff-earning-entry.schema.js';
import { Branch, type BranchDocument } from '../iam/schemas/branch.schema.js';
import { Sale, type SaleDocument } from '../pos/schemas/sale.schema.js';
import { StockLevel, type StockLevelDocument } from '../pos/schemas/stock-level.schema.js';
import { Appointment, type AppointmentDocument } from '../scheduling/schemas/appointment.schema.js';
import { dayRangeUtc } from '../scheduling/time.util.js';
import { DailyRollup, type DailyRollupDocument } from './schemas/daily-rollup.schema.js';

@Injectable()
export class RollupService {
  private readonly logger = new Logger(RollupService.name);

  constructor(
    @InjectModel(DailyRollup.name) private readonly rollups: Model<DailyRollupDocument>,
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    @InjectModel(Appointment.name) private readonly appointments: Model<AppointmentDocument>,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(StaffEarningEntry.name) private readonly staffEarnings: Model<StaffEarningEntryDocument>,
    @InjectModel(StockLevel.name) private readonly stockLevels: Model<StockLevelDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
  ) {}

  async generateDailyRollup(
    tenantId: Types.ObjectId,
    dateStr: string,
    branchId?: Types.ObjectId | null,
  ): Promise<DailyRollupDocument> {
    if (!branchId) {
      // Generate for all branches first, then roll up to organization level
      const allBranches = await this.branches.find({ tenantId, deletedAt: null }).exec();
      const branchRollups: DailyRollupDocument[] = [];
      for (const b of allBranches) {
        const r = await this.generateBranchDailyRollup(tenantId, b._id, dateStr, b.timezone);
        branchRollups.push(r);
      }
      return this.aggregateOrgDailyRollup(tenantId, dateStr, branchRollups);
    }

    const branch = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
    const tz = branch?.timezone ?? 'Asia/Dhaka';
    return this.generateBranchDailyRollup(tenantId, branchId, dateStr, tz);
  }

  private async generateBranchDailyRollup(
    tenantId: Types.ObjectId,
    branchId: Types.ObjectId,
    dateStr: string,
    timezone: string,
  ): Promise<DailyRollupDocument> {
    const { start, end } = dayRangeUtc(dateStr, timezone);

    // 1. Sales aggregation
    const salesAgg = await this.sales.aggregate([
      {
        $match: {
          tenantId,
          branchId,
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          gross: { $sum: '$subtotal.amount' },
          discounts: { $sum: '$totalDiscount.amount' },
          tax: { $sum: '$tax.amount' },
          tips: { $sum: '$tip.amount' },
          net: { $sum: '$grandTotal.amount' },
          salesCount: { $sum: 1 },
          customerIds: { $addToSet: '$customerId' },
        },
      },
    ]);

    const s = salesAgg[0] ?? { gross: 0, discounts: 0, tax: 0, tips: 0, net: 0, salesCount: 0, customerIds: [] };
    const aov = calculateAov(s.net, s.salesCount);

    // 2. Appointments aggregation
    const apptsAgg = await this.appointments.aggregate([
      {
        $match: {
          tenantId,
          branchId,
          deletedAt: null,
          'lines.start': { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts: Record<string, number> = {};
    let totalAppts = 0;
    for (const a of apptsAgg) {
      statusCounts[a._id] = a.count;
      totalAppts += a.count;
    }

    // 3. New vs Returning customers
    const newCustomersCount = await this.customers.countDocuments({
      tenantId,
      createdAt: { $gte: start, $lte: end },
      deletedAt: null,
    });
    const returningCustomers = Math.max(0, s.customerIds.length - newCustomersCount);
    const retentionRate = safeRate(returningCustomers, s.customerIds.length);

    // 4. Inventory metrics
    const stockAgg = await this.stockLevels.aggregate([
      { $match: { tenantId, branchId } },
      {
        $group: {
          _id: null,
          totalQty: { $sum: '$qtyOnHand' },
          lowStock: {
            $sum: { $cond: [{ $lte: ['$qtyOnHand', '$reorderPoint'] }, 1, 0] },
          },
        },
      },
    ]);
    const inv = stockAgg[0] ?? { totalQty: 0, lowStock: 0 };

    const doc = await this.rollups.findOneAndUpdate(
      { tenantId, branchId, date: dateStr },
      {
        $set: {
          revenue: {
            gross: s.gross,
            discounts: s.discounts,
            net: s.net,
            tax: s.tax,
            tips: s.tips,
            salesCount: s.salesCount,
            averageOrderValue: aov,
          },
          appointments: {
            total: totalAppts,
            completed: statusCounts['completed'] ?? 0,
            cancelled: statusCounts['cancelled'] ?? 0,
            noShows: statusCounts['no_show'] ?? 0,
          },
          customers: {
            newCustomers: newCustomersCount,
            returningCustomers,
            retentionRate,
          },
          inventoryMetrics: {
            totalCostValue: inv.totalQty,
            lowStockCount: inv.lowStock,
          },
        },
      },
      { upsert: true, new: true },
    ).exec();

    return doc;
  }

  private async aggregateOrgDailyRollup(
    tenantId: Types.ObjectId,
    dateStr: string,
    branchRollups: DailyRollupDocument[],
  ): Promise<DailyRollupDocument> {
    let gross = 0;
    let discounts = 0;
    let net = 0;
    let tax = 0;
    let tips = 0;
    let salesCount = 0;
    let totalAppts = 0;
    let completedAppts = 0;
    let cancelledAppts = 0;
    let noShows = 0;
    let newCustomers = 0;
    let returningCustomers = 0;
    let lowStock = 0;

    for (const r of branchRollups) {
      gross += r.revenue?.gross ?? 0;
      discounts += r.revenue?.discounts ?? 0;
      net += r.revenue?.net ?? 0;
      tax += r.revenue?.tax ?? 0;
      tips += r.revenue?.tips ?? 0;
      salesCount += r.revenue?.salesCount ?? 0;

      totalAppts += r.appointments?.total ?? 0;
      completedAppts += r.appointments?.completed ?? 0;
      cancelledAppts += r.appointments?.cancelled ?? 0;
      noShows += r.appointments?.noShows ?? 0;

      newCustomers += r.customers?.newCustomers ?? 0;
      returningCustomers += r.customers?.returningCustomers ?? 0;
      lowStock += r.inventoryMetrics?.lowStockCount ?? 0;
    }

    const aov = calculateAov(net, salesCount);
    const totalCust = newCustomers + returningCustomers;
    const retentionRate = safeRate(returningCustomers, totalCust);

    return this.rollups.findOneAndUpdate(
      { tenantId, branchId: null, date: dateStr },
      {
        $set: {
          revenue: { gross, discounts, net, tax, tips, salesCount, averageOrderValue: aov },
          appointments: { total: totalAppts, completed: completedAppts, cancelled: cancelledAppts, noShows },
          customers: { newCustomers, returningCustomers, retentionRate },
          inventoryMetrics: { totalCostValue: 0, lowStockCount: lowStock },
        },
      },
      { upsert: true, new: true },
    ).exec() as Promise<DailyRollupDocument>;
  }

  async getDashboardSummary(
    tenantId: Types.ObjectId,
    from: string,
    to: string,
    branchId?: Types.ObjectId | null,
  ) {
    const q: Record<string, unknown> = {
      tenantId,
      branchId: branchId ?? null,
      date: { $gte: from, $lte: to },
    };

    let items: DailyRollupDocument[] = await this.rollups.find(q).sort({ date: 1 }).exec();

    // If no rollups exist in this range yet, generate for the dates on the fly
    if (!items.length) {
      const generated = await this.generateDailyRollup(tenantId, to, branchId);
      items = [generated];
    }

    let totalRevenue = 0;
    let totalSales = 0;
    let totalAppointments = 0;
    let completedAppointments = 0;
    let cancelledAppointments = 0;
    let noShows = 0;

    for (const item of items) {
      totalRevenue += item.revenue?.net ?? 0;
      totalSales += item.revenue?.salesCount ?? 0;
      totalAppointments += item.appointments?.total ?? 0;
      completedAppointments += item.appointments?.completed ?? 0;
      cancelledAppointments += item.appointments?.cancelled ?? 0;
      noShows += item.appointments?.noShows ?? 0;
    }

    const aov = calculateAov(totalRevenue, totalSales);
    const completionRate = safeRate(completedAppointments, totalAppointments);
    const cancellationRate = safeRate(cancelledAppointments, totalAppointments);
    const noShowRate = safeRate(noShows, totalAppointments);

    return {
      period: { from, to },
      totalRevenue,
      totalSales,
      averageOrderValue: aov,
      appointments: {
        total: totalAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments,
        noShows,
        completionRate,
        cancellationRate,
        noShowRate,
      },
      dailyTrend: items,
    };
  }

  async getCohortRetention(tenantId: Types.ObjectId) {
    // 1. Find first sale date per customer
    const firstSales = await this.sales.aggregate([
      { $match: { tenantId, status: 'completed' } },
      {
        $group: {
          _id: '$customerId',
          firstSaleAt: { $min: '$createdAt' },
        },
      },
    ]);

    // 2. Map customers to cohort month YYYY-MM
    const customerCohorts = new Map<string, string>();
    const cohortSizes = new Map<string, number>();

    for (const fs of firstSales) {
      const monthStr = new Date(fs.firstSaleAt).toISOString().slice(0, 7);
      customerCohorts.set(String(fs._id), monthStr);
      cohortSizes.set(monthStr, (cohortSizes.get(monthStr) ?? 0) + 1);
    }

    // 3. Aggregate all completed sales by customer and month
    const allSales = await this.sales.aggregate([
      { $match: { tenantId, status: 'completed' } },
      {
        $group: {
          _id: {
            customerId: '$customerId',
            month: { $substr: ['$createdAt', 0, 7] },
          },
        },
      },
    ]);

    // 4. Compute retention table
    const cohortActivity = new Map<string, Map<string, number>>();
    for (const as of allSales) {
      const custId = String(as._id.customerId);
      const saleMonth = as._id.month;
      const cohortMonth = customerCohorts.get(custId);
      if (!cohortMonth) continue;

      if (!cohortActivity.has(cohortMonth)) {
        cohortActivity.set(cohortMonth, new Map());
      }
      const actMap = cohortActivity.get(cohortMonth)!;
      actMap.set(saleMonth, (actMap.get(saleMonth) ?? 0) + 1);
    }

    const result: Array<{ cohort: string; size: number; retention: Record<string, number> }> = [];
    for (const [cohort, size] of cohortSizes.entries()) {
      const actMap = cohortActivity.get(cohort) ?? new Map();
      const retentionRates: Record<string, number> = {};
      for (const [month, activeCount] of actMap.entries()) {
        retentionRates[month] = safeRate(activeCount, size);
      }
      result.push({ cohort, size, retention: retentionRates });
    }

    return result.sort((a, b) => a.cohort.localeCompare(b.cohort));
  }

  async getChurnMetrics(tenantId: Types.ObjectId, inactiveDays: number = 60) {
    const totalCustomers = await this.customers.countDocuments({ tenantId, deletedAt: null });
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    // Active customers who visited within the last inactiveDays
    const recentVisitors = await this.sales.distinct('customerId', {
      tenantId,
      status: 'completed',
      createdAt: { $gte: cutoff },
    });

    const activeCount = recentVisitors.length;
    const inactiveCount = Math.max(0, totalCustomers - activeCount);
    const churnRate = calculateChurnRate(inactiveCount, totalCustomers);

    return {
      totalCustomers,
      activeCount,
      inactiveCount,
      inactiveThresholdDays: inactiveDays,
      churnRate,
    };
  }
}
