import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DEFAULT_LOCALE, type Locale } from '@salon/shared';
import type { HydratedDocument } from 'mongoose';

export interface UserProfile {
  name?: string;
  locale: Locale;
}

// A User is GLOBAL (not tenant-scoped). Tenant access is expressed via Membership.
@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true })
  supabaseUserId!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: Object, default: (): UserProfile => ({ locale: DEFAULT_LOCALE }) })
  profile!: UserProfile;

  @Prop({ required: true, default: 'active', enum: ['active', 'disabled'] })
  status!: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
