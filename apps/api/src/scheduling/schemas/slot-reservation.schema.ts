import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

// One doc per (holder, grid-slot) that an appointment occupies. The unique index
// is THE double-booking guarantee: two concurrent bookings racing for the same
// staff/resource slot cannot both insert — one gets E11000 and is rejected.
@Schema({ timestamps: true, collection: 'slot_reservations' })
export class SlotReservation {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['staff', 'resource'] })
  holderType!: 'staff' | 'resource';

  @Prop({ type: Types.ObjectId, required: true })
  holderId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  slotStart!: Date;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  appointmentId!: Types.ObjectId;
}

export type SlotReservationDocument = HydratedDocument<SlotReservation>;
export const SlotReservationSchema = SchemaFactory.createForClass(SlotReservation);
SlotReservationSchema.index(
  { tenantId: 1, branchId: 1, holderType: 1, holderId: 1, slotStart: 1 },
  { unique: true },
);
