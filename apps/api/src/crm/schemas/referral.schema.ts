import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { REFERRAL_STATUS, type ReferralStatus } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// Reward is granted on the referred customer's FIRST completed sale (see the
// SaleCompleted handler) — not at referral creation — so referring yourself
// with a burner customer earns nothing until real money moves.
@Schema({ timestamps: true, collection: 'referrals' })
export class Referral {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  referrerCustomerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  referredCustomerId!: Types.ObjectId;

  @Prop({ type: String, required: true, default: 'pending', enum: [...REFERRAL_STATUS] })
  status!: ReferralStatus;

  @Prop({ type: Number, required: true })
  rewardPoints!: number;

  @Prop({ type: Date, default: null })
  rewardedAt!: Date | null;

  // The sale whose completion triggered the reward — recorded so voidSale() can
  // find and reverse exactly this referral (reset to 'pending', claw the points
  // back) if that triggering sale is later voided. Null until rewarded.
  @Prop({ type: Types.ObjectId, default: null })
  rewardedSaleId!: Types.ObjectId | null;
}

export type ReferralDocument = HydratedDocument<Referral>;
export const ReferralSchema = SchemaFactory.createForClass(Referral);
ReferralSchema.index({ tenantId: 1, referredCustomerId: 1 }, { unique: true });
