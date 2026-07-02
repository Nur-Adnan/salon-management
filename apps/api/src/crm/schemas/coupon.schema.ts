import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { COUPON_TYPE, type CouponType } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'coupons' })
export class Coupon {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ type: String, required: true, enum: [...COUPON_TYPE] })
  type!: CouponType;

  @Prop({ type: Number, required: true })
  value!: number; // percent: basis points ; fixed: minor units

  @Prop({ type: Number, default: null })
  maxDiscount!: number | null; // percent-only cap, minor units

  @Prop({ type: Number, required: true, default: 0 })
  minSpend!: number; // minor units, pre-coupon net subtotal

  @Prop({ type: Number, default: null })
  maxRedemptions!: number | null;

  // Redemption-count is incremented atomically ($inc guarded by
  // redeemedCount < maxRedemptions) inside the checkout transaction — this is
  // what makes a limited-use coupon concurrency-safe, same pattern as balances.
  @Prop({ type: Number, required: true, default: 0 })
  redeemedCount!: number;

  @Prop({ type: Date, default: null })
  activeFrom!: Date | null;

  @Prop({ type: Date, default: null })
  activeUntil!: Date | null;

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type CouponDocument = HydratedDocument<Coupon>;
export const CouponSchema = SchemaFactory.createForClass(Coupon);
CouponSchema.index(
  { tenantId: 1, code: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
