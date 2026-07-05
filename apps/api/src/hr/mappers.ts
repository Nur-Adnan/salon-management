import type { AttendanceRecordDocument } from './schemas/attendance-record.schema.js';
import type { PayslipDocument } from './schemas/payslip.schema.js';
import type { StaffCompensationDocument } from './schemas/staff-compensation.schema.js';
import type { StaffEarningEntryDocument } from './schemas/staff-earning-entry.schema.js';

const createdAtOf = (doc: unknown): string | null =>
  (doc as { createdAt?: Date }).createdAt?.toISOString() ?? null;

// A staff member with no compensation profile yet reads as all-zero — "not
// configured" and "configured at zero" are indistinguishable, which is fine:
// both mean "earns nothing beyond commission/tips right now".
export const serializeStaffCompensation = (c: StaffCompensationDocument | null) => ({
  commissionRateBps: c?.commissionRateBps ?? 0,
  baseSalaryMinor: c?.baseSalaryMinor ?? 0,
  hourlyRateMinor: c?.hourlyRateMinor ?? 0,
  note: c?.note ?? null,
  updatedByUserId: c?.updatedByUserId ? String(c.updatedByUserId) : null,
});

export const serializeAttendanceRecord = (r: AttendanceRecordDocument) => ({
  id: String(r._id),
  branchId: String(r.branchId),
  staffId: String(r.staffId),
  clockIn: r.clockIn.toISOString(),
  clockOut: r.clockOut ? r.clockOut.toISOString() : null,
  note: r.note ?? null,
  claimed: r.payslipId !== null,
});

export const serializeStaffEarningEntry = (e: StaffEarningEntryDocument) => ({
  id: String(e._id),
  staffId: String(e.staffId),
  saleId: String(e.saleId),
  kind: e.kind,
  amountMinor: e.amountMinor,
  rateBps: e.rateBps,
  isReversal: e.reversalOfEntryId !== null,
  note: e.note ?? null,
  claimed: e.payslipId !== null,
  createdAt: createdAtOf(e),
});

export const serializePayslip = (p: PayslipDocument) => ({
  id: String(p._id),
  staffId: String(p.staffId),
  periodStart: p.periodStart.toISOString(),
  periodEnd: p.periodEnd.toISOString(),
  baseSalaryMinor: p.baseSalaryMinor,
  hourlyRateMinor: p.hourlyRateMinor,
  hoursWorked: p.hoursWorked,
  hourlyPayMinor: p.hourlyPayMinor,
  commissionMinor: p.commissionMinor,
  tipsMinor: p.tipsMinor,
  adjustments: p.adjustments.map((a) => ({ label: a.label, amountMinor: a.amountMinor, note: a.note ?? null })),
  grossMinor: p.grossMinor,
  adjustmentsTotalMinor: p.adjustmentsTotalMinor,
  netMinor: p.netMinor,
  paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  disbursementNote: p.disbursementNote ?? null,
  createdAt: createdAtOf(p),
});
