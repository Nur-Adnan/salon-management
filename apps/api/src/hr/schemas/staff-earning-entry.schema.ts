import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { STAFF_EARNING_KINDS, type StaffEarningKind } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// Commission and tip share one ledger — unlike Loyalty/GiftCard (Phase 5),
// which stayed separate because they're never consumed together, every
// payroll run needs BOTH kinds summed for the same staff member in the same
// pass, so one collection with a `kind` discriminator is simpler than two.
//
// `payslipId` doubles as claim state (null = unclaimed, matching
// AttendanceRecord). A void doesn't mutate or delete a past entry — it
// creates a same-kind entry with a NEGATED amount, so the next payroll run's
// claim-and-sum nets it out automatically whether or not the original was
// already paid (see the SaleVoided handler). This means reversal has no
// paid/unpaid branch to get wrong.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'staff_earning_entries' })
export class StaffEarningEntry {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  staffId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  saleId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: [...STAFF_EARNING_KINDS] })
  kind!: StaffEarningKind;

  // Signed — always positive on the original entry; a reversal is the exact
  // negative of the entry it reverses.
  @Prop({ type: Number, required: true })
  amountMinor!: number;

  // Commission rate captured AT THE TIME THE ENTRY WAS CREATED (effectively
  // sale time, since this is written by the SaleCompleted handler) — the same
  // historical-snapshot principle as SaleLine.taxRateBps. Null for tip entries.
  @Prop({ type: Number, default: null })
  rateBps!: number | null;

  @Prop({ type: Types.ObjectId, default: null })
  reversalOfEntryId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  payslipId!: Types.ObjectId | null;
}

export type StaffEarningEntryDocument = HydratedDocument<StaffEarningEntry>;
export const StaffEarningEntrySchema = SchemaFactory.createForClass(StaffEarningEntry);
StaffEarningEntrySchema.index({ tenantId: 1, staffId: 1, payslipId: 1 });
// One original entry per (sale, staff, kind) — makes the SaleCompleted
// handler idempotent against event redelivery. Reversals are exempt (they
// share the same (sale, staff, kind) as what they reverse).
StaffEarningEntrySchema.index(
  { tenantId: 1, saleId: 1, staffId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { reversalOfEntryId: null } },
);
// At most one reversal per original entry — makes the SaleVoided handler
// idempotent against event redelivery too.
StaffEarningEntrySchema.index(
  { tenantId: 1, reversalOfEntryId: 1 },
  { unique: true, partialFilterExpression: { reversalOfEntryId: { $type: 'objectId' } } },
);
