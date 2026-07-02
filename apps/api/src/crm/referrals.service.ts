import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { CreateReferral } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { CustomerRepository } from '../customers/customer.repository.js';
import { creditLoyalty } from './ledger.util.js';
import { LoyaltyAccount, type LoyaltyAccountDocument } from './schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, type LoyaltyLedgerEntryDocument } from './schemas/loyalty-ledger-entry.schema.js';
import { Referral, type ReferralDocument } from './schemas/referral.schema.js';

// A referrer earns this many loyalty points once (and only once) the customer
// they referred completes their first sale — see the SaleCompleted handler.
export const REFERRAL_REWARD_POINTS = 100;

@Injectable()
export class ReferralsService {
  constructor(
    @InjectModel(Referral.name) private readonly referrals: Model<ReferralDocument>,
    @InjectModel(LoyaltyAccount.name) private readonly loyaltyAccounts: Model<LoyaltyAccountDocument>,
    @InjectModel(LoyaltyLedgerEntry.name) private readonly loyaltyLedger: Model<LoyaltyLedgerEntryDocument>,
    private readonly customers: CustomerRepository,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  async create(dto: CreateReferral): Promise<ReferralDocument> {
    const referrer = await this.customers.findByReferralCode(dto.referrerCode);
    if (!referrer) throw new BadRequestException('unknown referral code');

    const referredId = await this.customers.resolveId({
      customerId: dto.referredCustomerId,
      customer: dto.referredCustomer,
    });
    if (String(referrer._id) === String(referredId)) {
      throw new BadRequestException('a customer cannot refer themselves');
    }

    try {
      return await this.referrals.create({
        tenantId: this.tenantId(),
        referrerCustomerId: referrer._id,
        referredCustomerId: referredId,
        status: 'pending',
        rewardPoints: REFERRAL_REWARD_POINTS,
      } as never);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('this customer has already been referred');
      throw err;
    }
  }

  list(): Promise<ReferralDocument[]> {
    return this.referrals.find({ tenantId: this.tenantId() }).sort({ createdAt: -1 }).exec();
  }

  /** Called by the SaleCompleted handler on a referred customer's first sale. */
  async rewardIfPending(tenantId: Types.ObjectId, referredCustomerId: Types.ObjectId): Promise<void> {
    const referral = await this.referrals
      .findOneAndUpdate(
        { tenantId, referredCustomerId, status: 'pending' },
        { $set: { status: 'rewarded', rewardedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!referral) return; // no pending referral for this customer — nothing to do
    await creditLoyalty(
      { accounts: this.loyaltyAccounts, ledger: this.loyaltyLedger },
      {
        tenantId,
        customerId: referral.referrerCustomerId,
        points: referral.rewardPoints,
        type: 'earn',
        note: 'referral reward',
      },
    );
  }
}
