import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class SupplierContact {
  @Prop({ type: String, trim: true, default: null })
  phone!: string | null;

  @Prop({ type: String, trim: true, default: null })
  email!: string | null;
}
const SupplierContactSchema = SchemaFactory.createForClass(SupplierContact);

@Schema({ timestamps: true, collection: 'suppliers' })
export class Supplier {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: SupplierContactSchema, default: () => ({}) })
  contact!: SupplierContact;

  @Prop({ type: String, trim: true, default: null })
  address!: string | null;

  @Prop({ type: String, trim: true, default: null })
  note!: string | null;

  @Prop({ type: Boolean, default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type SupplierDocument = HydratedDocument<Supplier>;
export const SupplierSchema = SchemaFactory.createForClass(Supplier);
// Supplier names are unique per tenant; a soft-deleted name is reusable.
SupplierSchema.index({ tenantId: 1, name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
