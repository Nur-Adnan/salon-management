import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  staffLeaveSchema,
  staffShiftSchema,
  type StaffLeaveInput,
  type StaffShiftInput,
} from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { User, type UserDocument } from '../iam/schemas/user.schema.js';
import { StaffLeave, type StaffLeaveDocument } from './schemas/staff-leave.schema.js';
import { StaffShift, type StaffShiftDocument } from './schemas/staff-shift.schema.js';

// Active staff (members) for the calendar / booking pickers + shift & leave management.
@Controller('staff')
export class StaffController {
  constructor(
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(StaffShift.name) private readonly shifts: Model<StaffShiftDocument>,
    @InjectModel(StaffLeave.name) private readonly leaves: Model<StaffLeaveDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const c = this.ctx.get();
    if (!c?.tenantId) throw new ForbiddenException('active tenant required');
    return new Types.ObjectId(c.tenantId);
  }

  @Get()
  @CheckAbility('read', 'Appointment')
  async list() {
    const tenantId = this.tenantId();
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

  @Get('shifts')
  @CheckAbility('read', 'Appointment')
  async listShifts(@Query('staffId') staffId?: string, @Query('branchId') branchId?: string) {
    const tenantId = this.tenantId();
    const filter: Record<string, unknown> = { tenantId };
    if (staffId) filter.staffId = new Types.ObjectId(staffId);
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const docs = await this.shifts.find(filter).sort({ dayOfWeek: 1 }).exec();
    return docs.map((d) => ({
      id: String(d._id),
      staffId: String(d.staffId),
      branchId: String(d.branchId),
      dayOfWeek: d.dayOfWeek,
      open: d.open,
      close: d.close,
      breaks: d.breaks,
      isOff: d.isOff,
    }));
  }

  @Put('shifts')
  @CheckAbility('manage', 'Staff')
  async upsertShift(@Body(new ZodValidationPipe(staffShiftSchema)) dto: StaffShiftInput) {
    const tenantId = this.tenantId();
    const staffId = new Types.ObjectId(dto.staffId);
    const branchId = new Types.ObjectId(dto.branchId);

    const doc = await this.shifts
      .findOneAndUpdate(
        { tenantId, branchId, staffId, dayOfWeek: dto.dayOfWeek },
        {
          open: dto.open,
          close: dto.close,
          breaks: dto.breaks,
          isOff: dto.isOff,
        },
        { upsert: true, new: true },
      )
      .exec();

    return {
      id: String(doc._id),
      staffId: String(doc.staffId),
      branchId: String(doc.branchId),
      dayOfWeek: doc.dayOfWeek,
      open: doc.open,
      close: doc.close,
      breaks: doc.breaks,
      isOff: doc.isOff,
    };
  }

  @Get('leaves')
  @CheckAbility('read', 'Appointment')
  async listLeaves(@Query('staffId') staffId?: string) {
    const tenantId = this.tenantId();
    const filter: Record<string, unknown> = { tenantId };
    if (staffId) filter.staffId = new Types.ObjectId(staffId);
    const docs = await this.leaves.find(filter).sort({ startDate: -1 }).exec();
    return docs.map((d) => ({
      id: String(d._id),
      staffId: String(d.staffId),
      startDate: d.startDate,
      endDate: d.endDate,
      reason: d.reason,
      status: d.status,
    }));
  }

  @Post('leaves')
  @CheckAbility('manage', 'Staff')
  async createLeave(@Body(new ZodValidationPipe(staffLeaveSchema)) dto: StaffLeaveInput) {
    const tenantId = this.tenantId();
    const staffId = new Types.ObjectId(dto.staffId);
    const doc = await this.leaves.create({
      tenantId,
      staffId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason ?? null,
      status: dto.status,
    });
    return {
      id: String(doc._id),
      staffId: String(doc.staffId),
      startDate: doc.startDate,
      endDate: doc.endDate,
      reason: doc.reason,
      status: doc.status,
    };
  }

  @Put('leaves/:id/status')
  @CheckAbility('manage', 'Staff')
  async updateLeaveStatus(@Param('id') id: string, @Body('status') status: 'approved' | 'rejected') {
    const tenantId = this.tenantId();
    const doc = await this.leaves
      .findOneAndUpdate({ _id: new Types.ObjectId(id), tenantId }, { status }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('leave not found');
    return {
      id: String(doc._id),
      status: doc.status,
    };
  }
}
