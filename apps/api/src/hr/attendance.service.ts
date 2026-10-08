import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { calculateShiftHoursWithBreaks, type UpdateAttendance } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { AbilityFactory } from '../iam/casl/ability.factory.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { assertSelfOrManage, canViewAll } from './authz.util.js';
import { AttendanceRecord, type AttendanceRecordDocument } from './schemas/attendance-record.schema.js';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(AttendanceRecord.name) private readonly attendance: Model<AttendanceRecordDocument>,
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    private readonly ctx: RequestContextService,
    private readonly abilities: AbilityFactory,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId; userId: string | null } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return { tenantId: new Types.ObjectId(c.tenantId), branchId: new Types.ObjectId(c.branchId), userId: c.userId ?? null };
  }

  private async assertStaffMember(tenantId: Types.ObjectId, staffId: string): Promise<void> {
    const m = await this.memberships.findOne({ tenantId, userId: new Types.ObjectId(staffId), status: 'active' }).exec();
    if (!m) throw new BadRequestException('staff is not an active member of this tenant');
  }

  async clockIn(staffId: string | undefined, note?: string): Promise<AttendanceRecordDocument> {
    const { tenantId, branchId, userId } = this.scope();
    const targetId = staffId ?? userId;
    if (!targetId) throw new ForbiddenException('no active user to clock in');
    assertSelfOrManage(this.abilities.forCurrentContext(), 'Attendance', userId, targetId);
    await this.assertStaffMember(tenantId, targetId);

    try {
      return await this.attendance.create({
        tenantId,
        branchId,
        staffId: new Types.ObjectId(targetId),
        clockIn: new Date(),
        clockOut: null,
        recordedByUserId: userId ? new Types.ObjectId(userId) : null,
        note: note ?? null,
      } as never);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('this staff member already has an open shift');
      throw err;
    }
  }

  async clockOut(staffId: string | undefined, breakMinutes = 0): Promise<AttendanceRecordDocument> {
    const { tenantId, userId } = this.scope();
    const targetId = staffId ?? userId;
    if (!targetId) throw new ForbiddenException('no active user to clock out');
    assertSelfOrManage(this.abilities.forCurrentContext(), 'Attendance', userId, targetId);

    const now = new Date();
    const openRecord = await this.attendance
      .findOne({ tenantId, staffId: new Types.ObjectId(targetId), clockOut: null })
      .exec();
    if (!openRecord) throw new BadRequestException('no open shift for this staff member');

    const details = calculateShiftHoursWithBreaks(openRecord.clockIn, now, breakMinutes, 8);

    const rec = await this.attendance
      .findOneAndUpdate(
        { _id: openRecord._id, clockOut: null },
        {
          $set: {
            clockOut: now,
            breakMinutes,
            regularHours: details.regularHours,
            overtimeHours: details.overtimeHours,
          },
        },
        { new: true },
      )
      .exec();
    if (!rec) throw new BadRequestException('shift was already closed');
    return rec;
  }

  // No staffId: a manager sees the whole team's attendance; anyone else
  // (self-service only) sees their own. An explicit staffId always requires
  // self-or-manage, same as clockIn/clockOut.
  async list(staffId?: string): Promise<AttendanceRecordDocument[]> {
    const { tenantId, userId } = this.scope();
    const ability = this.abilities.forCurrentContext();
    if (staffId) assertSelfOrManage(ability, 'Attendance', userId, staffId);
    const targetId = staffId ?? (canViewAll(ability, 'Attendance') ? null : userId);
    const filter: Record<string, unknown> = { tenantId };
    if (targetId) filter.staffId = new Types.ObjectId(targetId);
    return this.attendance.find(filter).sort({ clockIn: -1 }).limit(200).exec();
  }

  // Manager-only correction of an unclaimed shift — once a payroll run has
  // claimed it (payslipId set), it's an immutable historical record like a
  // Sale; a correction after that point is a fresh adjustment on the NEXT run.
  async update(id: string, patch: UpdateAttendance): Promise<AttendanceRecordDocument> {
    const { tenantId } = this.scope();
    if (!this.abilities.forCurrentContext().can('manage', 'Attendance')) {
      throw new ForbiddenException('only a manager can correct attendance records');
    }
    const set: Record<string, unknown> = {};
    if (patch.clockIn !== undefined) set.clockIn = new Date(patch.clockIn);
    if (patch.clockOut !== undefined) set.clockOut = patch.clockOut === null ? null : new Date(patch.clockOut);
    try {
      // An empty patch is a valid (if pointless) request — MongoDB rejects a
      // literal empty $set, so just fetch-and-return instead of updating.
      const rec = await (Object.keys(set).length === 0
        ? this.attendance.findOne({ _id: new Types.ObjectId(id), tenantId, payslipId: null })
        : this.attendance.findOneAndUpdate(
            { _id: new Types.ObjectId(id), tenantId, payslipId: null },
            { $set: set },
            { new: true },
          )
      ).exec();
      if (!rec) throw new NotFoundException('attendance record not found, or already claimed by a payroll run');
      return rec;
    } catch (err) {
      // Re-opening (clockOut -> null) can collide with the one-open-shift guard.
      if (isDuplicateKeyError(err)) throw new ConflictException('this staff member already has another open shift');
      throw err;
    }
  }

  // Manager-only removal of a mistaken (e.g. fat-fingered duplicate) unclaimed
  // entry. Once claimed by a payroll run it's permanent, same rule as update().
  async remove(id: string): Promise<void> {
    const { tenantId } = this.scope();
    if (!this.abilities.forCurrentContext().can('manage', 'Attendance')) {
      throw new ForbiddenException('only a manager can remove attendance records');
    }
    const res = await this.attendance.deleteOne({ _id: new Types.ObjectId(id), tenantId, payslipId: null }).exec();
    if (res.deletedCount === 0) {
      throw new NotFoundException('attendance record not found, or already claimed by a payroll run');
    }
  }
}
