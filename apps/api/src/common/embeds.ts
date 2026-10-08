import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Reusable embedded value objects for catalog (and later POS) documents.

@Schema({ _id: false })
export class MoneyEmbed {
  @Prop({ type: Number, required: true })
  amount!: number; // integer minor units (poisha)

  @Prop({ type: String, required: true, default: 'BDT' })
  currency!: string;
}
export const MoneyEmbedSchema = SchemaFactory.createForClass(MoneyEmbed);

@Schema({ _id: false })
export class LocalizedName {
  @Prop({ type: String, required: true, trim: true })
  en!: string;

  @Prop({ type: String, trim: true })
  bn?: string;
}
export const LocalizedNameSchema = SchemaFactory.createForClass(LocalizedName);

export const serializeMoney = (m?: MoneyEmbed | null) => ({
  amount: m?.amount ?? 0,
  currency: m?.currency ?? 'BDT',
});
export const serializeName = (n?: LocalizedName | string | null) => {
  if (!n) return { en: '', bn: null };
  if (typeof n === 'string') return { en: n, bn: null };
  return { en: n.en ?? '', bn: n.bn ?? null };
};
