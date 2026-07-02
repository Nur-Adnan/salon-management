import { serializeMoney, serializeName } from '../common/embeds.js';
import { giftCardDisplayStatus } from './gift-cards.service.js';
import type { CouponDocument } from './schemas/coupon.schema.js';
import type { CustomerSubscriptionDocument } from './schemas/customer-subscription.schema.js';
import type { GiftCardDocument } from './schemas/gift-card.schema.js';
import type { GiftCardLedgerEntryDocument } from './schemas/gift-card-ledger-entry.schema.js';
import type { LoyaltyLedgerEntryDocument } from './schemas/loyalty-ledger-entry.schema.js';
import type { ReferralDocument } from './schemas/referral.schema.js';
import type { SubscriptionPlanDocument } from './schemas/subscription-plan.schema.js';
import type { PhotoConsent, TreatmentPhoto, TreatmentRecordDocument } from './schemas/treatment-record.schema.js';

export const serializeLoyaltyLedgerEntry = (e: LoyaltyLedgerEntryDocument) => ({
  id: String(e._id),
  type: e.type,
  points: e.points,
  saleId: e.saleId ? String(e.saleId) : null,
  note: e.note ?? null,
  createdAt: (e as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? null,
});

export const serializeGiftCard = (c: GiftCardDocument) => ({
  id: String(c._id),
  code: c.code,
  initialAmount: serializeMoney(c.initialAmount),
  balance: serializeMoney(c.balance),
  status: giftCardDisplayStatus(c),
  issuedToCustomerId: c.issuedToCustomerId ? String(c.issuedToCustomerId) : null,
  expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
});

export const serializeGiftCardLedgerEntry = (e: GiftCardLedgerEntryDocument) => ({
  id: String(e._id),
  type: e.type,
  amount: serializeMoney(e.amount),
  saleId: e.saleId ? String(e.saleId) : null,
  note: e.note ?? null,
  createdAt: (e as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? null,
});

export const serializeCoupon = (c: CouponDocument) => ({
  id: String(c._id),
  code: c.code,
  type: c.type,
  value: c.value,
  maxDiscount: c.maxDiscount ?? null,
  minSpend: c.minSpend,
  maxRedemptions: c.maxRedemptions ?? null,
  redeemedCount: c.redeemedCount,
  activeFrom: c.activeFrom ? c.activeFrom.toISOString() : null,
  activeUntil: c.activeUntil ? c.activeUntil.toISOString() : null,
  active: c.active,
});

export const serializeReferral = (r: ReferralDocument) => ({
  id: String(r._id),
  referrerCustomerId: String(r.referrerCustomerId),
  referredCustomerId: String(r.referredCustomerId),
  status: r.status,
  rewardPoints: r.rewardPoints,
  rewardedAt: r.rewardedAt ? r.rewardedAt.toISOString() : null,
});

export const serializeSubscriptionPlan = (p: SubscriptionPlanDocument) => ({
  id: String(p._id),
  name: serializeName(p.name),
  price: serializeMoney(p.price),
  billingPeriodDays: p.billingPeriodDays,
  discountBps: p.discountBps,
  active: p.active,
});

export const serializeCustomerSubscription = (s: CustomerSubscriptionDocument) => ({
  id: String(s._id),
  customerId: String(s.customerId),
  planId: String(s.planId),
  status: s.status,
  currentPeriodStart: s.currentPeriodStart.toISOString(),
  nextBillingDate: s.nextBillingDate.toISOString(),
});

const serializeConsent = (c: PhotoConsent) => ({
  status: c.status,
  scope: c.scope,
  method: c.method ?? null,
  recordedBy: c.recordedBy ? String(c.recordedBy) : null,
  grantedAt: c.grantedAt ? c.grantedAt.toISOString() : null,
  revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
  revokedBy: c.revokedBy ? String(c.revokedBy) : null,
});

const serializePhoto = (p: TreatmentPhoto) => ({
  id: String(p._id),
  url: p.url,
  type: p.type,
  capturedBy: String(p.capturedBy),
  consent: serializeConsent(p.consent),
  takenAt: (p as unknown as { takenAt?: Date }).takenAt?.toISOString() ?? null,
});

export const serializeTreatmentRecord = (t: TreatmentRecordDocument) => ({
  id: String(t._id),
  customerId: String(t.customerId),
  appointmentId: t.appointmentId ? String(t.appointmentId) : null,
  staffId: t.staffId ? String(t.staffId) : null,
  colorFormula: t.colorFormula ?? null,
  notes: t.notes ?? null,
  allergies: t.allergies,
  photos: t.photos.filter((p) => !p.deletedAt).map(serializePhoto),
  createdAt: (t as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? null,
});
