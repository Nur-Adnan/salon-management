import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GIFT_CARD_STATUS, type GiftCardStatus } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';
import { MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

// balance is a cache kept in lockstep with GiftCardLedgerEntry, same guarantee as
// LoyaltyAccount.balance: every mutation is a conditional `$inc` guarded by
// `balance: { $gte: amount }` — negative balances are structurally impossible.
@Schema({ timestamps: true, collection: 'gift_cards' })
export class GiftCard {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  code!: string;

  @Prop({ type: MoneyEmbedSchema, required: true })
  initialAmount!: MoneyEmbed;

  @Prop({ type: MoneyEmbedSchema, required: true })
  balance!: MoneyEmbed;

  @Prop({ type: String, required: true, default: 'active', enum: [...GIFT_CARD_STATUS] })
  status!: GiftCardStatus;

  @Prop({ type: Types.ObjectId, default: null })
  issuedToCustomerId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;
}

export type GiftCardDocument = HydratedDocument<GiftCard>;
export const GiftCardSchema = SchemaFactory.createForClass(GiftCard);
GiftCardSchema.index({ tenantId: 1, code: 1 }, { unique: true });
