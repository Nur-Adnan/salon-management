import { Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import {
  calculateServiceCommission,
  calculateTieredCommission,
  commissionOf,
  distributeTip,
  money,
} from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/mongo.util.js';
import { SaleCompleted } from '../../pos/events.js';
import { Sale, type SaleDocument } from '../../pos/schemas/sale.schema.js';
import { StaffCompensation, type StaffCompensationDocument } from '../schemas/staff-compensation.schema.js';
import { StaffEarningEntry, type StaffEarningEntryDocument } from '../schemas/staff-earning-entry.schema.js';

// Commission + tip creation is best-effort via the event bus — same tradeoff
// Phase 5's loyalty earn already made (see crm/events/sale-completed.handler.ts):
// both amounts are pure functions of the already-committed, immutable Sale
// document, so a dropped/delayed delivery is recoverable by construction,
// never a source of permanently lost pay. The per-(sale,staff,kind) unique
// index (staff-earning-entry.schema.ts) makes this handler idempotent against
// event redelivery.
@EventsHandler(SaleCompleted)
export class HrSaleCompletedHandler implements IEventHandler<SaleCompleted> {
  private readonly logger = new Logger('HR');

  constructor(
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    @InjectModel(StaffCompensation.name) private readonly compensation: Model<StaffCompensationDocument>,
    @InjectModel(StaffEarningEntry.name) private readonly earnings: Model<StaffEarningEntryDocument>,
  ) {}

  async handle(event: SaleCompleted): Promise<void> {
    try {
      const tenantId = new Types.ObjectId(event.tenantId);
      const branchId = new Types.ObjectId(event.branchId);
      const saleId = new Types.ObjectId(event.saleId);
      const sale = await this.sales.findOne({ _id: saleId, tenantId }).exec();
      if (!sale) return;
      // A sale voided before this best-effort handler ran must never accrue
      // commission/tip: voidSale's synchronous reverseStaffEarningsForSale would
      // find no entries to reverse, so a late earn would dangle and be paid out
      // by the next payroll run (the void-before-earn overpayment the phase-6
      // review's finding #1a targeted but the synchronous reversal alone can't
      // close, since it cannot negate entries that don't exist yet).
      if (sale.status !== 'completed') return;

      // Net (post-discount, pre-tax) revenue attributed to each distinct staff
      // member, summed across all their lines on this sale — commission is
      // rated ONCE on the total, not per line, so rounding can't compound.
      const netByStaff = new Map<string, number>();
      const tippable: { staffId: string; net: number }[] = [];
      for (const l of sale.lines) {
        if (!l.staffId) continue;
        const net = l.lineTotal.amount - l.tax.amount;
        tippable.push({ staffId: String(l.staffId), net });
        if (net <= 0) continue;
        const key = String(l.staffId);
        netByStaff.set(key, (netByStaff.get(key) ?? 0) + net);
      }

      for (const [staffIdStr, net] of netByStaff) {
        const staffId = new Types.ObjectId(staffIdStr);
        const comp = await this.compensation.findOne({ tenantId, userId: staffId }).exec();
        const defaultRateBps = comp?.commissionRateBps ?? 0;

        let staffCommission = 0;
        let generalNet = 0;

        const staffLines = sale.lines.filter((l) => l.staffId && String(l.staffId) === staffIdStr);
        for (const l of staffLines) {
          const lineNet = l.lineTotal.amount - l.tax.amount;
          if (lineNet <= 0) continue;

          const override = comp?.serviceOverrides?.find(
            (o) => String(o.serviceId) === String(l.refId),
          );

          if (override && (override.fixedAmountMinor != null || override.rateBps != null)) {
            staffCommission += calculateServiceCommission(
              money(lineNet),
              {
                serviceId: String(override.serviceId),
                rateBps: override.rateBps ?? undefined,
                fixedAmountMinor: override.fixedAmountMinor ?? undefined,
              },
              defaultRateBps,
            ).amount;
          } else {
            generalNet += lineNet;
          }
        }

        if (generalNet > 0) {
          if (comp?.commissionTiers && comp.commissionTiers.length > 0) {
            staffCommission += calculateTieredCommission(
              money(generalNet),
              comp.commissionTiers,
              defaultRateBps,
            ).amount;
          } else if (defaultRateBps > 0) {
            staffCommission += commissionOf(money(generalNet), defaultRateBps).amount;
          }
        }

        if (staffCommission <= 0) continue;
        await this.createEntry({
          tenantId,
          branchId,
          staffId,
          saleId,
          kind: 'commission',
          amountMinor: staffCommission,
          rateBps: defaultRateBps,
        });
      }

      if (sale.tip.amount > 0) {
        const shares = distributeTip(tippable, money(sale.tip.amount));
        for (const [staffIdStr, share] of shares) {
          if (share.amount <= 0) continue;
          await this.createEntry({
            tenantId,
            branchId,
            staffId: new Types.ObjectId(staffIdStr),
            saleId,
            kind: 'tip',
            amountMinor: share.amount,
            rateBps: null,
          });
        }
      }
    } catch (err) {
      // Best-effort: never let a commission/tip hiccup surface to the
      // customer whose sale already committed successfully.
      this.logger.warn(`commission/tip processing failed for sale ${event.saleId}: ${(err as Error).message}`);
    }
  }

  private async createEntry(params: {
    tenantId: Types.ObjectId;
    branchId: Types.ObjectId;
    staffId: Types.ObjectId;
    saleId: Types.ObjectId;
    kind: 'commission' | 'tip';
    amountMinor: number;
    rateBps: number | null;
  }): Promise<void> {
    try {
      await this.earnings.create([{ ...params, note: null }] as never);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
}
