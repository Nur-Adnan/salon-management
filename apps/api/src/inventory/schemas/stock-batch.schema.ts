import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'stock_batches' })
export class StockBatch {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  batchNumber!: string;

  @Prop({ type: Date, required: true })
  expiryDate!: Date;

  @Prop({ type: Number, required: true, default: 0 })
  qtyOnHand!: number;

  @Prop({ type: Number, required: true, default: 0 })
  unitCostMinor!: number;
}

export type StockBatchDocument = HydratedDocument<StockBatch>;
export const StockBatchSchema = SchemaFactory.createForClass(StockBatch);

StockBatchSchema.index({ tenantId: 1, branchId: 1, productId: 1, batchNumber: 1 }, { unique: true });
StockBatchSchema.index({ tenantId: 1, branchId: 1, productId: 1, expiryDate: 1 });
