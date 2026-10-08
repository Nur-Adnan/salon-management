import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class ShiftBreak {
  @Prop({ type: String, required: true })
  start!: string; // HH:mm format

  @Prop({ type: String, required: true })
  end!: string; // HH:mm format

  @Prop({ type: String, trim: true, default: null })
  description!: string | null;
}
export const ShiftBreakSchema = SchemaFactory.createForClass(ShiftBreak);

@Schema({ timestamps: true, collection: 'staff_shifts' })
export class StaffShift {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  staffId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0, max: 6 })
  dayOfWeek!: number; // 0=Sun..6=Sat

  @Prop({ type: String, required: true })
  open!: string; // HH:mm format

  @Prop({ type: String, required: true })
  close!: string; // HH:mm format

  @Prop({ type: [ShiftBreakSchema], default: [] })
  breaks!: ShiftBreak[];

  @Prop({ type: Boolean, default: false })
  isOff!: boolean;
}

export type StaffShiftDocument = HydratedDocument<StaffShift>;
export const StaffShiftSchema = SchemaFactory.createForClass(StaffShift);
StaffShiftSchema.index({ tenantId: 1, branchId: 1, staffId: 1, dayOfWeek: 1 }, { unique: true });
