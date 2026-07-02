import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'customers' })
export class Customer {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true })
  phone!: string;

  @Prop({ type: String, trim: true, default: null })
  email!: string | null;

  @Prop({ type: String, default: 'en' })
  locale!: string;

  // --- Phase 5: CRM ---

  @Prop({ type: Types.ObjectId, default: null })
  preferredStaffId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  preferenceNotes!: string | null;

  // Persistent, cumulative (distinct from a single TreatmentRecord's per-visit notes).
  @Prop({ type: [String], default: [] })
  allergies!: string[];

  // Lazily generated on first use (getOrCreateReferralCode) — most customers never
  // refer anyone, so most never get a code.
  @Prop({ type: String, default: null })
  referralCode!: string | null;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ tenantId: 1, phone: 1 });
CustomerSchema.index(
  { tenantId: 1, referralCode: 1 },
  { unique: true, partialFilterExpression: { referralCode: { $type: 'string' } } },
);
