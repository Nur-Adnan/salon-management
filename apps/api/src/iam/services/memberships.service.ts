import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { InviteMember } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../../common/context/request-context.service.js';
import { Membership, type MembershipDocument } from '../schemas/membership.schema.js';
import { User, type UserDocument } from '../schemas/user.schema.js';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('No active tenant');
    return new Types.ObjectId(t);
  }

  // If the invitee already exists, attach an active membership; otherwise leave a
  // pending invite that provisioning activates on their first login.
  async invite(dto: InviteMember): Promise<MembershipDocument> {
    const tenantId = this.tenantId();
    const email = dto.email.toLowerCase();
    const branchId = dto.branchId ? new Types.ObjectId(dto.branchId) : null;

    const existing = await this.users.findOne({ email }).exec();
    if (existing) {
      return this.memberships.create({
        tenantId,
        userId: existing._id,
        branchId,
        role: dto.role,
        status: 'active',
      });
    }
    return this.memberships.create({
      tenantId,
      invitedEmail: email,
      branchId,
      role: dto.role,
      status: 'invited',
    });
  }

  list(): Promise<MembershipDocument[]> {
    return this.memberships.find({ tenantId: this.tenantId() }).exec();
  }
}
