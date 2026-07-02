import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { RELEASING_STATUSES, type AppointmentStatus, canTransition } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { Branch, type BranchDocument } from '../iam/schemas/branch.schema.js';
import { AppointmentCancelled, AppointmentCompleted } from './events.js';
import { Appointment, type AppointmentDocument } from './schemas/appointment.schema.js';
import { SlotReservation, type SlotReservationDocument } from './schemas/slot-reservation.schema.js';
import { dayRangeUtc } from './time.util.js';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectModel(SlotReservation.name) private readonly reservations: Model<SlotReservationDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    private readonly ctx: RequestContextService,
    private readonly eventBus: EventBus,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return { tenantId: new Types.ObjectId(c.tenantId), branchId: new Types.ObjectId(c.branchId) };
  }

  async list(filter: {
    date?: string;
    staffId?: string;
    status?: AppointmentStatus;
  }): Promise<AppointmentDocument[]> {
    const { tenantId, branchId } = this.scope();
    const q: Record<string, unknown> = { tenantId, branchId, deletedAt: null };
    if (filter.status) q.status = filter.status;
    if (filter.staffId) q['lines.staffId'] = new Types.ObjectId(filter.staffId);
    if (filter.date) {
      const branch = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
      const tz = branch?.timezone ?? 'Asia/Dhaka';
      const { start, end } = dayRangeUtc(filter.date, tz);
      q['lines.start'] = { $gte: start, $lte: end };
    }
    return this.appts.find(q).sort({ 'lines.start': 1 }).limit(500).exec();
  }

  async get(id: string): Promise<AppointmentDocument> {
    const { tenantId, branchId } = this.scope();
    const appt = await this.appts
      .findOne({ _id: new Types.ObjectId(id), tenantId, branchId, deletedAt: null })
      .exec();
    if (!appt) throw new NotFoundException('appointment not found');
    return appt;
  }

  async transition(id: string, to: AppointmentStatus): Promise<AppointmentDocument> {
    const appt = await this.get(id);
    if (!canTransition(appt.status, to)) {
      throw new BadRequestException(`illegal transition ${appt.status} -> ${to}`);
    }
    appt.status = to;
    await appt.save();

    // Cancelled / no-show / completed free the slots for other bookings.
    if (RELEASING_STATUSES.includes(to)) {
      await this.reservations.deleteMany({ appointmentId: appt._id }).exec();
    }

    const t = String(appt.tenantId);
    const b = String(appt.branchId);
    const a = String(appt._id);
    if (to === 'completed') this.eventBus.publish(new AppointmentCompleted(t, b, a));
    else if (to === 'cancelled' || to === 'no_show') {
      this.eventBus.publish(new AppointmentCancelled(t, b, a, to));
    }
    return appt;
  }
}
