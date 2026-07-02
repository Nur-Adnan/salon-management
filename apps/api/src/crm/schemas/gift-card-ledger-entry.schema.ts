import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LEDGER_ENTRY_TYPES, type LedgerEntryType } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';
import { MoneyEmbed, MoneyEmbedSchema } from '../../common/embeds.js';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'gift_card_ledger_entries' })
export class GiftCardLedgerEntry {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  giftCardId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: [...LEDGER_ENTRY_TYPES] })
  type!: LedgerEntryType;

  @Prop({ type: MoneyEmbedSchema, required: true })
  amount!: MoneyEmbed; // always positive; direction is implied by `type`

  @Prop({ type: Types.ObjectId, default: null })
  saleId!: Types.ObjectId | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;
}

export type GiftCardLedgerEntryDocument = HydratedDocument<GiftCardLedgerEntry>;
export const GiftCardLedgerEntrySchema = SchemaFactory.createForClass(GiftCardLedgerEntry);
GiftCardLedgerEntrySchema.index({ tenantId: 1, giftCardId: 1, createdAt: -1 });
