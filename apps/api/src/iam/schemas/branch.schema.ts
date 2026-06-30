import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'branches' })
export class Branch {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, default: 'Asia/Dhaka' })
  timezone!: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ required: true, default: 'active', enum: ['active', 'inactive'] })
  status!: string;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type BranchDocument = HydratedDocument<Branch>;
export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ tenantId: 1, deletedAt: 1 });
