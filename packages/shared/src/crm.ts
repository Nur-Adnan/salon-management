// Phase 5 CRM — pure business logic (loyalty math, coupon distribution,
// subscription billing state, photo-consent predicate). No I/O; the API layer
// does all persistence + validation-that-needs-the-database around these.

import type { CouponType, PhotoConsentScope, PhotoConsentStatus, SubscriptionBillingState } from './enums.js';
import { type Money, add, money, subtract, zero } from './money.js';
import type { SaleLineInput } from './pos.js';

// --- Loyalty ---
// Locked rates (see docs/phase-5.md): earn 1 point per 20 BDT (2,000 poisha) of
// NET spend (subtotal − discount; tax and tip are excluded — you're rewarding
// spend on services/products, not government tax or a cashier gratuity).
// Redeem at a flat 1 point = 1 BDT (100 poisha). Both are simple to say aloud at
// the counter and need no conversion table.
export const LOYALTY_EARN_RATE_MINOR_PER_POINT = 2000;
export const LOYALTY_REDEEM_MINOR_PER_POINT = 100;

/** Points earned for a given net (post-discount, pre-tax/tip) sale amount. */
export function earnedLoyaltyPoints(netSaleAmount: Money): number {
  return Math.floor(netSaleAmount.amount / LOYALTY_EARN_RATE_MINOR_PER_POINT);
}

/** Minor-unit value of N loyalty points at the redemption rate. */
export function loyaltyPointsValue(points: number): Money {
  return money(points * LOYALTY_REDEEM_MINOR_PER_POINT);
}

/**
 * Points needed to cover a minor-unit redemption request. Redemption is only
 * offered in whole-taka steps (no fractional-point cash value), so a request
 * that doesn't divide evenly is rejected rather than silently rounded.
 */
export function loyaltyPointsForRedemption(amountMinor: number): number {
  if (amountMinor <= 0 || amountMinor % LOYALTY_REDEEM_MINOR_PER_POINT !== 0) {
    throw new RangeError(
      `loyalty redemption must be a positive multiple of ${LOYALTY_REDEEM_MINOR_PER_POINT} poisha, got ${amountMinor}`,
    );
  }
  return amountMinor / LOYALTY_REDEEM_MINOR_PER_POINT;
}

// --- Subscription billing state (derived, never stored — see enums.ts) ---
export interface BillingWindows {
  graceDays: number; // days after due before benefits pause
  lapseDays: number; // days after due before fully lapsed
}
export const DEFAULT_BILLING_WINDOWS: BillingWindows = { graceDays: 3, lapseDays: 7 };

export function subscriptionBillingState(
  nextBillingDate: Date,
  now: Date,
  windows: BillingWindows = DEFAULT_BILLING_WINDOWS,
): SubscriptionBillingState {
  const overdueDays = (now.getTime() - nextBillingDate.getTime()) / 86_400_000;
  if (overdueDays < 0) return 'current';
  if (overdueDays < windows.graceDays) return 'due';
  if (overdueDays < windows.lapseDays) return 'grace';
  return 'lapsed';
}

// --- Photo consent ---
export interface PhotoConsentLike {
  status: PhotoConsentStatus;
  scope: PhotoConsentScope[];
}

// The ONE predicate every "can this photo be used outside the clinical chart"
// check must call — never duplicate this test inline (see docs/phase-5.md).
export function isPhotoMarketable(consent: PhotoConsentLike): boolean {
  return consent.status === 'granted' && consent.scope.includes('marketing');
}

// Legal photo-consent state transitions. A photo is born 'pending' (the API
// never accepts a client-supplied consent on creation) and can be re-consented
// after a decline/revoke, but revoke is a one-way trip out of 'granted'.
const CONSENT_TRANSITIONS: Record<PhotoConsentStatus, PhotoConsentStatus[]> = {
  pending: ['granted', 'declined'],
  declined: ['granted'],
  granted: ['revoked'],
  revoked: ['granted'],
};
export function canTransitionConsent(from: PhotoConsentStatus, to: PhotoConsentStatus): boolean {
  return CONSENT_TRANSITIONS[from].includes(to);
}

// --- Coupon discount distribution ---
export interface CouponLike {
  type: CouponType;
  value: number; // percent: basis points (0-10000) ; fixed: minor units
  maxDiscount?: number; // minor units cap for a percent coupon
}

/** net = gross − discount, clamped to [0, gross] (mirrors lineTotals' clamp). */
function lineNet(l: SaleLineInput): number {
  const gross = l.unitPrice.amount * l.quantity;
  const d = Math.max(0, Math.min(l.discount.amount, gross));
  return gross - d;
}

/**
 * Apply a coupon as an ADDITIONAL discount layered on top of each line's
 * existing (manual) discount, distributed pro-rata by each line's current net
 * amount so tax is computed on the correctly-reduced base per line. Returns a
 * NEW lines array; callers still run the result through lineTotals/saleTotals.
 * A no-op (returns lines unchanged) if there is nothing left to discount.
 */
export function applyCoupon(lines: SaleLineInput[], coupon: CouponLike): SaleLineInput[] {
  const nets = lines.map(lineNet);
  const preCouponNet = nets.reduce((a, b) => a + b, 0);
  if (preCouponNet <= 0) return lines;

  let discountAmount =
    coupon.type === 'fixed'
      ? coupon.value
      : Math.round((preCouponNet * coupon.value) / 10000);
  if (coupon.type === 'percent' && coupon.maxDiscount !== undefined) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  }
  discountAmount = Math.max(0, Math.min(discountAmount, preCouponNet));
  if (discountAmount === 0) return lines;

  const lastEligible = nets.reduce((last, n, i) => (n > 0 ? i : last), -1);
  let distributed = 0;
  return lines.map((l, i) => {
    const net = nets[i] ?? 0;
    if (net <= 0) return l;
    const extra =
      i === lastEligible ? discountAmount - distributed : Math.floor((discountAmount * net) / preCouponNet);
    distributed += extra;
    return { ...l, discount: money(l.discount.amount + extra) };
  });
}

// --- Due-balance (accounts-receivable), ledger-derived — never stored ---
export interface SaleReceivable {
  total: Money;
  capturedTotal: Money; // sum of this sale's captured payments
  voided: boolean;
}
export function dueBalance(sales: SaleReceivable[]): Money {
  return sales
    .filter((s) => !s.voided)
    .reduce((acc, s) => add(acc, subtract(s.total, s.capturedTotal)), zero());
}
