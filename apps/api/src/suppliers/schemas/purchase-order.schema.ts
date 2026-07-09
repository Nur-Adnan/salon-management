import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PURCHASE_ORDER_STATUS, type PurchaseOrderStatus } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';
import { MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ _id: false })
export class PurchaseOrderLine {
  @Prop({ type: Types.ObjectId, required: true })
  productId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  quantity!: number;

  @Prop({ type: MoneyEmbedSchema, required: true })
  unitCost!: MoneyEmbed;
}
const PurchaseOrderLineSchema = SchemaFactory.createForClass(PurchaseOrderLine);

// Immutable once `received` (stock has moved) — no update path, mirroring Payslip.
@Schema({ timestamps: true, collection: 'purchase_orders' })
export class PurchaseOrder {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  supplierId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  poNumber!: string;

  @Prop({ type: String, required: true, default: 'draft', enum: [...PURCHASE_ORDER_STATUS] })
  status!: PurchaseOrderStatus;

  @Prop({ type: [PurchaseOrderLineSchema], default: [] })
  lines!: PurchaseOrderLine[];

  @Prop({ type: MoneyEmbedSchema, required: true })
  totalCost!: MoneyEmbed;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  createdByUserId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  receivedAt!: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type PurchaseOrderDocument = HydratedDocument<PurchaseOrder>;
export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
PurchaseOrderSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
PurchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
