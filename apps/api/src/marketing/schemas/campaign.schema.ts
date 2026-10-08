import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_STATUS,
  type CampaignChannel,
  type CampaignStatus,
  type CustomerSegmentFilter,
} from '@salon/shared';
import { type HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class CampaignStats {
  @Prop({ type: Number, default: 0 })
  totalTargeted!: number;

  @Prop({ type: Number, default: 0 })
  sent!: number;

  @Prop({ type: Number, default: 0 })
  failed!: number;

  @Prop({ type: Number, default: 0 })
  optedOut!: number;
}
const CampaignStatsSchema = SchemaFactory.createForClass(CampaignStats);

@Schema({ timestamps: true, collection: 'campaigns' })
export class Campaign {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  branchId!: Types.ObjectId | null;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, enum: [...CAMPAIGN_CHANNELS] })
  channel!: CampaignChannel;

  @Prop({
    type: String,
    required: true,
    enum: ['broadcast', 'coupon', 'gift_card', 'seasonal'],
    default: 'broadcast',
  })
  type!: 'broadcast' | 'coupon' | 'gift_card' | 'seasonal';

  @Prop({ type: String, required: true, default: 'draft', enum: [...CAMPAIGN_STATUS], index: true })
  status!: CampaignStatus;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  filter!: CustomerSegmentFilter;

  @Prop({ type: String, required: true })
  messageTemplate!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Customer' }], default: [] })
  audienceSnapshot!: Types.ObjectId[];

  @Prop({ type: String, trim: true, default: null })
  couponCode!: string | null;

  @Prop({ type: Date, default: null })
  scheduledAt!: Date | null;

  @Prop({ type: Date, default: null })
  executedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: CampaignStatsSchema, default: () => ({ totalTargeted: 0, sent: 0, failed: 0, optedOut: 0 }) })
  stats!: CampaignStats;

  @Prop({ type: String, required: true, trim: true })
  idempotencyKey!: string;
}

export type CampaignDocument = HydratedDocument<Campaign>;
export const CampaignSchema = SchemaFactory.createForClass(Campaign);

CampaignSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
CampaignSchema.index({ tenantId: 1, createdAt: -1 });
