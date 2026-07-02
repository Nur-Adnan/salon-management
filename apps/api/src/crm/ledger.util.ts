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
