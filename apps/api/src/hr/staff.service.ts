import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { SetCompensation } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { AbilityFactory } from '../iam/casl/ability.factory.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { assertSelfOrManage } from './authz.util.js';
import { StaffCompensation, type StaffCompensationDocument } from './schemas/staff-compensation.schema.js';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(StaffCompensation.name) private readonly compensation: Model<StaffCompensationDocument>,
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    private readonly ctx: RequestContextService,
    private readonly abilities: AbilityFactory,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  // Same shape as the checkout/booking `assertStaffMember` precedent
  // (tenant-scoped, not branch-scoped) — see docs/phase-6.md for why.
  async assertStaffMember(tenantId: Types.ObjectId, staffId: string): Promise<void> {
    const m = await this.memberships
      .findOne({ tenantId, userId: new Types.ObjectId(staffId), status: 'active' })
      .exec();
    if (!m) throw new BadRequestException('staff is not an active member of this tenant');
  }

  async get(staffId: string): Promise<StaffCompensationDocument | null> {
    const tenantId = this.tenantId();
    assertSelfOrManage(this.abilities.forCurrentContext(), 'Staff', this.ctx.get()?.userId ?? null, staffId);
    await this.assertStaffMember(tenantId, staffId);
    return this.compensation.findOne({ tenantId, userId: new Types.ObjectId(staffId) }).exec();
  }

  // Lazily upserted on first PATCH — most staff profiles start at all-zero
  // defaults and are never touched until a manager sets real numbers.
  async set(staffId: string, patch: SetCompensation): Promise<StaffCompensationDocument> {
    const tenantId = this.tenantId();
    const caller = this.ctx.get()?.userId ?? null;
    // Setting someone's OWN pay rate is never self-service, regardless of role.
    if (!this.abilities.forCurrentContext().can('manage', 'Staff')) {
      throw new ForbiddenException('only a manager can set compensation');
    }
    await this.assertStaffMember(tenantId, staffId);
    return this.compensation
      .findOneAndUpdate(
        { tenantId, userId: new Types.ObjectId(staffId) },
        { $set: { ...patch, updatedByUserId: caller ? new Types.ObjectId(caller) : null } },
        { upsert: true, new: true },
      )
      .exec();
  }
}
