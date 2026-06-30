import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MEMBERSHIP_STATUS, type MembershipStatus, ROLES, type Role } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

// Ties a User to a (tenant, branch) with a role. branchId null = org-wide.
// An invite is a Membership with invitedEmail set and userId null until first login.
@Schema({ timestamps: true, collection: 'memberships' })
export class Membership {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  userId!: Types.ObjectId | null;

  @Prop({ type: String, lowercase: true, trim: true, default: null })
  invitedEmail!: string | null;

  @Prop({ type: Types.ObjectId, default: null })
  branchId!: Types.ObjectId | null;

  @Prop({ type: String, required: true, enum: [...ROLES] })
  role!: Role;

  @Prop({ type: String, required: true, default: 'active', enum: [...MEMBERSHIP_STATUS] })
  status!: MembershipStatus;
}

export type MembershipDocument = HydratedDocument<Membership>;
export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ tenantId: 1, userId: 1 });
MembershipSchema.index({ invitedEmail: 1 });
