import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

// balance is a CACHE, always written in lockstep (same transaction) with a
// LoyaltyLedgerEntry — the ledger is the source of truth, this is what makes
// reads fast. Every mutation to balance is a conditional `$inc` guarded by
// `balance: { $gte: n }` (see LoyaltyService), which is what makes "never
// negative" a structural guarantee rather than an application-level check.
@Schema({ timestamps: true, collection: 'loyalty_accounts' })
export class LoyaltyAccount {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Number, required: true, default: 0 })
  balance!: number; // points
}

export type LoyaltyAccountDocument = HydratedDocument<LoyaltyAccount>;
export const LoyaltyAccountSchema = SchemaFactory.createForClass(LoyaltyAccount);
LoyaltyAccountSchema.index({ tenantId: 1, customerId: 1 }, { unique: true });
