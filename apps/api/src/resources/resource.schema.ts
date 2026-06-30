import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { RESOURCE_TYPES, type ResourceType } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'resources' })
export class Resource {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, enum: [...RESOURCE_TYPES] })
  type!: ResourceType;

  @Prop({ required: true, default: 1 })
  capacity!: number;

  @Prop({ required: true, default: true })
  bookable!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type ResourceDocument = HydratedDocument<Resource>;
export const ResourceSchema = SchemaFactory.createForClass(Resource);
ResourceSchema.index({ tenantId: 1, branchId: 1, deletedAt: 1 });
