import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { MembershipView } from '../../common/context/request-context.service';
import { Membership, type MembershipDocument } from '../schemas/membership.schema';
import { User, type UserDocument } from '../schemas/user.schema';
import type { SupabaseJwtPayload } from './supabase-jwt.strategy';

@Injectable()
export class ProvisioningService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
  ) {}

  // Upsert the user on first sight, activate any pending invitations for their
  // email, and return their active memberships for scope resolution.
  async provisionAndLoad(
    payload: SupabaseJwtPayload,
  ): Promise<{ user: UserDocument; memberships: MembershipView[] }> {
    const email = (payload.email ?? '').toLowerCase();

    const user = await this.users
      .findOneAndUpdate(
        { supabaseUserId: payload.sub },
        { $setOnInsert: { supabaseUserId: payload.sub, email }, $set: { email } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (email) {
      await this.memberships
        .updateMany(
          { invitedEmail: email, userId: null, status: 'invited' },
          { $set: { userId: user._id, status: 'active', invitedEmail: null } },
        )
        .exec();
    }

    const active = await this.memberships.find({ userId: user._id, status: 'active' }).exec();
    const views: MembershipView[] = active.map((m) => ({
      tenantId: m.tenantId.toString(),
      branchId: m.branchId ? m.branchId.toString() : null,
      role: m.role,
    }));

    return { user, memberships: views };
  }
}
