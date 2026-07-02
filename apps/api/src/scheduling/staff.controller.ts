import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { User, type UserDocument } from '../iam/schemas/user.schema.js';

// Active staff (members) for the calendar / booking pickers.
@Controller('staff')
export class StaffController {
  constructor(
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  @Get()
  @CheckAbility('read', 'Appointment')
  async list() {
    const c = this.ctx.get();
    if (!c?.tenantId) throw new ForbiddenException('active tenant required');
    const tenantId = new Types.ObjectId(c.tenantId);
    const members = await this.memberships
      .find({ tenantId, status: 'active', userId: { $ne: null } })
      .exec();
    const roleByUser = new Map(members.map((m) => [String(m.userId), m.role]));
    const userIds = [...roleByUser.keys()].map((id) => new Types.ObjectId(id));
    const users = await this.users.find({ _id: { $in: userIds } }).exec();
    return users.map((u) => ({
      id: String(u._id),
      name: u.profile?.name ?? u.email.split('@')[0] ?? u.email,
      role: roleByUser.get(String(u._id)) ?? 'stylist',
    }));
  }
}
