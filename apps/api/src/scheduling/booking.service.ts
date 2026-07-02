import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { EventBus } from '@nestjs/cqrs';
import type { AppointmentLineInput, CreateAppointment, ResourceType } from '@salon/shared';
import { isTerminal } from '@salon/shared';
import { DateTime } from 'luxon';
import { type Connection, type Model, Types } from 'mongoose';
import { Service, type ServiceDocument } from '../catalog/schemas/service.schema.js';
import { RequestContextService } from '../common/context/request-context.service.js';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import { CustomerRepository } from '../customers/customer.repository.js';
import { Branch, type BranchDocument, defaultWorkingHours } from '../iam/schemas/branch.schema.js';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { Resource, type ResourceDocument } from '../resources/resource.schema.js';
import { AppointmentCreated } from './events.js';
import { type AppointmentLine, Appointment, type AppointmentDocument } from './schemas/appointment.schema.js';
import { SlotReservation, type SlotReservationDocument } from './schemas/slot-reservation.schema.js';
import { MINUTE_MS, occupiedSlots } from './slots.util.js';
import { dayBoundaries } from './time.util.js';

interface PlannedReservation {
  holderType: 'staff' | 'resource';
  holderId: Types.ObjectId;
  slotStart: Date;
}
interface Plan {
  lines: AppointmentLine[];
  reservations: PlannedReservation[];
}

