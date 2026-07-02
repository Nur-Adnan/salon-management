import { describe, expect, it } from 'vitest';
import {
  applyCoupon,
  canTransitionConsent,
  dueBalance,
  earnedLoyaltyPoints,
  isPhotoMarketable,
  loyaltyPointsForRedemption,
  loyaltyPointsValue,
  subscriptionBillingState,
} from './crm.js';
import { money } from './money.js';

describe('loyalty earn/redeem', () => {
  it('earns 1 point per 2000 poisha of net spend, floored', () => {
    expect(earnedLoyaltyPoints(money(2000))).toBe(1);
    expect(earnedLoyaltyPoints(money(3999))).toBe(1);
    expect(earnedLoyaltyPoints(money(4000))).toBe(2);
    expect(earnedLoyaltyPoints(money(0))).toBe(0);
    expect(earnedLoyaltyPoints(money(1999))).toBe(0);
  });

  it('redemption rate is 1 point = 100 poisha', () => {
    expect(loyaltyPointsValue(50).amount).toBe(5000);
  });

  it('converts a whole-taka redemption request to points', () => {
    expect(loyaltyPointsForRedemption(500)).toBe(5);
  });

  it('rejects a redemption amount that is not a whole-taka multiple', () => {
    expect(() => loyaltyPointsForRedemption(150)).toThrow();
    expect(() => loyaltyPointsForRedemption(0)).toThrow();
    expect(() => loyaltyPointsForRedemption(-100)).toThrow();
  });
});

describe('subscription billing state (derived, never stored)', () => {
  const day = 86_400_000;
  it('current before the billing date', () => {
    const next = new Date(1_000_000 * day);
    expect(subscriptionBillingState(next, new Date(next.getTime() - day))).toBe('current');
  });
  it('due immediately on/after the billing date', () => {
    const next = new Date(1_000_000 * day);
    expect(subscriptionBillingState(next, next)).toBe('due');
    expect(subscriptionBillingState(next, new Date(next.getTime() + 2 * day))).toBe('due');
  });
  it('grace after the grace window, lapsed after the lapse window', () => {
    const next = new Date(1_000_000 * day);
    expect(subscriptionBillingState(next, new Date(next.getTime() + 3 * day))).toBe('grace');
    expect(subscriptionBillingState(next, new Date(next.getTime() + 6 * day))).toBe('grace');
    expect(subscriptionBillingState(next, new Date(next.getTime() + 7 * day))).toBe('lapsed');
    expect(subscriptionBillingState(next, new Date(next.getTime() + 30 * day))).toBe('lapsed');
  });
});

describe('photo consent', () => {
  it('marketable only when granted AND scoped to marketing', () => {
    expect(isPhotoMarketable({ status: 'granted', scope: ['marketing'] })).toBe(true);
    expect(isPhotoMarketable({ status: 'granted', scope: ['clinical_record'] })).toBe(false);
    expect(isPhotoMarketable({ status: 'pending', scope: ['marketing'] })).toBe(false);
    expect(isPhotoMarketable({ status: 'revoked', scope: ['marketing'] })).toBe(false);
  });

  it('legal transitions: pending -> granted|declined; declined -> granted; granted -> revoked; revoked -> granted', () => {
    expect(canTransitionConsent('pending', 'granted')).toBe(true);
    expect(canTransitionConsent('pending', 'declined')).toBe(true);
    expect(canTransitionConsent('declined', 'granted')).toBe(true);
    expect(canTransitionConsent('granted', 'revoked')).toBe(true);
    expect(canTransitionConsent('revoked', 'granted')).toBe(true);
  });

  it('illegal transitions are rejected', () => {
    expect(canTransitionConsent('pending', 'revoked')).toBe(false);
    expect(canTransitionConsent('declined', 'revoked')).toBe(false);
    expect(canTransitionConsent('granted', 'declined')).toBe(false);
    expect(canTransitionConsent('granted', 'pending')).toBe(false);
  });
});

describe('coupon discount distribution', () => {
  const line = (unitPrice: number, quantity = 1, discount = 0, taxable = true) => ({
    unitPrice: money(unitPrice),
    quantity,
    discount: money(discount),
    taxable,
    taxRateBps: 1500,
  });

  it('fixed coupon distributes pro-rata across lines by net amount', () => {
    // lines: 800 and 200 net (4:1 ratio); fixed coupon of 100 -> 80/20 split
    const out = applyCoupon([line(80000), line(20000)], { type: 'fixed', value: 10000 });
    expect(out[0].discount.amount).toBe(8000);
    expect(out[1].discount.amount).toBe(2000);
  });

  it('percent coupon applies bps of the pre-coupon net subtotal', () => {
    const out = applyCoupon([line(100000)], { type: 'percent', value: 1000 }); // 10%
    expect(out[0].discount.amount).toBe(10000);
  });

  it('percent coupon respects maxDiscount cap', () => {
    const out = applyCoupon([line(1000000)], { type: 'percent', value: 5000, maxDiscount: 20000 }); // 50% of 10000.00 capped at 200.00
    expect(out[0].discount.amount).toBe(20000);
  });

  it('never discounts below zero net (fixed coupon larger than the sale)', () => {
    const out = applyCoupon([line(5000)], { type: 'fixed', value: 999999 });
    expect(out[0].discount.amount).toBe(5000); // fully discounted, not negative
  });

  it('rounding remainder lands on the last eligible line so totals are exact', () => {
    // 3 equal lines of 100 net each -> 300 total; a 10% coupon = 30, split ~10/10/10 exactly
    const out = applyCoupon([line(10000), line(10000), line(10000)], { type: 'percent', value: 1000 });
    const sum = out.reduce((n, l) => n + l.discount.amount, 0);
    expect(sum).toBe(3000);
    // odd distribution case: forces a remainder
    const out2 = applyCoupon([line(10000), line(10000), line(10000)], { type: 'fixed', value: 100 });
    const sum2 = out2.reduce((n, l) => n + l.discount.amount, 0);
    expect(sum2).toBe(100);
  });

  it('skips lines already fully discounted to zero net', () => {
    const out = applyCoupon([line(10000, 1, 10000), line(10000)], { type: 'fixed', value: 5000 });
    expect(out[0].discount.amount).toBe(10000); // untouched, already net zero
    expect(out[1].discount.amount).toBe(5000); // absorbs the whole coupon
  });

  it('no-op when there is nothing left to discount', () => {
    const lines = [line(10000, 1, 10000)];
    expect(applyCoupon(lines, { type: 'fixed', value: 5000 })).toBe(lines);
  });

  it('preserves unitPrice/quantity/taxable/taxRateBps unchanged', () => {
    const out = applyCoupon([line(50000, 2, 0, false)], { type: 'fixed', value: 1000 });
    expect(out[0].unitPrice.amount).toBe(50000);
    expect(out[0].quantity).toBe(2);
    expect(out[0].taxable).toBe(false);
    expect(out[0].taxRateBps).toBe(1500);
  });
});

describe('due balance (ledger-derived accounts receivable)', () => {
  it('sums total minus captured across non-voided sales', () => {
    const due = dueBalance([
      { total: money(10000), capturedTotal: money(4000), voided: false },
      { total: money(5000), capturedTotal: money(5000), voided: false },
      { total: money(8000), capturedTotal: money(0), voided: true }, // excluded
    ]);
    expect(due.amount).toBe(6000);
  });

  it('zero across no sales or all-paid sales', () => {
    expect(dueBalance([]).amount).toBe(0);
    expect(dueBalance([{ total: money(1000), capturedTotal: money(1000), voided: false }]).amount).toBe(0);
  });
});
