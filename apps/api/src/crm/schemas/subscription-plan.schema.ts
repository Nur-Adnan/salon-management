import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { LocalizedName, LocalizedNameSchema, MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ timestamps: true, collection: 'subscription_plans' })
export class SubscriptionPlan {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: LocalizedNameSchema, required: true })
  name!: LocalizedName;

  @Prop({ type: MoneyEmbedSchema, required: true })
  price!: MoneyEmbed;

  @Prop({ type: Number, required: true })
  billingPeriodDays!: number;

  // Advertised perk (shown on the plan card, e.g. "10% off"). NOT auto-applied
  // at POS checkout — stacking a membership discount with coupon logic is a
  // real design surface (order of application, interaction with maxDiscount)
  // that Phase 5's acceptance criteria doesn't require; wire it in deliberately
  // later rather than half-build the stacking rules now.
  @Prop({ type: Number, required: true, default: 0 })
  discountBps!: number;

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type SubscriptionPlanDocument = HydratedDocument<SubscriptionPlan>;
export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);
SubscriptionPlanSchema.index({ tenantId: 1, deletedAt: 1 });
