import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { WAITLIST_STATUS, type WaitlistStatus } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'waitlist' })
export class WaitlistEntry {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  serviceId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  staffId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  desiredDate!: string | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: String, required: true, default: 'waiting', enum: [...WAITLIST_STATUS] })
  status!: WaitlistStatus;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type WaitlistEntryDocument = HydratedDocument<WaitlistEntry>;
export const WaitlistEntrySchema = SchemaFactory.createForClass(WaitlistEntry);
WaitlistEntrySchema.index({ tenantId: 1, branchId: 1, status: 1, deletedAt: 1 });
