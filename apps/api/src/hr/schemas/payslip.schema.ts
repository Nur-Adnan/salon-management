import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class PayslipAdjustment {
  @Prop({ type: String, required: true, trim: true })
  label!: string;

  // Signed — a bonus is positive, a deduction (e.g. an advance repayment) negative.
  @Prop({ type: Number, required: true })
  amountMinor!: number;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;
}
const PayslipAdjustmentSchema = SchemaFactory.createForClass(PayslipAdjustment);

// An immutable snapshot of one payroll run for one staff member, same
// philosophy as Sale: once created, the numbers on it never change — a
// correction after the fact is a new StaffEarningEntry reversal that lands on
// a LATER payslip, never an edit to this one.
@Schema({ timestamps: true, collection: 'payslips' })
export class Payslip {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  staffId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  periodStart!: Date;

  @Prop({ type: Date, required: true })
  periodEnd!: Date;

  // Compensation-profile snapshot at run time.
  @Prop({ type: Number, required: true })
  baseSalaryMinor!: number;

  @Prop({ type: Number, required: true })
  hourlyRateMinor!: number;

  @Prop({ type: Number, required: true })
  hoursWorked!: number; // decimal hours, Σ shiftHours() over claimed shifts

  @Prop({ type: Number, required: true })
  hourlyPayMinor!: number;

  @Prop({ type: Number, required: true })
  commissionMinor!: number;

  @Prop({ type: Number, required: true })
  tipsMinor!: number;

  @Prop({ type: [PayslipAdjustmentSchema], default: [] })
  adjustments!: PayslipAdjustment[];

  @Prop({ type: Number, required: true })
  grossMinor!: number;

  @Prop({ type: Number, required: true })
  adjustmentsTotalMinor!: number;

  // gross + adjustmentsTotal — CAN be negative (a large clawback with little
  // fresh pay that period). This records the true math; collecting a
  // negative balance is a business process outside this system's scope, same
  // as Phase 5's ledger-derived dueBalance can be any value.
  @Prop({ type: Number, required: true })
  netMinor!: number;

  @Prop({ type: Types.ObjectId, default: null })
  runByUserId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  @Prop({ type: String, trim: true, default: null })
  disbursementNote!: string | null;
}

export type PayslipDocument = HydratedDocument<Payslip>;
export const PayslipSchema = SchemaFactory.createForClass(Payslip);
PayslipSchema.index({ tenantId: 1, staffId: 1, createdAt: -1 });
// Exact-period duplicate runs fail fast with a clean conflict instead of
// double-paying; the claim mechanism (payslipId as a null-checked filter)
// protects against overlapping-but-not-identical periods regardless.
PayslipSchema.index({ tenantId: 1, staffId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
