import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

// Minimal per-branch stock-on-hand. POS decrements this atomically inside the
// checkout transaction (and re-increments it on void). Full inventory — batches,
// stock movements, reorder points, purchase orders — is Phase 7.
// ponytail: qtyOnHand only; batches/expiry/movements land with the Inventory module.
@Schema({ timestamps: true, collection: 'stock_levels' })
export class StockLevel {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 0 })
  qtyOnHand!: number;
}

export type StockLevelDocument = HydratedDocument<StockLevel>;
export const StockLevelSchema = SchemaFactory.createForClass(StockLevel);

// One stock row per product per branch.
StockLevelSchema.index({ tenantId: 1, branchId: 1, productId: 1 }, { unique: true });
