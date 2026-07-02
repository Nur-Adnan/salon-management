import { Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { earnedLoyaltyPoints, money } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { SaleCompleted } from '../../pos/events.js';
import { Sale, type SaleDocument } from '../../pos/schemas/sale.schema.js';
import { creditLoyalty } from '../ledger.util.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from '../schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, type LoyaltyLedgerEntryDocument } from '../schemas/loyalty-ledger-entry.schema.js';
import { ReferralsService } from '../referrals.service.js';

// Loyalty earn (and the referral reward it can trigger) is intentionally
// best-effort via the event bus — same tradeoff the audit log already made in
// Phase 0/1. The money itself (sale, payment, stock) is transactional; earning
// points is a side effect that matters far less than "did the sale commit".
// The {tenantId, saleId, type:'earn'} unique index (see loyalty-ledger-entry
// schema) still makes this handler idempotent against any accidental re-publish.
@EventsHandler(SaleCompleted)
export class SaleCompletedHandler implements IEventHandler<SaleCompleted> {
  private readonly logger = new Logger('CRM');

  constructor(
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyAccounts: Model<LoyaltyAccountDocument>,
    @InjectModel(LoyaltyLedgerEntry.name) private readonly loyaltyLedger: Model<LoyaltyLedgerEntryDocument>,
    private readonly referrals: ReferralsService,
  ) {}

  async handle(event: SaleCompleted): Promise<void> {
    try {
      const tenantId = new Types.ObjectId(event.tenantId);
      const sale = await this.sales.findOne({ _id: new Types.ObjectId(event.saleId), tenantId }).exec();
      if (!sale || !sale.customerId) return; // anonymous walk-in sales don't earn points

      const netSpend = money(sale.subtotal.amount - sale.discountTotal.amount);
      const points = earnedLoyaltyPoints(netSpend);
      if (points > 0) {
        await creditLoyalty(
          { accounts: this.loyaltyAccounts, ledger: this.loyaltyLedger },
          {
            tenantId,
            customerId: sale.customerId,
            points,
            type: 'earn',
            saleId: sale._id,
          },
        );
      }

      await this.referrals.rewardIfPending(tenantId, sale.customerId);
    } catch (err) {
      // Best-effort: never let a loyalty/referral hiccup surface to the customer
      // whose sale already committed successfully.
      this.logger.warn(`loyalty/referral processing failed for sale ${event.saleId}: ${(err as Error).message}`);
    }
  }
}
