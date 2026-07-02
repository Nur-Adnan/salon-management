import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUS,
  type AppointmentSource,
  type AppointmentStatus,
} from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';
import { MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ _id: false })
export class AppointmentLine {
  @Prop({ type: Types.ObjectId, required: true })
  serviceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  staffId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  resourceId!: Types.ObjectId | null;

  @Prop({ type: Date, required: true })
  start!: Date;

  @Prop({ type: Date, required: true })
  end!: Date;
}
const AppointmentLineSchema = SchemaFactory.createForClass(AppointmentLine);

@Schema({ timestamps: true, collection: 'appointments' })
export class Appointment {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  customerId!: Types.ObjectId;

  @Prop({ type: [AppointmentLineSchema], default: [] })
  lines!: AppointmentLine[];

  @Prop({ type: String, required: true, default: 'booked', enum: [...APPOINTMENT_STATUS] })
  status!: AppointmentStatus;

  @Prop({ type: String, required: true, default: 'walk_in', enum: [...APPOINTMENT_SOURCES] })
  source!: AppointmentSource;

  @Prop({ type: MoneyEmbedSchema, default: () => ({ amount: 0, currency: 'BDT' }) })
  depositAmount!: MoneyEmbed;

  @Prop({ type: String, trim: true, default: null })
  notes!: string | null;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type AppointmentDocument = HydratedDocument<Appointment>;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index({ tenantId: 1, branchId: 1, status: 1, deletedAt: 1 });
AppointmentSchema.index({ tenantId: 1, branchId: 1, 'lines.start': 1 });
