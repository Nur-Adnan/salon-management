import { Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { commissionOf, distributeTip, money } from '@salon/shared';
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
        const rateBps = comp?.commissionRateBps ?? 0;
        if (rateBps <= 0) continue;
        const amountMinor = commissionOf(money(net), rateBps).amount;
        if (amountMinor <= 0) continue;
        await this.createEntry({ tenantId, branchId, staffId, saleId, kind: 'commission', amountMinor, rateBps });
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
