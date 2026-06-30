import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { LocalizedName, LocalizedNameSchema } from '../../common/embeds.js';

@Schema({ timestamps: true, collection: 'product_categories' })
export class ProductCategory {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: LocalizedNameSchema, required: true })
  name!: LocalizedName;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type ProductCategoryDocument = HydratedDocument<ProductCategory>;
export const ProductCategorySchema = SchemaFactory.createForClass(ProductCategory);
ProductCategorySchema.index({ tenantId: 1, deletedAt: 1 });
