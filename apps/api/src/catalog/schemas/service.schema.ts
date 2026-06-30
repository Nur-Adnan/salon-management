import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { RESOURCE_TYPES, type ResourceType } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';
import { LocalizedName, LocalizedNameSchema, MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ timestamps: true, collection: 'services' })
export class Service {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  categoryId!: Types.ObjectId | null;

  @Prop({ type: LocalizedNameSchema, required: true })
  name!: LocalizedName;

  @Prop({ type: Number, required: true })
  durationMin!: number;

  @Prop({ type: Number, default: 0 })
  bufferBeforeMin!: number;

  @Prop({ type: Number, default: 0 })
  bufferAfterMin!: number;

  @Prop({ type: MoneyEmbedSchema, required: true })
  price!: MoneyEmbed;

  @Prop({ type: Boolean, default: true })
  taxable!: boolean;

  @Prop({ type: [String], default: [], enum: [...RESOURCE_TYPES] })
  eligibleResourceTypes!: ResourceType[];

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type ServiceDocument = HydratedDocument<Service>;
export const ServiceSchema = SchemaFactory.createForClass(Service);
ServiceSchema.index({ tenantId: 1, categoryId: 1, deletedAt: 1 });
