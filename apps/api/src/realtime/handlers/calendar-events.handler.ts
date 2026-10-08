import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import {
  AppointmentCancelled,
  AppointmentCompleted,
  AppointmentCreated,
} from '../../scheduling/events.js';
import { Appointment, type AppointmentDocument } from '../../scheduling/schemas/appointment.schema.js';
import { RealtimeGateway } from '../realtime.gateway.js';

@Injectable()
@EventsHandler(AppointmentCreated)
export class RealtimeAppointmentCreatedHandler implements IEventHandler<AppointmentCreated> {
  private readonly logger = new Logger(RealtimeAppointmentCreatedHandler.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    private readonly gateway: RealtimeGateway,
  ) {}

  async handle(event: AppointmentCreated): Promise<void> {
    const { tenantId, branchId, appointmentId } = event;
    if (!Types.ObjectId.isValid(appointmentId) || !Types.ObjectId.isValid(tenantId)) return;
    const appt = await this.appts.findOne({
      _id: new Types.ObjectId(appointmentId),
      tenantId: new Types.ObjectId(tenantId),
    }).exec();

    if (!appt) return;

    this.gateway.broadcastCalendarEvent(tenantId, branchId, 'calendar.appointment_created', {
      appointmentId,
      customerId: String(appt.customerId),
      status: appt.status,
      source: appt.source,
      lines: appt.lines,
      depositAmount: appt.depositAmount,
    });
  }
}

@Injectable()
@EventsHandler(AppointmentCompleted)
export class RealtimeAppointmentCompletedHandler implements IEventHandler<AppointmentCompleted> {
  constructor(private readonly gateway: RealtimeGateway) {}

  async handle(event: AppointmentCompleted): Promise<void> {
    this.gateway.broadcastCalendarEvent(event.tenantId, event.branchId, 'calendar.appointment_completed', {
      appointmentId: event.appointmentId,
      status: 'completed',
    });
  }
}

@Injectable()
@EventsHandler(AppointmentCancelled)
export class RealtimeAppointmentCancelledHandler implements IEventHandler<AppointmentCancelled> {
  constructor(private readonly gateway: RealtimeGateway) {}

  async handle(event: AppointmentCancelled): Promise<void> {
    this.gateway.broadcastCalendarEvent(event.tenantId, event.branchId, 'calendar.appointment_cancelled', {
      appointmentId: event.appointmentId,
      status: event.reason,
    });
  }
}
