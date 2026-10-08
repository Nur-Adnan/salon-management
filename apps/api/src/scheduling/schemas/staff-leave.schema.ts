import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type LeaveStatus, LEAVE_STATUS } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'staff_leaves' })
export class StaffLeave {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  staffId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  startDate!: string; // YYYY-MM-DD

  @Prop({ type: String, required: true })
  endDate!: string; // YYYY-MM-DD

  @Prop({ type: String, trim: true, default: null })
  reason!: string | null;

  @Prop({ type: String, required: true, default: 'approved', enum: [...LEAVE_STATUS] })
  status!: LeaveStatus;

  @Prop({ type: Types.ObjectId, default: null })
  approvedBy!: Types.ObjectId | null;
}

export type StaffLeaveDocument = HydratedDocument<StaffLeave>;
export const StaffLeaveSchema = SchemaFactory.createForClass(StaffLeave);
StaffLeaveSchema.index({ tenantId: 1, staffId: 1, startDate: 1, endDate: 1 });