@Injectable()
export class BookingService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectModel(SlotReservation.name) private readonly reservations: Model<SlotReservationDocument>,
    @InjectModel(Service.name) private readonly services: Model<ServiceDocument>,
    @InjectModel(Resource.name) private readonly resources: Model<ResourceDocument>,
    @InjectModel(Branch.name) private readonly branches: Model<BranchDocument>,
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    private readonly customers: CustomerRepository,
    private readonly ctx: RequestContextService,
    private readonly eventBus: EventBus,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return { tenantId: new Types.ObjectId(c.tenantId), branchId: new Types.ObjectId(c.branchId) };
  }

  async book(dto: CreateAppointment): Promise<AppointmentDocument> {
    const { tenantId, branchId } = this.scope();
    const branch = await this.getBranch(tenantId, branchId);
    const customerId = await this.customers.resolveId({
      customerId: dto.customerId,
      customer: dto.customer,
    });
    const plan = await this.plan(tenantId, branchId, branch, dto.lines);

    const apptId = new Types.ObjectId();
    const resDocs = plan.reservations.map((r) => ({ ...r, tenantId, branchId, appointmentId: apptId }));

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        await this.appts.create(
          [
            {
              _id: apptId,
              tenantId,
              branchId,
              customerId,
              lines: plan.lines,
              status: 'booked',
              source: dto.source,
              depositAmount: { amount: dto.depositAmount ?? 0, currency: 'BDT' },
              notes: dto.notes ?? null,
            },
          ] as never,
          { session },
        );
        await this.reservations.insertMany(resDocs, { session, ordered: true });
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('one or more slots are already booked');
      throw err;
    } finally {
      await session.endSession();
    }

    this.eventBus.publish(new AppointmentCreated(String(tenantId), String(branchId), String(apptId)));
    const created = await this.appts.findById(apptId).exec();
    if (!created) throw new NotFoundException('appointment');
    return created;
  }

  async reschedule(id: string, lines: AppointmentLineInput[]): Promise<AppointmentDocument> {
    const { tenantId, branchId } = this.scope();
    const branch = await this.getBranch(tenantId, branchId);
    const appt = await this.appts
      .findOne({ _id: new Types.ObjectId(id), tenantId, branchId, deletedAt: null })
      .exec();
    if (!appt) throw new NotFoundException('appointment not found');
    if (isTerminal(appt.status)) {
      throw new BadRequestException(`cannot reschedule a ${appt.status} appointment`);
    }

    const plan = await this.plan(tenantId, branchId, branch, lines);
    const resDocs = plan.reservations.map((r) => ({ ...r, tenantId, branchId, appointmentId: appt._id }));

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        await this.reservations.deleteMany({ appointmentId: appt._id }, { session });
        appt.lines = plan.lines;
        await appt.save({ session });
        await this.reservations.insertMany(resDocs, { session, ordered: true });
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictException('one or more new slots are already booked');
      throw err;
    } finally {
      await session.endSession();
    }

    const updated = await this.appts.findById(appt._id).exec();
    if (!updated) throw new NotFoundException('appointment');
    return updated;
  }

  // Turn requested lines into concrete appointment lines + the full set of slot
  // reservations (staff + resource), validating service/staff/resource/hours.
  private async plan(
    tenantId: Types.ObjectId,
    branchId: Types.ObjectId,
    branch: BranchDocument,
    lines: AppointmentLineInput[],
  ): Promise<Plan> {
    const slotMs = (branch.slotMinutes || 15) * MINUTE_MS;
    const outLines: AppointmentLine[] = [];
    const reservations: PlannedReservation[] = [];

    for (const lineIn of lines) {
      const service = await this.services
        .findOne({ _id: new Types.ObjectId(lineIn.serviceId), tenantId, deletedAt: null })
        .exec();
      if (!service) throw new BadRequestException('unknown service');
      await this.assertStaffMember(tenantId, lineIn.staffId);

      const startMs = new Date(lineIn.start).getTime();
      if (Number.isNaN(startMs)) throw new BadRequestException('invalid start time');
      const endMs = startMs + service.durationMin * MINUTE_MS;
      this.assertWithinHours(branch, startMs, endMs);

      const slots = occupiedSlots(
        startMs - service.bufferBeforeMin * MINUTE_MS,
        endMs + service.bufferAfterMin * MINUTE_MS,
        slotMs,
      );

      const staffId = new Types.ObjectId(lineIn.staffId);
      let resourceId: Types.ObjectId | null = null;
      if (lineIn.resourceId) {
        resourceId = new Types.ObjectId(lineIn.resourceId);
        await this.assertResource(tenantId, branchId, resourceId);
      } else if (service.eligibleResourceTypes.length > 0) {
        resourceId = await this.pickFreeResource(
          tenantId,
          branchId,
          service.eligibleResourceTypes,
          slots,
        );
        if (!resourceId) throw new ConflictException('no eligible resource free for this slot');
      }

      outLines.push({
        serviceId: new Types.ObjectId(String(service._id)),
        staffId,
        resourceId,
        start: new Date(startMs),
        end: new Date(endMs),
      });
      for (const s of slots) {
        reservations.push({ holderType: 'staff', holderId: staffId, slotStart: new Date(s) });
      }
      if (resourceId) {
        for (const s of slots) {
          reservations.push({ holderType: 'resource', holderId: resourceId, slotStart: new Date(s) });
        }
      }
    }
    return { lines: outLines, reservations };
  }

  private async getBranch(tenantId: Types.ObjectId, branchId: Types.ObjectId): Promise<BranchDocument> {
    const b = await this.branches.findOne({ _id: branchId, tenantId, deletedAt: null }).exec();
    if (!b) throw new NotFoundException('branch not found');
    return b;
  }

  private async assertStaffMember(tenantId: Types.ObjectId, staffId: string): Promise<void> {
    const m = await this.memberships
      .findOne({ tenantId, userId: new Types.ObjectId(staffId), status: 'active' })
      .exec();
    if (!m) throw new BadRequestException('staff is not an active member of this tenant');
  }

  private async assertResource(
    tenantId: Types.ObjectId,
    branchId: Types.ObjectId,
    resourceId: Types.ObjectId,
  ): Promise<void> {
    const r = await this.resources
      .findOne({ _id: resourceId, tenantId, branchId, deletedAt: null })
      .exec();
    if (!r) throw new BadRequestException('unknown resource');
  }

  private async pickFreeResource(
    tenantId: Types.ObjectId,
    branchId: Types.ObjectId,
    types: ResourceType[],
    slots: number[],
  ): Promise<Types.ObjectId | null> {
    const candidates = await this.resources
      .find({ tenantId, branchId, type: { $in: types }, bookable: true, deletedAt: null })
      .exec();
    const slotDates = slots.map((s) => new Date(s));
    for (const r of candidates) {
      const clash = await this.reservations
        .findOne({
          tenantId,
          branchId,
          holderType: 'resource',
          holderId: r._id,
          slotStart: { $in: slotDates },
        })
        .exec();
      if (!clash) return new Types.ObjectId(String(r._id));
    }
    return null;
  }

  private assertWithinHours(branch: BranchDocument, startMs: number, endMs: number): void {
    const tz = branch.timezone;
    const dt = DateTime.fromMillis(startMs, { zone: tz });
    const dateYMD = dt.toISODate();
    const hours = branch.workingHours?.length ? branch.workingHours : defaultWorkingHours();
    const wd = hours[dt.weekday % 7] ?? { closed: false, open: '09:00', close: '21:00' };
    const b = dateYMD ? dayBoundaries(dateYMD, tz, wd) : null;
    if (!b || startMs < b.openMs || endMs > b.closeMs) {
      throw new BadRequestException('appointment is outside branch working hours');
    }
  }
}
