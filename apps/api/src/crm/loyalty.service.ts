import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { creditLoyalty, debitLoyalty } from './ledger.util.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from './schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, type LoyaltyLedgerEntryDocument } from './schemas/loyalty-ledger-entry.schema.js';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectModel(LoyaltyAccount.name) private readonly accounts: Model<LoyaltyAccountDocument>,
    @InjectModel(LoyaltyLedgerEntry.name) private readonly ledger: Model<LoyaltyLedgerEntryDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  async balance(customerId: string): Promise<number> {
    const acct = await this.accounts
      .findOne({ tenantId: this.tenantId(), customerId: new Types.ObjectId(customerId) })
      .exec();
    return acct?.balance ?? 0;
  }

  async ledgerFor(customerId: string): Promise<LoyaltyLedgerEntryDocument[]> {
    return this.ledger
      .find({ tenantId: this.tenantId(), customerId: new Types.ObjectId(customerId) })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
  }

  // Manual goodwill credit/debit by staff. Debits still cannot go negative.
  async adjust(customerId: string, points: number, note?: string): Promise<LoyaltyAccountDocument> {
    const tenantId = this.tenantId();
    const custId = new Types.ObjectId(customerId);
    const m = { accounts: this.accounts, ledger: this.ledger };
    if (points > 0) {
      return creditLoyalty(m, { tenantId, customerId: custId, points, type: 'adjust', note });
    }
    const result = await debitLoyalty(m, {
      tenantId,
      customerId: custId,
      points: -points,
      type: 'adjust',
      note,
    });
    if (!result) throw new BadRequestException('insufficient loyalty balance for this adjustment');
    return result;
  }
}
