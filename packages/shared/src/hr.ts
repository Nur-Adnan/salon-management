// Phase 6 HR — pure business logic (commission math, tip distribution, shift
// hours, payroll totals). No I/O; the API layer does all persistence +
// validation-that-needs-the-database around these.

import { type Money, money } from './money.js';

// --- Commission ---
// Commission is computed on NET sale-line revenue (post-discount, pre-tax) —
// the same "net spend" base loyalty already uses (see crm.ts): tax isn't the
// business's money to share commission on, and a tip is already 100% the
// staff member's, so it's excluded too.
export function commissionOf(netAmount: Money, rateBps: number): Money {
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new RangeError(`rateBps must be a non-negative integer, got ${rateBps}`);
  }
  return money(Math.round((netAmount.amount * rateBps) / 10000));
}

export interface CommissionTier {
  upToMinor: number; // Upper bound of this bracket in minor units (e.g. 500000 poisha). Infinity for top tier.
  rateBps: number; // Basis points for revenue within this bracket.
}

/**
 * Computes commission using progressive tiered brackets (like tax brackets).
 * Slices net amount across tiers in ascending order.
 * Falls back to defaultRateBps if tiers list is empty.
 */
export function calculateTieredCommission(
  netAmount: Money,
  tiers: CommissionTier[],
  defaultRateBps: number,
): Money {
  if (!tiers || tiers.length === 0) {
    return commissionOf(netAmount, defaultRateBps);
  }

  const sortedTiers = [...tiers].sort((a, b) => a.upToMinor - b.upToMinor);
  let remaining = netAmount.amount;
  let prevThreshold = 0;
  let totalCommission = 0;

  for (const tier of sortedTiers) {
    if (remaining <= 0) break;
    const bracketSize = tier.upToMinor - prevThreshold;
    const taxableInBracket = Math.min(remaining, bracketSize);
    totalCommission += Math.round((taxableInBracket * tier.rateBps) / 10000);
    remaining -= taxableInBracket;
    prevThreshold = tier.upToMinor;
  }

  return money(totalCommission);
}

export interface ServiceCommissionRule {
  serviceId: string;
  rateBps?: number;
  fixedAmountMinor?: number;
}

/**
 * Computes commission for a specific service line, checking for fixed or percentage overrides.
 */
export function calculateServiceCommission(
  netAmount: Money,
  rule: ServiceCommissionRule | null | undefined,
  defaultRateBps: number,
): Money {
  if (!rule) {
    return commissionOf(netAmount, defaultRateBps);
  }
  if (rule.fixedAmountMinor != null && rule.fixedAmountMinor >= 0) {
    return money(rule.fixedAmountMinor);
  }
  const rate = rule.rateBps != null && rule.rateBps >= 0 ? rule.rateBps : defaultRateBps;
  return commissionOf(netAmount, rate);
}

// --- Tip distribution ---
export interface TippableLine {
  staffId: string;
  net: number; // minor units, post-discount pre-tax (mirrors SaleLineTotals.net)
}

/**
 * Distributes a sale's tip across distinct attributed staff, pro-rata by each
 * staff's share of net line revenue, penny-exact (sum of shares === tip).
 * Lines don't need to be pre-aggregated — a staff member attributed on
 * multiple lines of the same sale has their net summed internally. A sale
 * with no attributed staff (or a zero tip) distributes nothing, rather than
 * guessing who should get it.
 */
