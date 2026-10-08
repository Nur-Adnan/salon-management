import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { calculateShiftHoursWithBreaks, type PayrollAdjustment, payrollTotals, shiftHours } from '@salon/shared';
import { type Connection, type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { AbilityFactory } from '../iam/casl/ability.factory.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { assertSelfOrManage, canViewAll } from './authz.util.js';
import { AttendanceRecord, type AttendanceRecordDocument } from './schemas/attendance-record.schema.js';
import { Payslip, type PayslipDocument } from './schemas/payslip.schema.js';
import { StaffCompensation, type StaffCompensationDocument } from './schemas/staff-compensation.schema.js';
import { StaffEarningEntry, type StaffEarningEntryDocument } from './schemas/staff-earning-entry.schema.js';

@Injectable()
export class PayrollService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(StaffEarningEntry.name) private readonly earnings: Model<StaffEarningEntryDocument>,
    @InjectModel(AttendanceRecord.name) private readonly attendance: Model<AttendanceRecordDocument>,
    @InjectModel(StaffCompensation.name) private readonly compensation: Model<StaffCompensationDocument>,
    @InjectModel(Payslip.name) private readonly payslips: Model<PayslipDocument>,
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    private readonly ctx: RequestContextService,
    private readonly abilities: AbilityFactory,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('no active tenant');
    return new Types.ObjectId(t);
  }

  private async assertStaffMember(tenantId: Types.ObjectId, staffId: string): Promise<void> {
    const m = await this.memberships.findOne({ tenantId, userId: new Types.ObjectId(staffId), status: 'active' }).exec();
    if (!m) throw new BadRequestException('staff is not an active member of this tenant');
  }

  // No staffId: a manager/accountant sees the whole team; anyone else
  // (self-service read only) sees their own. An explicit staffId always
  // requires self-or-manage.
  private scopeFilter(tenantId: Types.ObjectId, staffId?: string): Record<string, unknown> {
    const callerId = this.ctx.get()?.userId ?? null;
    const ability = this.abilities.forCurrentContext();
    if (staffId) assertSelfOrManage(ability, 'Payroll', callerId, staffId);
    const targetId = staffId ?? (canViewAll(ability, 'Payroll') ? null : callerId);
    const filter: Record<string, unknown> = { tenantId };
    if (targetId) filter.staffId = new Types.ObjectId(targetId);
    return filter;
  }

  async listEarnings(staffId?: string): Promise<StaffEarningEntryDocument[]> {
    const filter = this.scopeFilter(this.tenantId(), staffId);
    return this.earnings.find(filter).sort({ createdAt: -1 }).limit(500).exec();
  }

  async listPayslips(staffId?: string): Promise<PayslipDocument[]> {
    const filter = this.scopeFilter(this.tenantId(), staffId);
    return this.payslips.find(filter).sort({ createdAt: -1 }).exec();
  }

  async getPayslip(id: string): Promise<PayslipDocument> {
    const tenantId = this.tenantId();
    const slip = await this.payslips.findOne({ _id: new Types.ObjectId(id), tenantId }).exec();
    if (!slip) throw new NotFoundException('payslip not found');
    assertSelfOrManage(this.abilities.forCurrentContext(), 'Payroll', this.ctx.get()?.userId ?? null, String(slip.staffId));
    return slip;
  }

  /**
   * Runs payroll for one staff member. Claims every unclaimed commission/tip
   * entry and closed shift up to `periodEnd` (no lower bound — see
   * docs/phase-6.md: a straggler from event-processing lag must always
   * surface on the NEXT run rather than being silently lost forever), sums
   * them with the compensation profile snapshot, and writes one immutable
   * Payslip. `payslipId` is pre-generated outside the transaction so a driver
   * retry re-reads fresh `payslipId: null` filters instead of reusing
   * in-memory state from a possibly-rolled-back earlier attempt.
   */
  async run(staffId: string, periodStart: Date, periodEnd: Date, adjustments: PayrollAdjustment[]): Promise<PayslipDocument> {
    if (!this.abilities.forCurrentContext().can('manage', 'Payroll')) {
      throw new ForbiddenException('only a manager or accountant can run payroll');
    }
    const tenantId = this.tenantId();
    await this.assertStaffMember(tenantId, staffId);
    const staffObjectId = new Types.ObjectId(staffId);
    const payslipId = new Types.ObjectId();
    const runByUserId = this.ctx.get()?.userId ?? null;

    const session = await this.conn.startSession();
    try {
      const result: { payslip: PayslipDocument | null } = { payslip: null };
      await session.withTransaction(async () => {
        await this.earnings
          .updateMany(
            { tenantId, staffId: staffObjectId, payslipId: null, createdAt: { $lt: periodEnd } },
            { $set: { payslipId } },
            { session },
          )
          .exec();
        const claimedEarnings = await this.earnings.find({ tenantId, payslipId }).session(session).exec();
        const commissionMinor = claimedEarnings
          .filter((e) => e.kind === 'commission')
          .reduce((sum, e) => sum + e.amountMinor, 0);
        const tipsMinor = claimedEarnings.filter((e) => e.kind === 'tip').reduce((sum, e) => sum + e.amountMinor, 0);

        await this.attendance
          .updateMany(
            { tenantId, staffId: staffObjectId, payslipId: null, clockOut: { $ne: null, $lt: periodEnd } },
            { $set: { payslipId } },
            { session },
          )
          .exec();
        const claimedShifts = await this.attendance.find({ tenantId, payslipId }).session(session).exec();
        const hoursWorked = claimedShifts.reduce((sum, s) => {
          const breakMins = s.breakMinutes ?? 0;
          return sum + calculateShiftHoursWithBreaks(s.clockIn, s.clockOut as Date, breakMins).netHours;
        }, 0);

        const comp = await this.compensation.findOne({ tenantId, userId: staffObjectId }).session(session).exec();
        const baseSalaryMinor = comp?.baseSalaryMinor ?? 0;
        const hourlyRateMinor = comp?.hourlyRateMinor ?? 0;

        const totals = payrollTotals({ baseSalaryMinor, hourlyRateMinor, hoursWorked, commissionMinor, tipsMinor, adjustments });

        const created = await this.payslips.create(
          [
            {
              _id: payslipId,
              tenantId,
              staffId: staffObjectId,
              periodStart,
              periodEnd,
              baseSalaryMinor,
              hourlyRateMinor,
              hoursWorked,
              hourlyPayMinor: totals.hourlyPayMinor,
              commissionMinor,
              tipsMinor,
              adjustments,
              grossMinor: totals.grossMinor,
              adjustmentsTotalMinor: totals.adjustmentsTotalMinor,
              netMinor: totals.netMinor,
              runByUserId: runByUserId ? new Types.ObjectId(runByUserId) : null,
            },
          ] as never,
          { session },
        );
        result.payslip = created[0] ?? null;
      });
      if (!result.payslip) throw new Error('payslip creation produced no document');
      return result.payslip;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException('payroll has already been run for this exact period');
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async markPaid(id: string, disbursementNote?: string): Promise<PayslipDocument> {
    if (!this.abilities.forCurrentContext().can('manage', 'Payroll')) {
      throw new ForbiddenException('only a manager or accountant can mark a payslip paid');
    }
    const tenantId = this.tenantId();
    const slip = await this.payslips
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId, paidAt: null },
        { $set: { paidAt: new Date(), disbursementNote: disbursementNote ?? null } },
        { new: true },
      )
      .exec();
    if (!slip) {
      const exists = await this.payslips.findOne({ _id: new Types.ObjectId(id), tenantId }).exec();
      if (!exists) throw new NotFoundException('payslip not found');
      throw new BadRequestException('payslip is already marked paid');
    }
    return slip;
  }
}
