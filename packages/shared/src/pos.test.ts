import { describe, expect, it } from 'vitest';
import { money } from './money.js';
import {
  amountCaptured,
  lineTotals,
  salePaymentStatus,
  saleTotals,
  taxOf,
} from './pos.js';

describe('taxOf', () => {
  it('applies a basis-point rate', () => {
    expect(taxOf(money(100000), 1500).amount).toBe(15000); // 15% of 1000.00
  });

  it('rounds half-up to the poisha', () => {
    // 199 × 15% = 29.85 poisha -> 30
    expect(taxOf(money(199), 1500).amount).toBe(30);
    // 33 × 15% = 4.95 -> 5
    expect(taxOf(money(33), 1500).amount).toBe(5);
  });

  it('zero rate => zero tax', () => {
    expect(taxOf(money(100000), 0).amount).toBe(0);
  });

  it('rejects a fractional or negative rate', () => {
    expect(() => taxOf(money(100), 15.5)).toThrow();
    expect(() => taxOf(money(100), -1)).toThrow();
  });
});

describe('lineTotals', () => {
  it('gross = unitPrice × quantity, tax on the net', () => {
    const t = lineTotals({ unitPrice: money(50000), quantity: 2, discount: money(0), taxable: true, taxRateBps: 1500 });
    expect(t.gross.amount).toBe(100000);
    expect(t.net.amount).toBe(100000);
    expect(t.tax.amount).toBe(15000);
    expect(t.total.amount).toBe(115000);
  });

  it('discount reduces the taxable base', () => {
    const t = lineTotals({ unitPrice: money(100000), quantity: 1, discount: money(20000), taxable: true, taxRateBps: 1500 });
    expect(t.net.amount).toBe(80000);
    expect(t.tax.amount).toBe(12000); // 15% of 800.00
    expect(t.total.amount).toBe(92000);
  });

  it('clamps a discount larger than the line to the line (never negative)', () => {
    const t = lineTotals({ unitPrice: money(5000), quantity: 1, discount: money(9999), taxable: true, taxRateBps: 1500 });
    expect(t.discount.amount).toBe(5000);
    expect(t.net.amount).toBe(0);
    expect(t.tax.amount).toBe(0);
    expect(t.total.amount).toBe(0);
  });

  it('non-taxable line has no tax', () => {
    const t = lineTotals({ unitPrice: money(30000), quantity: 1, discount: money(0), taxable: false, taxRateBps: 1500 });
    expect(t.tax.amount).toBe(0);
    expect(t.total.amount).toBe(30000);
  });
});

describe('saleTotals', () => {
  it('total = subtotal − discount + tax + tip (the invoice identity)', () => {
    const lines = [
      { unitPrice: money(50000), quantity: 1, discount: money(0), taxable: true, taxRateBps: 1500 }, // svc 500.00
      { unitPrice: money(20000), quantity: 2, discount: money(5000), taxable: true, taxRateBps: 1500 }, // 2×200 −50 = 350
      { unitPrice: money(10000), quantity: 1, discount: money(0), taxable: false, taxRateBps: 1500 }, // non-taxable product
    ];
    const s = saleTotals(lines, money(3000));
    expect(s.subtotal.amount).toBe(100000); // 500 + 400 + 100
    expect(s.discountTotal.amount).toBe(5000);
    // tax: 15% of 500 = 75.00 ; 15% of 350 = 52.50 -> 52.50? net 35000 ->5250 ; product none
    expect(s.taxTotal.amount).toBe(7500 + 5250);
    expect(s.tip.amount).toBe(3000);
    // identity check
    expect(s.total.amount).toBe(
      s.subtotal.amount - s.discountTotal.amount + s.taxTotal.amount + s.tip.amount,
    );
    expect(s.total.amount).toBe(100000 - 5000 + 12750 + 3000);
  });

  it('empty sale => all zero', () => {
    const s = saleTotals([]);
    expect(s.total.amount).toBe(0);
    expect(s.subtotal.amount).toBe(0);
  });
});

describe('payment reconciliation', () => {
  it('sums only captured payments', () => {
    const captured = amountCaptured([
      { amount: money(60000), captured: true },
      { amount: money(40000), captured: true },
      { amount: money(10000), captured: false }, // pending / due
    ]);
    expect(captured.amount).toBe(100000);
  });

  it('a split that covers the total => paid', () => {
    const total = money(115000);
    expect(salePaymentStatus(total, money(115000))).toBe('paid');
    expect(salePaymentStatus(total, money(50000))).toBe('partial');
    expect(salePaymentStatus(total, money(0))).toBe('unpaid');
  });

  it('overpay (cash tendered > total) still counts as paid', () => {
    expect(salePaymentStatus(money(100000), money(120000))).toBe('paid');
  });
});
