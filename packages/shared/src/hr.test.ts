import { describe, expect, it } from 'vitest';
import { commissionOf, distributeTip, payrollTotals, shiftHours } from './hr.js';
import { money } from './money.js';

describe('commissionOf', () => {
  it('applies a basis-point rate to net revenue, rounded half-up', () => {
    expect(commissionOf(money(10_000), 1000).amount).toBe(1000); // 10% of ৳100
    expect(commissionOf(money(333), 2500).amount).toBe(83); // 83.25 -> 83
  });

  it('zero rate earns nothing', () => {
    expect(commissionOf(money(10_000), 0).amount).toBe(0);
  });

  it('rejects a negative or non-integer rate', () => {
    expect(() => commissionOf(money(1000), -1)).toThrow(RangeError);
    expect(() => commissionOf(money(1000), 1.5)).toThrow(RangeError);
  });
});

describe('distributeTip', () => {
  it('gives a single attributed staff member the entire tip', () => {
    const shares = distributeTip([{ staffId: 'a', net: 5000 }], money(1000));
    expect(shares.get('a')?.amount).toBe(1000);
    expect(shares.size).toBe(1);
  });

  it('splits pro-rata across distinct staff, penny-exact', () => {
    const shares = distributeTip(
      [
        { staffId: 'a', net: 5000 },
        { staffId: 'b', net: 3000 },
      ],
      money(100),
    );
    const total = [...shares.values()].reduce((sum, m) => sum + m.amount, 0);
    expect(total).toBe(100); // never over- or under-distributes
    expect(shares.get('a')!.amount).toBeGreaterThan(shares.get('b')!.amount);
  });

  it('sums multiple lines for the same staff member before distributing', () => {
    const shares = distributeTip(
      [
        { staffId: 'a', net: 2000 },
        { staffId: 'a', net: 3000 },
        { staffId: 'b', net: 5000 },
      ],
      money(100),
    );
    expect(shares.get('a')!.amount).toBe(50); // (2000+3000)/10000 = 50%
    expect(shares.get('b')!.amount).toBe(50);
  });

  it('distributes nothing when no line has an attributed staff member', () => {
    const shares = distributeTip([{ staffId: 'a', net: 0 }], money(500));
    expect(shares.size).toBe(0);
  });

  it('distributes nothing for a zero tip', () => {
    const shares = distributeTip([{ staffId: 'a', net: 5000 }], money(0));
    expect(shares.size).toBe(0);
  });

  it('never hands out more than the tip itself under an uneven three-way split', () => {
    // 1 poisha tip split three ways: floor gives everyone 0, remainder gives
    // exactly one staff member the single poisha — total must equal 1, not 3.
    const shares = distributeTip(
      [
        { staffId: 'a', net: 1000 },
        { staffId: 'b', net: 1000 },
        { staffId: 'c', net: 1000 },
      ],
      money(1),
    );
    const total = [...shares.values()].reduce((sum, m) => sum + m.amount, 0);
    expect(total).toBe(1);
  });
});

describe('shiftHours', () => {
  it('computes fractional hours', () => {
    const clockIn = new Date('2026-01-01T09:00:00Z');
    const clockOut = new Date('2026-01-01T16:30:00Z');
    expect(shiftHours(clockIn, clockOut)).toBeCloseTo(7.5, 5);
  });

  it('clamps a negative duration to zero', () => {
    const clockIn = new Date('2026-01-01T09:00:00Z');
    const clockOut = new Date('2026-01-01T08:00:00Z');
    expect(shiftHours(clockIn, clockOut)).toBe(0);
  });
});

describe('payrollTotals', () => {
  it('composes base + hourly + commission + tips, rounding hourly once', () => {
    const totals = payrollTotals({
      baseSalaryMinor: 10_000,
      hourlyRateMinor: 200,
      hoursWorked: 7.5,
      commissionMinor: 500,
      tipsMinor: 300,
      adjustments: [],
    });
    expect(totals.hourlyPayMinor).toBe(1500); // 200 * 7.5, exact
    expect(totals.grossMinor).toBe(10_000 + 1500 + 500 + 300);
    expect(totals.adjustmentsTotalMinor).toBe(0);
    expect(totals.netMinor).toBe(totals.grossMinor);
  });

  it('applies signed adjustments, which can drive net below zero', () => {
    const totals = payrollTotals({
      baseSalaryMinor: 0,
      hourlyRateMinor: 0,
      hoursWorked: 0,
      commissionMinor: 100,
      tipsMinor: 0,
      adjustments: [{ amountMinor: -500 }],
    });
    expect(totals.adjustmentsTotalMinor).toBe(-500);
    expect(totals.netMinor).toBe(-400);
  });

  it('an all-zero payroll nets to zero', () => {
    const totals = payrollTotals({
      baseSalaryMinor: 0,
      hourlyRateMinor: 0,
      hoursWorked: 0,
      commissionMinor: 0,
      tipsMinor: 0,
      adjustments: [],
    });
    expect(totals.netMinor).toBe(0);
  });
});
