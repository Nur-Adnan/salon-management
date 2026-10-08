import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PaymentTransactionStatus =
  | 'initiated'
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded';

@Schema({ timestamps: true, collection: 'payment_transactions' })
export class PaymentTransaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false, index: true })
  saleId?: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  method!: string; // 'bkash' | 'nagad' | 'sslcommerz' | 'card' | 'cash'

  @Prop({ type: Number, required: true })
  amountMinor!: number;

  @Prop({ type: String, default: 'BDT' })
  currency!: string;

  @Prop({ type: String, required: false, index: true })
  providerRef?: string; // paymentID, tran_id, etc.

  @Prop({ type: String, required: false, index: true })
  gatewayTrxId?: string; // final bank/wallet transaction ID

  @Prop({
    type: String,
    enum: ['initiated', 'pending', 'authorized', 'captured', 'failed', 'refunded'],
    default: 'initiated',
    index: true,
  })
  status!: PaymentTransactionStatus;

  @Prop({ type: String, required: false, index: true })
  idempotencyKey?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  metadata?: Record<string, unknown>;

  @Prop({ type: String, required: false })
  failureReason?: string;

  @Prop({ type: Date, required: false })
  refundedAt?: Date;

  @Prop({ type: Number, required: false })
  refundedAmountMinor?: number;
}

export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;
export const PaymentTransactionSchema = SchemaFactory.createForClass(PaymentTransaction);

// Compound indexes for audit and reconciliation
PaymentTransactionSchema.index({ tenantId: 1, providerRef: 1 });
PaymentTransactionSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
PaymentTransactionSchema.index({ tenantId: 1, createdAt: -1 });
