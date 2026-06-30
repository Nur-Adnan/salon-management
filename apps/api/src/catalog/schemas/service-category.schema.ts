import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { LocalizedName, LocalizedNameSchema } from '../../common/embeds.js';

@Schema({ timestamps: true, collection: 'service_categories' })
export class ServiceCategory {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: LocalizedNameSchema, required: true })
  name!: LocalizedName;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type ServiceCategoryDocument = HydratedDocument<ServiceCategory>;
export const ServiceCategorySchema = SchemaFactory.createForClass(ServiceCategory);
ServiceCategorySchema.index({ tenantId: 1, deletedAt: 1 });
