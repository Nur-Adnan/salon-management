import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { STOCK_MOVEMENT_REASONS, type StockMovementReason } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// Append-only audit trail behind StockLevel.qtyOnHand — the SOURCE OF TRUTH the
// cached qtyOnHand is derived from (same cache+ledger pattern as loyalty). Every
// stock change writes exactly one movement per (operation, product) via
// applyStockDelta. Never updated, never deleted.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'stock_movements' })
export class StockMovement {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  productId!: Types.ObjectId;

  // Signed: negative for a sale/negative-adjustment, positive for a purchase/void.
  @Prop({ type: Number, required: true })
  qtyDelta!: number;

  @Prop({ type: String, required: true, enum: [...STOCK_MOVEMENT_REASONS] })
  reason!: StockMovementReason;

  // The originating document: refType 'sale' | 'purchase_order' | 'adjustment'.
  @Prop({ type: String, required: true })
  refType!: string;

  @Prop({ type: Types.ObjectId, required: true })
  refId!: Types.ObjectId;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;
}

export type StockMovementDocument = HydratedDocument<StockMovement>;
export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);

StockMovementSchema.index({ tenantId: 1, branchId: 1, productId: 1, createdAt: -1 });
StockMovementSchema.index({ tenantId: 1, refType: 1, refId: 1 });
// Idempotency: at most one movement per (op, product, reason). Requires callers
// to aggregate deltas by product before emitting (checkout's productQtys map;
// PO receipt aggregation) — a transaction retry's re-insert is then a caught
// duplicate-key no-op, same technique as the HR reversal entries.
StockMovementSchema.index(
  { tenantId: 1, refType: 1, refId: 1, productId: 1, reason: 1 },
  { unique: true },
);
