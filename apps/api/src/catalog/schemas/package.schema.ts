import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { PackageItemKind } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';
import { LocalizedName, LocalizedNameSchema, MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ _id: false })
export class PackageItem {
  @Prop({ type: String, required: true })
  kind!: PackageItemKind; // 'service' | 'product'

  @Prop({ type: Types.ObjectId, required: true })
  refId!: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 1 })
  quantity!: number;
}
const PackageItemSchema = SchemaFactory.createForClass(PackageItem);

@Schema({ timestamps: true, collection: 'packages' })
export class Package {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: LocalizedNameSchema, required: true })
  name!: LocalizedName;

  @Prop({ type: [PackageItemSchema], default: [] })
  items!: PackageItem[];

  @Prop({ type: MoneyEmbedSchema, required: true })
  price!: MoneyEmbed;

  @Prop({ type: Number, default: 90 })
  validityDays!: number;

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type PackageDocument = HydratedDocument<Package>;
export const PackageSchema = SchemaFactory.createForClass(Package);
PackageSchema.index({ tenantId: 1, deletedAt: 1 });