export function distributeTip(lines: TippableLine[], tip: Money): Map<string, Money> {
  const netByStaff = new Map<string, number>();
  for (const l of lines) {
    if (l.net <= 0) continue;
    netByStaff.set(l.staffId, (netByStaff.get(l.staffId) ?? 0) + l.net);
  }
  const totalNet = [...netByStaff.values()].reduce((a, b) => a + b, 0);
  const result = new Map<string, Money>();
  if (tip.amount <= 0 || totalNet <= 0) return result;

  // Pass 1: each staff member's floored proportional share.
  const staffIds = [...netByStaff.keys()];
  let distributed = 0;
  for (const id of staffIds) {
    const share = Math.floor((tip.amount * (netByStaff.get(id) ?? 0)) / totalNet);
    result.set(id, money(share));
    distributed += share;
  }
  // Pass 2: the flooring remainder (always < staffIds.length) handed out one
  // poisha at a time. Unlike applyCoupon's discount distribution there's no
  // per-line headroom cap to respect here — a tip share isn't bounded by the
  // line's own net — so this is strictly simpler.
  let remainder = tip.amount - distributed;
  for (let i = 0; remainder > 0 && i < staffIds.length; i++) {
    const id = staffIds[i];
    if (!id) continue;
    const current = result.get(id) ?? money(0);
    result.set(id, money(current.amount + 1));
    remainder -= 1;
  }
  return result;
}

// --- Attendance ---
/** Decimal hours between two instants (fractional, e.g. 7.5 = 7h30m). */
export function shiftHours(clockIn: Date, clockOut: Date): number {
  return Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3_600_000);
}

export interface ShiftHoursDetails {
  rawHours: number;
  breakHours: number;
  netHours: number;
  regularHours: number;
  overtimeHours: number;
}

/**
 * Calculates attendance hours with break deductions and overtime split.
 * @param clockIn Start of shift
 * @param clockOut End of shift
 * @param breakMinutes Total break time in minutes (e.g. 60 for 1h lunch)
 * @param dailyOvertimeThresholdHours Daily standard threshold (default 8h)
 */
export function calculateShiftHoursWithBreaks(
  clockIn: Date,
  clockOut: Date,
  breakMinutes = 0,
  dailyOvertimeThresholdHours = 8,
): ShiftHoursDetails {
  const rawHours = shiftHours(clockIn, clockOut);
  const breakHours = Math.max(0, breakMinutes / 60);
  const netHours = Math.max(0, rawHours - breakHours);
  const regularHours = Math.min(netHours, dailyOvertimeThresholdHours);
  const overtimeHours = Math.max(0, netHours - regularHours);

  return {
    rawHours: Number(rawHours.toFixed(4)),
    breakHours: Number(breakHours.toFixed(4)),
    netHours: Number(netHours.toFixed(4)),
    regularHours: Number(regularHours.toFixed(4)),
    overtimeHours: Number(overtimeHours.toFixed(4)),
  };
}

// --- Payroll ---
export interface PayrollAdjustment {
  amountMinor: number; // signed — a bonus is positive, a deduction is negative
}

export interface PayrollInputs {
  baseSalaryMinor: number;
  hourlyRateMinor: number;
  hoursWorked: number; // decimal hours — Σ shiftHours() over the claimed shifts
  commissionMinor: number; // Σ claimed commission entries (0 if none)
  tipsMinor: number; // Σ claimed tip entries (0 if none)
  adjustments: PayrollAdjustment[];
}

export interface PayrollTotals {
  hourlyPayMinor: number;
  grossMinor: number; // base + hourly + commission + tips
  adjustmentsTotalMinor: number;
  netMinor: number; // gross + adjustments — see docs/phase-6.md for why this can go negative
}

/** Rounds the hourly component ONCE from total hours, not per shift, so many
 * short shifts can't compound rounding error the way per-shift rounding would. */
export function payrollTotals(inputs: PayrollInputs): PayrollTotals {
  const hourlyPayMinor = Math.round(inputs.hourlyRateMinor * inputs.hoursWorked);
  const grossMinor = inputs.baseSalaryMinor + hourlyPayMinor + inputs.commissionMinor + inputs.tipsMinor;
  const adjustmentsTotalMinor = inputs.adjustments.reduce((a, b) => a + b.amountMinor, 0);
  return { hourlyPayMinor, grossMinor, adjustmentsTotalMinor, netMinor: grossMinor + adjustmentsTotalMinor };
}
