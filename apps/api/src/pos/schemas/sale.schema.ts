import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  SALE_LINE_KINDS,
  SALE_STATUS,
  type PaymentMethod,
  type PaymentStatus,
  type SaleLineKind,
  type SalePaymentStatus,
  type SaleStatus,
} from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';
import { LocalizedName, LocalizedNameSchema, MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

// A sale line snapshots the catalog item (name + price + tax) at sale time so the
// receipt stays historically accurate even if the catalog later changes.
@Schema({ _id: false })
export class SaleLine {
  @Prop({ type: String, required: true, enum: [...SALE_LINE_KINDS] })
  kind!: SaleLineKind;

  @Prop({ type: Types.ObjectId, required: true })
  refId!: Types.ObjectId;

  @Prop({ type: LocalizedNameSchema, required: true })
  name!: LocalizedName;

  @Prop({ type: MoneyEmbedSchema, required: true })
  unitPrice!: MoneyEmbed;

  @Prop({ type: Number, required: true, default: 1 })
  quantity!: number;

  @Prop({ type: MoneyEmbedSchema, required: true })
  discount!: MoneyEmbed;

  @Prop({ type: Boolean, required: true, default: true })
  taxable!: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  taxRateBps!: number;

  @Prop({ type: MoneyEmbedSchema, required: true })
  tax!: MoneyEmbed;

  @Prop({ type: MoneyEmbedSchema, required: true })
  lineTotal!: MoneyEmbed;

  // Staff attribution (drives commission in Phase 6). Null for unattributed retail.
  @Prop({ type: Types.ObjectId, default: null })
  staffId!: Types.ObjectId | null;
}
const SaleLineSchema = SchemaFactory.createForClass(SaleLine);

@Schema({ _id: false })
export class Payment {
  @Prop({ type: String, required: true, enum: [...PAYMENT_METHODS] })
  method!: PaymentMethod;

  @Prop({ type: MoneyEmbedSchema, required: true })
  amount!: MoneyEmbed;

  @Prop({ type: String, required: true, default: 'pending', enum: [...PAYMENT_STATUS] })
  status!: PaymentStatus;

  @Prop({ type: String, default: null })
  providerRef!: string | null;

  @Prop({ type: Date, default: null })
  capturedAt!: Date | null;
}
const PaymentSchema = SchemaFactory.createForClass(Payment);

@Schema({ timestamps: true, collection: 'sales' })
export class Sale {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  customerId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  appointmentId!: Types.ObjectId | null;

  @Prop({ type: String, required: true })
  invoiceNumber!: string;

  @Prop({ type: [SaleLineSchema], default: [] })
  lines!: SaleLine[];

  @Prop({ type: MoneyEmbedSchema, required: true })
  subtotal!: MoneyEmbed;

  @Prop({ type: MoneyEmbedSchema, required: true })
  discountTotal!: MoneyEmbed;

  @Prop({ type: MoneyEmbedSchema, required: true })
  taxTotal!: MoneyEmbed;

  @Prop({ type: MoneyEmbedSchema, required: true })
  tip!: MoneyEmbed;

  @Prop({ type: MoneyEmbedSchema, required: true })
  total!: MoneyEmbed;

  @Prop({ type: [PaymentSchema], default: [] })
  payments!: Payment[];

  @Prop({ type: String, required: true, default: 'unpaid' })
  paymentStatus!: SalePaymentStatus;

  @Prop({ type: String, required: true, default: 'completed', enum: [...SALE_STATUS] })
  status!: SaleStatus;

  // The cashier who rang the sale.
  @Prop({ type: Types.ObjectId, default: null })
  soldByUserId!: Types.ObjectId | null;

  // Durable idempotency guarantee (Redis replay is the fast path; this unique
  // index is the hard one — a replayed checkout can never create a second sale).
  @Prop({ type: String, default: null })
  idempotencyKey!: string | null;

  // Audit trail only — the discount itself is already folded into each line's
  // `discount`/`lineTotal` (see applyCoupon in @salon/shared), so discountTotal
  // above already reflects it without a separate "coupon amount" field.
  @Prop({ type: String, default: null })
  couponCode!: string | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: String, trim: true, default: null })
  voidReason!: string | null;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type SaleDocument = HydratedDocument<Sale>;
export const SaleSchema = SchemaFactory.createForClass(Sale);

SaleSchema.index({ tenantId: 1, branchId: 1, createdAt: -1 });
// Invoice numbers are unique per tenant.
SaleSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
// One sale per (tenant, idempotencyKey); only enforced when a key is present.
SaleSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
