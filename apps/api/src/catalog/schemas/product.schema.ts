import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';
import { LocalizedName, LocalizedNameSchema, MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  categoryId!: Types.ObjectId | null;

  @Prop({ type: LocalizedNameSchema, required: true })
  name!: LocalizedName;

  @Prop({ type: String, required: true, trim: true })
  sku!: string;

  @Prop({ type: String, trim: true, default: null })
  barcode!: string | null;

  @Prop({ type: MoneyEmbedSchema, required: true })
  retailPrice!: MoneyEmbed;

  @Prop({ type: MoneyEmbedSchema, required: true })
  cost!: MoneyEmbed;

  @Prop({ type: Boolean, default: true })
  taxable!: boolean;

  @Prop({ type: Boolean, default: false })
  expiryTracked!: boolean;

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

// Uniqueness PER TENANT, and only among non-deleted docs (so a soft-deleted SKU
// can be reused). barcode is optional -> only enforce when it is a string.
ProductSchema.index(
  { tenantId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
ProductSchema.index(
  { tenantId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: 'string' }, deletedAt: null } },
);
