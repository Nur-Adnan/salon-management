// Atomic, ledger-backed balance mutations. Plain functions (not Nest providers)
// so BOTH CrmModule's admin services and PosModule's SalesService (checkout
// redemption) can call them directly against their own injected Models, with no
// inter-module service dependency and no risk of a circular import.
//
// The non-negative guarantee is structural, not a check-then-write: every debit
// is a single conditional `findOneAndUpdate` filtered on `balance: { $gte: n }`.
// Two concurrent debits against the same balance can never both succeed past
// zero — MongoDB only ever matches and applies one of them if the second no
// longer satisfies the filter. This is the same pattern Phase 3 used for
// slot-reservation uniqueness and Phase 4 used for stock decrement.
import type { ClientSession, Model, Types } from 'mongoose';
import type { LedgerEntryType } from '@salon/shared';
import type { CouponDocument } from './schemas/coupon.schema.js';
import type { GiftCardDocument } from './schemas/gift-card.schema.js';
import type { GiftCardLedgerEntryDocument } from './schemas/gift-card-ledger-entry.schema.js';
import type { LoyaltyAccountDocument } from './schemas/loyalty-account.schema.js';
import type { LoyaltyLedgerEntryDocument } from './schemas/loyalty-ledger-entry.schema.js';
import type { ReferralDocument } from './schemas/referral.schema.js';

export interface LoyaltyModels {
  accounts: Model<LoyaltyAccountDocument>;
  ledger: Model<LoyaltyLedgerEntryDocument>;
}

/** Credit points (upserts the account on first use). Always succeeds. */
export async function creditLoyalty(
  m: LoyaltyModels,
  params: {
    tenantId: Types.ObjectId;
    customerId: Types.ObjectId;
    points: number;
    type: LedgerEntryType;
    saleId?: Types.ObjectId | null;
    note?: string | null;
  },
  session?: ClientSession,
): Promise<LoyaltyAccountDocument> {
  const account = await m.accounts
    .findOneAndUpdate(
      { tenantId: params.tenantId, customerId: params.customerId },
      { $inc: { balance: params.points } },
      { upsert: true, new: true, session },
    )
    .exec();
  await m.ledger.create(
    [
      {
        tenantId: params.tenantId,
        accountId: account._id,
        customerId: params.customerId,
        type: params.type,
        points: params.points,
        saleId: params.saleId ?? null,
        note: params.note ?? null,
      },
    ] as never,
    { session },
  );
  return account;
}

/**
 * Debit points. Returns null if the account doesn't exist or the balance is
 * insufficient (never throws for that case — callers turn null into a 4xx).
 */
export async function debitLoyalty(
  m: LoyaltyModels,
  params: {
    tenantId: Types.ObjectId;
    customerId: Types.ObjectId;
    points: number;
    type: LedgerEntryType;
    saleId?: Types.ObjectId | null;
    note?: string | null;
  },
  session?: ClientSession,
): Promise<LoyaltyAccountDocument | null> {
  const account = await m.accounts
    .findOneAndUpdate(
      { tenantId: params.tenantId, customerId: params.customerId, balance: { $gte: params.points } },
      { $inc: { balance: -params.points } },
      { new: true, session },
    )
    .exec();
  if (!account) return null;
  await m.ledger.create(
    [
      {
        tenantId: params.tenantId,
        accountId: account._id,
        customerId: params.customerId,
        type: params.type,
        points: params.points,
        saleId: params.saleId ?? null,
        note: params.note ?? null,
      },
    ] as never,
    { session },
  );
  return account;
}

export interface GiftCardModels {
  cards: Model<GiftCardDocument>;
  ledger: Model<GiftCardLedgerEntryDocument>;
}

/**
 * Debit a gift card by code. Returns null if the code is unknown, the card
 * isn't active, or the balance is insufficient — a single atomic operation
 * covers all three (the filter requires status:'active' AND balance >= amount).
 * `status` is never auto-flipped to 'depleted' by this — a zero balance is
 * self-evident from `balance.amount`; serializers derive the depleted label
 * for display rather than storing it (same philosophy as billing state).
 */
export async function debitGiftCard(
  m: GiftCardModels,
  params: {
    tenantId: Types.ObjectId;
    code: string;
    amountMinor: number;
    saleId?: Types.ObjectId | null;
    note?: string | null;
  },
  session?: ClientSession,
): Promise<GiftCardDocument | null> {
  const card = await m.cards
    .findOneAndUpdate(
      {
        tenantId: params.tenantId,
        code: params.code,
        status: 'active',
        'balance.amount': { $gte: params.amountMinor },
        $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }],
      },
      { $inc: { 'balance.amount': -params.amountMinor } },
      { new: true, session },
    )
    .exec();
  if (!card) return null;
  await m.ledger.create(
    [
      {
        tenantId: params.tenantId,
        giftCardId: card._id,
        type: 'redeem',
        amount: { amount: params.amountMinor, currency: 'BDT' },
        saleId: params.saleId ?? null,
        note: params.note ?? null,
      },
    ] as never,
    { session },
  );
  return card;
}

