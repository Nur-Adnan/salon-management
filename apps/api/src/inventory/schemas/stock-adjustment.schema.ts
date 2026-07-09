import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { STOCK_ADJUSTMENT_REASONS, type StockAdjustmentReason } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// A manual stock correction (recount/wastage/damage/correction). Writing one
// performs the atomic stock change + a StockMovement (reason 'adjustment') in a
// single transaction, so the adjustment record and the ledger never diverge.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'stock_adjustments' })
export class StockAdjustment {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  qtyDelta!: number; // signed, non-zero

  @Prop({ type: String, required: true, enum: [...STOCK_ADJUSTMENT_REASONS] })
  reason!: StockAdjustmentReason;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  createdByUserId!: Types.ObjectId | null;
}

export type StockAdjustmentDocument = HydratedDocument<StockAdjustment>;
export const StockAdjustmentSchema = SchemaFactory.createForClass(StockAdjustment);
StockAdjustmentSchema.index({ tenantId: 1, branchId: 1, productId: 1, createdAt: -1 });
