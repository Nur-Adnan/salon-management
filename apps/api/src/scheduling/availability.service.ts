import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { Service, type ServiceDocument } from '../catalog/schemas/service.schema.js';
import { Branch, type BranchDocument, defaultWorkingHours } from '../iam/schemas/branch.schema.js';
import { MINUTE_MS, occupiedSlots } from './slots.util.js';
import { SlotReservation, type SlotReservationDocument } from './schemas/slot-reservation.schema.js';
import { StaffLeave, type StaffLeaveDocument } from './schemas/staff-leave.schema.js';
import { StaffShift, type StaffShiftDocument } from './schemas/staff-shift.schema.js';
import { candidateStarts, dayBoundaries, dayRangeUtc } from './time.util.js';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(SlotReservation.name) private readonly reservations: Model<SlotReservationDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(Service.name) private readonly services: Model<ServiceDocument>,
    @InjectModel(StaffShift.name) private readonly shifts: Model<StaffShiftDocument>,
    @InjectModel(StaffLeave.name) private readonly leaves: Model<StaffLeaveDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) {
      throw new ForbiddenException('active tenant + branch required');
    }
    return { tenantId: new Types.ObjectId(c.tenantId), branchId: new Types.ObjectId(c.branchId) };
  }

  // Free start instants (ISO UTC) for a staff member + service on a local date,
  // respecting:
  // 1. Branch working hours
  // 2. Staff service eligibility
  // 3. Staff leave / holidays
  // 4. Staff-specific shift hours
  // 5. Staff breaks
  // 6. Existing appointments / reservations
  // 7. Service duration & buffer times
  async staffAvailability(staffId: string, serviceId: string, date: string): Promise<string[]> {
    const { tenantId, branchId } = this.scope();
    const staffObjId = new Types.ObjectId(staffId);

    const branch = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
    if (!branch) throw new NotFoundException('branch not found');
    const service = await this.services
      .findOne({ _id: new Types.ObjectId(serviceId), tenantId, deletedAt: null })
      .exec();
    if (!service) throw new NotFoundException('service not found');

    // 1. Staff service eligibility check
    if (service.eligibleStaffIds && service.eligibleStaffIds.length > 0) {
      const isEligible = service.eligibleStaffIds.some((id) => String(id) === staffId);
      if (!isEligible) return [];
    }

    // 2. Staff approved leave check
    const onLeave = await this.leaves
      .findOne({
        tenantId,
        staffId: staffObjId,
        status: 'approved',
        startDate: { $lte: date },
        endDate: { $gte: date },
      })
      .exec();
    if (onLeave) return [];

    const tz = branch.timezone;
    const slotMs = (branch.slotMinutes || 15) * MINUTE_MS;
    const hours = branch.workingHours?.length ? branch.workingHours : defaultWorkingHours();
    // luxon weekday: 1=Mon..7=Sun; workingHours index 0=Sun -> (weekday % 7).
    const dow = DateTime.fromISO(date, { zone: tz }).weekday % 7;
    const branchWd = hours[dow] ?? { closed: false, open: '09:00', close: '21:00' };
    if (branchWd.closed) return [];

    // 3. Staff shift schedule
    const shift = await this.shifts
      .findOne({
        tenantId,
        branchId,
        staffId: staffObjId,
        dayOfWeek: dow,
      })
      .exec();
    if (shift?.isOff) return [];

    // Effective open/close is the intersection of branch and staff shift
    const effectiveOpen = shift ? (shift.open > branchWd.open ? shift.open : branchWd.open) : branchWd.open;
    const effectiveClose = shift ? (shift.close < branchWd.close ? shift.close : branchWd.close) : branchWd.close;
    const effectiveWd = { closed: false, open: effectiveOpen, close: effectiveClose };

    const bounds = dayBoundaries(date, tz, effectiveWd);
    if (!bounds || bounds.openMs >= bounds.closeMs) return [];
    const candidates = candidateStarts(date, tz, effectiveWd, branch.slotMinutes || 15);

    // 4. Staff break windows
    const breakIntervals: { startMs: number; endMs: number }[] = [];
    if (shift?.breaks?.length) {
      for (const brk of shift.breaks) {
        const bStart = DateTime.fromISO(`${date}T${brk.start}`, { zone: tz }).toMillis();
        const bEnd = DateTime.fromISO(`${date}T${brk.end}`, { zone: tz }).toMillis();
        if (!Number.isNaN(bStart) && !Number.isNaN(bEnd) && bEnd > bStart) {
          breakIntervals.push({ startMs: bStart, endMs: bEnd });
        }
      }
    }

    // 5. Existing reservations for the day
    const { start: dayStart, end: dayEnd } = dayRangeUtc(date, tz);
    const reserved = await this.reservations
      .find({
        tenantId,
        branchId,
        holderType: 'staff',
        holderId: staffObjId,
        slotStart: { $gte: dayStart, $lt: dayEnd },
      })
      .exec();
    const reservedSet = new Set(reserved.map((r) => r.slotStart.getTime()));

    const durMs = service.durationMin * MINUTE_MS;
    const beforeMs = service.bufferBeforeMin * MINUTE_MS;
    const afterMs = service.bufferAfterMin * MINUTE_MS;
    const now = Date.now();

    const out: string[] = [];
    for (const start of candidates) {
      if (start < now) continue;
      if (start + durMs > bounds.closeMs) continue; // must finish by close

      // Check if [start, start + durMs] overlaps any break
      const overlapsBreak = breakIntervals.some(
        (b) => start < b.endMs && start + durMs > b.startMs,
      );
      if (overlapsBreak) continue;

      const slots = occupiedSlots(start - beforeMs, start + durMs + afterMs, slotMs);
      if (slots.every((s) => !reservedSet.has(s))) out.push(new Date(start).toISOString());
    }
    return out;
  }
}
