// Money is ALWAYS integer minor units (poisha; 1 BDT = 100 poisha). Never floats.
// All arithmetic stays in minor units; only formatting divides by 100.

export type Currency = 'BDT';

export interface Money {
  /** integer minor units (poisha) */
  readonly amount: number;
  readonly currency: Currency;
}

function assertMinor(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Money amount must be a safe integer (minor units), got ${amount}`);
  }
}

export function money(amount: number, currency: Currency = 'BDT'): Money {
  assertMinor(amount);
  return { amount, currency };
}

export const zero = (currency: Currency = 'BDT'): Money => money(0, currency);

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

/** Multiply by an integer quantity (line-item qty). Rejects fractional qty. */
export function mulInt(a: Money, qty: number): Money {
  if (!Number.isInteger(qty)) throw new TypeError(`qty must be an integer, got ${qty}`);
  return money(a.amount * qty, a.currency);
}

export const isNegative = (a: Money): boolean => a.amount < 0;

const LOCALE_TAG: Record<'en' | 'bn', string> = { en: 'en-BD', bn: 'bn-BD' };

export function formatMoney(m: Money, locale: 'en' | 'bn' = 'en'): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: 'currency',
    currency: m.currency,
  }).format(m.amount / 100);
}
