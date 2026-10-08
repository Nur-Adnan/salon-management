import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { STOCK_TRANSFER_STATUS, type StockTransferStatus } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class StockTransferLine {
  @Prop({ type: Types.ObjectId, required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  quantity!: number;

  @Prop({ type: String, trim: true, default: null })
  batchNumber!: string | null;
}
export const StockTransferLineSchema = SchemaFactory.createForClass(StockTransferLine);

@Schema({ timestamps: true, collection: 'stock_transfers' })
export class StockTransfer {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  transferNumber!: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  fromBranchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  toBranchId!: Types.ObjectId;

  @Prop({ type: String, required: true, default: 'draft', enum: [...STOCK_TRANSFER_STATUS] })
  status!: StockTransferStatus;

  @Prop({ type: [StockTransferLineSchema], required: true })
  lines!: StockTransferLine[];

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  createdById!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  shippedAt!: Date | null;

  @Prop({ type: Date, default: null })
  receivedAt!: Date | null;
}

export type StockTransferDocument = HydratedDocument<StockTransfer>;
export const StockTransferSchema = SchemaFactory.createForClass(StockTransfer);

StockTransferSchema.index({ tenantId: 1, transferNumber: 1 }, { unique: true });
StockTransferSchema.index({ tenantId: 1, fromBranchId: 1, toBranchId: 1, status: 1 });
