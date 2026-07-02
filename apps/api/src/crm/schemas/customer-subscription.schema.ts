import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// `status` is staff-controlled only (active/cancelled — see enums.ts). Whether
// it's actually current/overdue is a DERIVED read from nextBillingDate via
// subscriptionBillingState (shared) — there is no scheduled job that flips a
// stored status, because no payment method here supports auto-charging yet
// (see docs/phase-5.md for the full rationale).
@Schema({ timestamps: true, collection: 'customer_subscriptions' })
export class CustomerSubscription {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  planId!: Types.ObjectId;

  @Prop({ type: String, required: true, default: 'active', enum: [...SUBSCRIPTION_STATUS] })
  status!: SubscriptionStatus;

  @Prop({ type: Date, required: true })
  currentPeriodStart!: Date;

  @Prop({ type: Date, required: true })
  nextBillingDate!: Date;
}

export type CustomerSubscriptionDocument = HydratedDocument<CustomerSubscription>;
export const CustomerSubscriptionSchema = SchemaFactory.createForClass(CustomerSubscription);
CustomerSubscriptionSchema.index({ tenantId: 1, customerId: 1 });
