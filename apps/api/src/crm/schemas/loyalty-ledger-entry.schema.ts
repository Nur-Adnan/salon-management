import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LEDGER_ENTRY_TYPES, type LedgerEntryType } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// The audit trail behind LoyaltyAccount.balance — recomputable (sum of points,
// signed by type) even though the account caches a running balance for speed.
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'loyalty_ledger_entries' })
export class LoyaltyLedgerEntry {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  accountId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  customerId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: [...LEDGER_ENTRY_TYPES] })
  type!: LedgerEntryType;

  @Prop({ type: Number, required: true })
  points!: number; // always positive; direction is implied by `type`

  @Prop({ type: Types.ObjectId, default: null })
  saleId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;
}

export type LoyaltyLedgerEntryDocument = HydratedDocument<LoyaltyLedgerEntry>;
export const LoyaltyLedgerEntrySchema = SchemaFactory.createForClass(LoyaltyLedgerEntry);
LoyaltyLedgerEntrySchema.index({ tenantId: 1, accountId: 1, createdAt: -1 });
// One 'earn' entry per sale (idempotent against event redelivery/replay); a sale
// can also have at most one 'redeem' entry from checkout.
LoyaltyLedgerEntrySchema.index(
  { tenantId: 1, saleId: 1, type: 1 },
  { unique: true, partialFilterExpression: { saleId: { $type: 'objectId' } } },
);
