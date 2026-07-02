import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class WorkingDay {
  @Prop({ type: Boolean, default: false })
  closed!: boolean;

  @Prop({ type: String, default: '09:00' })
  open!: string; // "HH:MM" local time

  @Prop({ type: String, default: '21:00' })
  close!: string;
}
const WorkingDaySchema = SchemaFactory.createForClass(WorkingDay);

// Sun..Sat, all open 09:00-21:00 by default.
export const defaultWorkingHours = (): WorkingDay[] =>
  Array.from({ length: 7 }, () => ({ closed: false, open: '09:00', close: '21:00' }));

@Schema({ timestamps: true, collection: 'branches' })
export class Branch {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, default: 'Asia/Dhaka' })
  timezone!: string;

  @Prop({ type: String, trim: true })
  address?: string;

  @Prop({ required: true, default: 'active', enum: ['active', 'inactive'] })
  status!: string;

  // Booking grid granularity (minutes) and weekly hours (index 0 = Sunday).
  @Prop({ type: Number, default: 15 })
  slotMinutes!: number;

  @Prop({ type: [WorkingDaySchema], default: defaultWorkingHours })
  workingHours!: WorkingDay[];

  // VAT rate in basis points (1500 = 15%). 0 = not VAT-registered (POS adds no tax).
  @Prop({ type: Number, default: 0 })
  vatRateBps!: number;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type BranchDocument = HydratedDocument<Branch>;
export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ tenantId: 1, deletedAt: 1 });
