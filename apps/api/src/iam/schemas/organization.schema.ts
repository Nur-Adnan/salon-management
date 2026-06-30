import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@salon/shared';
import type { HydratedDocument } from 'mongoose';

export interface OrgSettings {
  locales: Locale[];
  defaultLocale: Locale;
  currency: 'BDT';
}

@Schema({ timestamps: true, collection: 'organizations' })
export class Organization {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ required: true, default: 'Asia/Dhaka' })
  timezone!: string;

  @Prop({
    type: Object,
    default: (): OrgSettings => ({
      locales: [...LOCALES],
      defaultLocale: DEFAULT_LOCALE,
      currency: 'BDT',
    }),
  })
  settings!: OrgSettings;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type OrganizationDocument = HydratedDocument<Organization>;
export const OrganizationSchema = SchemaFactory.createForClass(Organization);
