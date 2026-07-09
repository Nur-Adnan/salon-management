import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ReportGroupBy, loyaltyPointsValue, safeRate } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { CustomerSubscription, type CustomerSubscriptionDocument } from '../crm/schemas/customer-subscription.schema.js';
import { GiftCard, type GiftCardDocument } from '../crm/schemas/gift-card.schema.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from '../crm/schemas/loyalty-account.schema.js';
import { AttendanceRecord, type AttendanceRecordDocument } from '../hr/schemas/attendance-record.schema.js';
import { StaffEarningEntry, type StaffEarningEntryDocument } from '../hr/schemas/staff-earning-entry.schema.js';
import { Product, type ProductDocument } from '../catalog/schemas/product.schema.js';
import { Branch, type BranchDocument } from '../iam/schemas/branch.schema.js';
import { Sale, type SaleDocument } from '../pos/schemas/sale.schema.js';
import { StockLevel, type StockLevelDocument } from '../pos/schemas/stock-level.schema.js';
import { Appointment, type AppointmentDocument } from '../scheduling/schemas/appointment.schema.js';
import { dayRangeUtc } from '../scheduling/time.util.js';
import { PurchaseOrder, type PurchaseOrderDocument } from '../suppliers/schemas/purchase-order.schema.js';

// Read-only analytics. Every method is an on-demand aggregation over existing
// collections — no writes, no materialized rollups. Branch-scoped, except
// crmLiabilities (loyalty/gift-card/subscription balances aren't branch-partitioned).
@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectModel(StaffEarningEntry.name) private readonly staffEarnings: Model<StaffEarningEntryDocument>,
    @InjectModel(AttendanceRecord.name) private readonly attendance: Model<AttendanceRecordDocument>,
    @InjectModel(StockLevel.name) private readonly stock: Model<StockLevelDocument>,
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(PurchaseOrder.name) private readonly purchaseOrders: Model<PurchaseOrderDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyAccounts: Model<LoyaltyAccountDocument>,
    @InjectModel(GiftCard.name) private readonly giftCards: Model<GiftCardDocument>,
    @InjectModel(CustomerSubscription.name) private readonly subscriptions: Model<CustomerSubscriptionDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return { tenantId: new Types.ObjectId(c.tenantId), branchId: new Types.ObjectId(c.branchId) };
  }

  private async branchTz(tenantId: Types.ObjectId, branchId: Types.ObjectId): Promise<string> {
    const b = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
    return b?.timezone ?? 'Asia/Dhaka';
  }

  // from/to are YYYY-MM-DD in branch tz; missing from => epoch, missing to => now.
  private range(from: string | undefined, to: string | undefined, tz: string): { start: Date; end: Date } {
    const start = from ? dayRangeUtc(from, tz).start : new Date(0);
    const end = to ? dayRangeUtc(to, tz).end : new Date();
    return { start, end };
  }

  async salesReport(from: string | undefined, to: string | undefined, groupBy: ReportGroupBy) {
    const { tenantId, branchId } = this.scope();
    const tz = await this.branchTz(tenantId, branchId);
    const { start, end } = this.range(from, to, tz);
    const fmt = groupBy === 'month' ? '%Y-%m' : groupBy === 'week' ? '%G-W%V' : '%Y-%m-%d';

    const [res] = await this.sales.aggregate([
      { $match: { tenantId, branchId, status: 'completed', deletedAt: null, createdAt: { $gte: start, $lte: end } } },
      {
        $facet: {
          buckets: [
            {
              $group: {
                _id: { $dateToString: { date: '$createdAt', format: fmt, timezone: tz } },
                gross: { $sum: '$subtotal.amount' },
                discounts: { $sum: '$discountTotal.amount' },
                tax: { $sum: '$taxTotal.amount' },
                tips: { $sum: '$tip.amount' },
                total: { $sum: '$total.amount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byPaymentMethod: [
            { $unwind: '$payments' },
            { $match: { 'payments.status': 'captured' } },
            { $group: { _id: '$payments.method', amount: { $sum: '$payments.amount.amount' } } },
          ],
          byLineKind: [
            { $unwind: '$lines' },
            { $group: { _id: '$lines.kind', net: { $sum: { $subtract: ['$lines.lineTotal.amount', '$lines.tax.amount'] } } } },
          ],
        },
      },
    ]);

    const buckets = ((res?.buckets ?? []) as any[]).map((b) => ({
      key: b._id as string,
      gross: b.gross,
      discounts: b.discounts,
      net: b.gross - b.discounts,
      tax: b.tax,
      tips: b.tips,
      total: b.total,
      count: b.count,
    }));
    const totals = buckets.reduce(
      (a, b) => ({
        gross: a.gross + b.gross,
        discounts: a.discounts + b.discounts,
        net: a.net + b.net,
        tax: a.tax + b.tax,
        tips: a.tips + b.tips,
        total: a.total + b.total,
        count: a.count + b.count,
      }),
      { gross: 0, discounts: 0, net: 0, tax: 0, tips: 0, total: 0, count: 0 },
    );
    return {
      groupBy,
      buckets,
      byPaymentMethod: ((res?.byPaymentMethod ?? []) as any[]).map((p) => ({ method: p._id, amount: p.amount })),
      byLineKind: ((res?.byLineKind ?? []) as any[]).map((l) => ({ kind: l._id, net: l.net })),
      totals,
    };
  }

  async staffPerformance(from: string | undefined, to: string | undefined) {
    const { tenantId, branchId } = this.scope();
    const tz = await this.branchTz(tenantId, branchId);
    const { start, end } = this.range(from, to, tz);
    const inRange = { $gte: start, $lte: end };

    const earnings = (await this.staffEarnings.aggregate([
      { $match: { tenantId, branchId, createdAt: inRange } },
      { $group: { _id: { staffId: '$staffId', kind: '$kind' }, amt: { $sum: '$amountMinor' } } },
    ])) as any[];
    const attributed = (await this.sales.aggregate([
      { $match: { tenantId, branchId, status: 'completed', deletedAt: null, createdAt: inRange } },
      { $unwind: '$lines' },
      { $match: { 'lines.staffId': { $ne: null } } },
      {
        $group: {
          _id: '$lines.staffId',
          net: { $sum: { $subtract: ['$lines.lineTotal.amount', '$lines.tax.amount'] } },
          sales: { $addToSet: '$_id' },
        },
      },
    ])) as any[];
    const hours = (await this.attendance.aggregate([
      { $match: { tenantId, branchId, clockOut: { $ne: null }, clockIn: inRange } },
      { $group: { _id: '$staffId', ms: { $sum: { $subtract: ['$clockOut', '$clockIn'] } } } },
    ])) as any[];

    const rows = new Map<string, { staffId: string; netAttributed: number; commission: number; tips: number; hoursWorked: number; saleCount: number }>();
    const get = (id: string) => {
      let r = rows.get(id);
      if (!r) { r = { staffId: id, netAttributed: 0, commission: 0, tips: 0, hoursWorked: 0, saleCount: 0 }; rows.set(id, r); }
      return r;
    };
    for (const e of earnings) {
      const r = get(String(e._id.staffId));
      if (e._id.kind === 'commission') r.commission += e.amt;
      else if (e._id.kind === 'tip') r.tips += e.amt;
    }
    for (const a of attributed) {
      const r = get(String(a._id));
      r.netAttributed += a.net;
      r.saleCount += (a.sales as unknown[]).length;
    }
    for (const h of hours) {
      const r = get(String(h._id));
      r.hoursWorked += Math.round((h.ms / 3_600_000) * 100) / 100;
    }
    return Array.from(rows.values());
  }

  async inventoryValue(from: string | undefined, to: string | undefined) {
    const { tenantId, branchId } = this.scope();
    const tz = await this.branchTz(tenantId, branchId);
    const { start, end } = this.range(from, to, tz);

    const items = (await this.stock.aggregate([
      { $match: { tenantId, branchId } },
      {
        $lookup: {
          from: 'products',
          let: { pid: '$productId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$pid'] } } }, { $project: { cost: 1, name: 1 } }],
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 0,
          productId: '$productId',
          name: '$product.name',
          qtyOnHand: 1,
          reorderPoint: 1,
          unitCost: '$product.cost.amount',
          value: { $multiply: ['$qtyOnHand', '$product.cost.amount'] },
        },
      },
    ])) as any[];
    const totalValue = items.reduce((n, i) => n + i.value, 0);
    const lowStockCount = items.filter((i) => i.reorderPoint > 0 && i.qtyOnHand <= i.reorderPoint).length;

    const poSpend = (await this.purchaseOrders.aggregate([
      { $match: { tenantId, branchId, status: 'received', receivedAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$supplierId', spend: { $sum: '$totalCost.amount' } } },
    ])) as any[];

    return {
      items: items.map((i) => ({ ...i, productId: String(i.productId) })),
      totalValue,
      lowStockCount,
      poSpendBySupplier: poSpend.map((p) => ({ supplierId: String(p._id), spend: p.spend })),
    };
  }

  async appointments(from: string | undefined, to: string | undefined) {
    const { tenantId, branchId } = this.scope();
    const tz = await this.branchTz(tenantId, branchId);
    const { start, end } = this.range(from, to, tz);

    const rows = (await this.appts.aggregate([
      { $match: { tenantId, branchId, deletedAt: null, 'lines.start': { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])) as any[];

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStatus[r._id] = r.count;
      total += r.count;
    }
    const completed = byStatus.completed ?? 0;
    const cancelled = byStatus.cancelled ?? 0;
    const noShow = byStatus.no_show ?? 0;
    return {
      byStatus,
      total,
      completed,
      cancelled,
      noShow,
      noShowRate: safeRate(noShow, total),
      cancelRate: safeRate(cancelled, total),
    };
  }

  async crmLiabilities() {
    const { tenantId } = this.scope(); // tenant-wide: these balances aren't branch-partitioned
    const [loy] = (await this.loyaltyAccounts.aggregate([
      { $match: { tenantId } },
      { $group: { _id: null, pts: { $sum: '$balance' } } },
    ])) as any[];
    const [gc] = (await this.giftCards.aggregate([
      { $match: { tenantId, status: 'active' } },
      { $group: { _id: null, bal: { $sum: '$balance.amount' } } },
    ])) as any[];
    const activeSubscriptions = await this.subscriptions.countDocuments({ tenantId, status: 'active' }).exec();
    const [due] = (await this.sales.aggregate([
      { $match: { tenantId, status: 'completed', deletedAt: null } },
      {
        $project: {
          owed: {
            $max: [
              0,
              {
                $subtract: [
                  '$total.amount',
                  {
                    $reduce: {
                      input: '$payments',
                      initialValue: 0,
                      in: {
                        $add: [
                          '$$value',
                          { $cond: [{ $eq: ['$$this.status', 'captured'] }, '$$this.amount.amount', 0] },
                        ],
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      { $group: { _id: null, dueBalance: { $sum: '$owed' } } },
    ])) as any[];

    const pts = loy?.pts ?? 0;
    return {
      loyaltyPointsOutstanding: pts,
      loyaltyValueMinor: loyaltyPointsValue(pts).amount,
      giftCardOutstandingMinor: gc?.bal ?? 0,
      activeSubscriptions,
      dueBalanceMinor: due?.dueBalance ?? 0,
    };
  }
}
