import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { RELEASING_STATUSES, type AppointmentStatus, canTransition } from '@salon/shared';
import { type Connection, type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { Branch, type BranchDocument } from '../iam/schemas/branch.schema.js';
import { AppointmentCancelled, AppointmentCompleted } from './events.js';
import { Appointment, type AppointmentDocument } from './schemas/appointment.schema.js';
import { SlotReservation, type SlotReservationDocument } from './schemas/slot-reservation.schema.js';
import { dayRangeUtc } from './time.util.js';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
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
    const { tenantId, branchId } = this.scope();
    const _id = new Types.ObjectId(id);

    // The status flip and the slot-releasing deleteMany must be atomic AND
    // mutually exclusive with any concurrent transition. Without this, two
    // legal-from-the-same-source transitions (e.g. checked_in->in_service and
    // checked_in->cancelled) could both commit last-write-wins, and a releasing
    // transition's reservation delete could fire while the other left the
    // appointment active — orphaning the slot and defeating the no-double-book
    // guarantee. The findOneAndUpdate filters on the EXACT source status we
    // validated against, so only one transition off a given status can win.
    let updated: AppointmentDocument | null = null;
    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        const appt = await this.appts
          .findOne({ _id, tenantId, branchId, deletedAt: null })
          .session(session)
          .exec();
        if (!appt) throw new NotFoundException('appointment not found');
        if (!canTransition(appt.status, to)) {
          throw new BadRequestException(`illegal transition ${appt.status} -> ${to}`);
        }
        const guarded = await this.appts
          .findOneAndUpdate(
            { _id, tenantId, branchId, status: appt.status, deletedAt: null },
            { $set: { status: to } },
            { new: true, session },
          )
          .exec();
        if (!guarded) throw new ConflictException('appointment status changed concurrently');
        // Cancelled / no-show / completed free the slots for other bookings —
        // in the same transaction as the flip, so the two can never diverge.
        if (RELEASING_STATUSES.includes(to)) {
          await this.reservations.deleteMany({ tenantId, appointmentId: _id }, { session });
        }
        updated = guarded;
      });
    } finally {
      await session.endSession();
    }

    const appt = updated as unknown as AppointmentDocument;
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
