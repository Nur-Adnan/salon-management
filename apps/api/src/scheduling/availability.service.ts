import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DateTime } from 'luxon';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { Service, type ServiceDocument } from '../catalog/schemas/service.schema.js';
import { Branch, type BranchDocument, defaultWorkingHours } from '../iam/schemas/branch.schema.js';
import { MINUTE_MS, occupiedSlots } from './slots.util.js';
import { SlotReservation, type SlotReservationDocument } from './schemas/slot-reservation.schema.js';
import { candidateStarts, dayBoundaries, dayRangeUtc } from './time.util.js';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(SlotReservation.name) private readonly reservations: Model<SlotReservationDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(Service.name) private readonly services: Model<ServiceDocument>,
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
  // respecting working hours, service duration, buffers, timezone/DST, and
  // existing reservations. Past slots are excluded.
  async staffAvailability(staffId: string, serviceId: string, date: string): Promise<string[]> {
    const { tenantId, branchId } = this.scope();

    const branch = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
    if (!branch) throw new NotFoundException('branch not found');
    const service = await this.services
      .findOne({ _id: new Types.ObjectId(serviceId), tenantId, deletedAt: null })
      .exec();
    if (!service) throw new NotFoundException('service not found');

    const tz = branch.timezone;
    const slotMs = (branch.slotMinutes || 15) * MINUTE_MS;
    const hours = branch.workingHours?.length ? branch.workingHours : defaultWorkingHours();
    // luxon weekday: 1=Mon..7=Sun; workingHours index 0=Sun -> (weekday % 7).
    const dow = DateTime.fromISO(date, { zone: tz }).weekday % 7;
    const wd = hours[dow] ?? { closed: false, open: '09:00', close: '21:00' };

    const bounds = dayBoundaries(date, tz, wd);
    if (!bounds) return [];
    const candidates = candidateStarts(date, tz, wd, branch.slotMinutes || 15);

    const { start: dayStart, end: dayEnd } = dayRangeUtc(date, tz);
    const reserved = await this.reservations
      .find({
        tenantId,
        branchId,
        holderType: 'staff',
        holderId: new Types.ObjectId(staffId),
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
      const slots = occupiedSlots(start - beforeMs, start + durMs + afterMs, slotMs);
      if (slots.every((s) => !reservedSet.has(s))) out.push(new Date(start).toISOString());
    }
    return out;
  }
}
