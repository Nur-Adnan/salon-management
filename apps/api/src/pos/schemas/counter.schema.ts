import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

// Atomic monotonic sequences (invoice numbers). `key` is e.g. `${tenantId}:invoice`;
// a findOneAndUpdate($inc) with upsert hands out gap-free-per-key numbers.
@Schema({ collection: 'counters' })
export class Counter {
  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({ type: Number, required: true, default: 0 })
  seq!: number;
}

export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);
