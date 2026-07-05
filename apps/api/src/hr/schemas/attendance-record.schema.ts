import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

// A shift: clockIn is set on creation, clockOut is set once by clock-out.
// `payslipId` doubles as its claim state (null = unclaimed) — the same
// mechanism StaffEarningEntry uses — so a payroll run can atomically sweep up
// every closed, unclaimed shift with one findOneAndUpdate-style claim, no
// separate status enum to keep in sync.
@Schema({ timestamps: true, collection: 'attendance_records' })
export class AttendanceRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  staffId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  clockIn!: Date;

  @Prop({ type: Date, default: null })
  clockOut!: Date | null;

  // Who created this record — the staff member themself (self clock-in) or a
  // front-desk/manager entry on someone else's behalf.
  @Prop({ type: Types.ObjectId, default: null })
  recordedByUserId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  payslipId!: Types.ObjectId | null;
}

export type AttendanceRecordDocument = HydratedDocument<AttendanceRecord>;
export const AttendanceRecordSchema = SchemaFactory.createForClass(AttendanceRecord);
AttendanceRecordSchema.index({ tenantId: 1, staffId: 1, clockOut: 1 });
// At most one OPEN shift per staff member — structurally impossible to
// double clock-in, no read-then-write race to get wrong.
AttendanceRecordSchema.index(
  { tenantId: 1, staffId: 1 },
  { unique: true, partialFilterExpression: { clockOut: null } },
);