/**
 * Reverse the loyalty points EARNED for a sale (credited post-commit by the
 * SaleCompleted handler). Called SYNCHRONOUSLY inside voidSale()'s transaction,
 * the same asymmetry the loyalty-redemption / gift-card / commission reversals
 * already follow: a dropped EARN is self-correcting (the handler re-earns), but
 * a dropped CLAWBACK is a permanent overpayment nothing else fixes.
 *
 * Unlike the redemption debit, this is UNCONDITIONAL — it may drive the cached
 * balance negative if the customer has already redeemed the earned points. That
 * negative is the honest ledger position of an over-redemption and is not a
 * violation of the "never negative on redemption" guarantee: `debitLoyalty`'s
 * `balance >= n` filter still prevents a customer from spending points they
 * don't hold; a negative balance simply blocks further redemption until it is
 * re-earned. No-op if the earn entry hasn't landed yet — the handler's
 * sale.status guard then prevents it ever landing on the (now voided) sale.
 * Idempotent per void because voidSale's status:'completed'->'voided' guard
 * lets only one void body run, and a driver retry rolls back the prior attempt.
 */
export async function reverseLoyaltyEarnForSale(
  m: LoyaltyModels,
  params: { tenantId: Types.ObjectId; saleId: Types.ObjectId },
  session: ClientSession,
): Promise<void> {
  const earn = await m.ledger
    .findOne({ tenantId: params.tenantId, saleId: params.saleId, type: 'earn' })
    .session(session)
    .exec();
  if (!earn || earn.points <= 0) return;
  const account = await m.accounts
    .findOneAndUpdate(
      { tenantId: params.tenantId, _id: earn.accountId },
      { $inc: { balance: -earn.points } },
      { new: true, session },
    )
    .exec();
  if (!account) return;
  await m.ledger.create(
    [
      {
        tenantId: params.tenantId,
        accountId: account._id,
        customerId: earn.customerId,
        type: 'adjust',
        points: earn.points,
        saleId: params.saleId,
        note: 'void reversal: earned points clawed back',
      },
    ] as never,
    { session },
  );
}

export interface ReferralModels {
  referrals: Model<ReferralDocument>;
  accounts: Model<LoyaltyAccountDocument>;
  ledger: Model<LoyaltyLedgerEntryDocument>;
}

/**
 * Reverse the referral reward that a sale's completion triggered (see
 * ReferralsService.rewardIfPending). Called SYNCHRONOUSLY inside voidSale() —
 * same clawback asymmetry as above. The atomic `status:'rewarded' -> 'pending'`
 * flip (keyed on rewardedSaleId) is both the idempotency guard (only one void
 * can claim it) and the fix for the "permanently un-rewardable" defect: resetting
 * to 'pending' lets a later genuine sale by the same referred customer re-earn
 * the reward. The referrer's balance debit is unconditional (may go negative),
 * for the same reason as the loyalty-earn clawback.
 */
export async function reverseReferralRewardForSale(
  m: ReferralModels,
  params: { tenantId: Types.ObjectId; saleId: Types.ObjectId },
  session: ClientSession,
): Promise<void> {
  const referral = await m.referrals
    .findOneAndUpdate(
      { tenantId: params.tenantId, rewardedSaleId: params.saleId, status: 'rewarded' },
      { $set: { status: 'pending', rewardedAt: null, rewardedSaleId: null } },
      { new: false, session },
    )
    .exec();
  if (!referral) return;
  const account = await m.accounts
    .findOneAndUpdate(
      { tenantId: params.tenantId, customerId: referral.referrerCustomerId },
      { $inc: { balance: -referral.rewardPoints } },
      { new: true, upsert: true, session },
    )
    .exec();
  await m.ledger.create(
    [
      {
        tenantId: params.tenantId,
        accountId: account._id,
        customerId: referral.referrerCustomerId,
        type: 'adjust',
        points: referral.rewardPoints,
        saleId: params.saleId,
        note: 'void reversal: referral reward clawed back',
      },
    ] as never,
    { session },
  );
}

/** Atomically claim one redemption slot on a coupon (unlimited if maxRedemptions is null). */
export async function claimCouponRedemption(
  coupons: Model<CouponDocument>,
  params: { tenantId: Types.ObjectId; couponId: Types.ObjectId },
  session?: ClientSession,
): Promise<CouponDocument | null> {
  return coupons
    .findOneAndUpdate(
      {
        _id: params.couponId,
        tenantId: params.tenantId,
        active: true,
        deletedAt: null,
        $expr: {
          $or: [{ $eq: ['$maxRedemptions', null] }, { $lt: ['$redeemedCount', '$maxRedemptions'] }],
        },
      },
      { $inc: { redeemedCount: 1 } },
      { new: true, session },
    )
    .exec();
}
