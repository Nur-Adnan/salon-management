// POS money math. Pure, integer minor units, server-authoritative — the frontend
// never computes totals. Tax is EXCLUSIVE (added on top of tax-exclusive catalog
// prices) at a rate in basis points (1500 bps = 15.00%), rounded per line.

import { type Money, add, money, mulInt, subtract, zero } from './money.js';

/** Tax on a base amount at `rateBps` basis points, rounded half-up to the poisha. */
export function taxOf(base: Money, rateBps: number): Money {
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new RangeError(`rateBps must be a non-negative integer, got ${rateBps}`);
  }
  // Math.round is half-up for the non-negative amounts money guarantees.
  return money(Math.round((base.amount * rateBps) / 10000), base.currency);
}

export interface SaleLineInput {
  unitPrice: Money; // resolved server-side from the catalog
  quantity: number;
  discount: Money; // absolute, applied to the whole line
  taxable: boolean;
  taxRateBps: number; // captured at sale time so the sale is historical
}

export interface SaleLineTotals {
  gross: Money; // unitPrice × quantity
  discount: Money; // clamped to [0, gross]
  net: Money; // gross − discount
  tax: Money; // taxable ? taxOf(net) : 0
  total: Money; // net + tax
}

export function lineTotals(line: SaleLineInput): SaleLineTotals {
  const gross = mulInt(line.unitPrice, line.quantity);
  // A discount can never exceed its line nor go negative.
  const discount = money(Math.max(0, Math.min(line.discount.amount, gross.amount)), gross.currency);
  const net = subtract(gross, discount);
  const tax = line.taxable ? taxOf(net, line.taxRateBps) : zero(gross.currency);
  return { gross, discount, net, tax, total: add(net, tax) };
}

export interface SaleTotals {
  subtotal: Money; // Σ gross (before discount)
  discountTotal: Money; // Σ discount
  taxTotal: Money; // Σ tax
  tip: Money;
  total: Money; // subtotal − discount + tax + tip
}

export function saleTotals(lines: SaleLineInput[], tip: Money = zero()): SaleTotals {
  let subtotal = zero();
  let discountTotal = zero();
  let taxTotal = zero();
  for (const line of lines) {
    const t = lineTotals(line);
    subtotal = add(subtotal, t.gross);
    discountTotal = add(discountTotal, t.discount);
    taxTotal = add(taxTotal, t.tax);
  }
  const total = add(add(subtract(subtotal, discountTotal), taxTotal), tip);
  return { subtotal, discountTotal, taxTotal, tip, total };
}

/** Σ of captured payment amounts (a split is reconciled against the sale total). */
export function amountCaptured(payments: { amount: Money; captured: boolean }[]): Money {
  return payments.filter((p) => p.captured).reduce((acc, p) => add(acc, p.amount), zero());
}

export type SalePaymentStatus = 'unpaid' | 'partial' | 'paid';

/** paid once captured covers the total (overpay = change at the counter). */
export function salePaymentStatus(total: Money, captured: Money): SalePaymentStatus {
  if (captured.amount <= 0) return 'unpaid';
  if (captured.amount < total.amount) return 'partial';
  return 'paid';
}
