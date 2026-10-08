import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ timestamps: true, collection: 'branch_price_overrides' })
export class BranchPriceOverride {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['service', 'product'] })
  itemType!: 'service' | 'product';

  @Prop({ type: Types.ObjectId, required: true, index: true })
  itemId!: Types.ObjectId;

  @Prop({ type: MoneyEmbedSchema, required: true })
  price!: MoneyEmbed;
}

export type BranchPriceOverrideDocument = HydratedDocument<BranchPriceOverride>;
export const BranchPriceOverrideSchema = SchemaFactory.createForClass(BranchPriceOverride);

BranchPriceOverrideSchema.index(
  { tenantId: 1, branchId: 1, itemType: 1, itemId: 1 },
  { unique: true },
);
