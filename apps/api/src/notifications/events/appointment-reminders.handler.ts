import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { calculateReminderDelays } from '@salon/shared';
import type { Queue } from 'bullmq';
import { type Model, Types } from 'mongoose';
import { REMINDER_QUEUE } from '../../queue/queue.constants.js';
import { AppointmentCreated } from '../../scheduling/events.js';
import { Appointment, type AppointmentDocument } from '../../scheduling/schemas/appointment.schema.js';

@Injectable()
@EventsHandler(AppointmentCreated)
export class AppointmentCreatedReminderHandler implements IEventHandler<AppointmentCreated> {
  private readonly logger = new Logger(AppointmentCreatedReminderHandler.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appts: Model<AppointmentDocument>,
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue,
  ) {}

  async handle(event: AppointmentCreated): Promise<void> {
    const { appointmentId, tenantId, branchId } = event;
    const appt = await this.appts
      .findOne({
        _id: new Types.ObjectId(appointmentId),
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      })
      .exec();

    if (!appt || !appt.lines) return;
    const start = appt.lines[0]?.start;
    if (!start) return;
    const expectedStart = start.toISOString();
    const { send24hDelayMs, send2hDelayMs } = calculateReminderDelays(start, new Date());

    if (send24hDelayMs !== null) {
      await this.reminderQueue.add(
        'appointment_reminder',
        {
          appointmentId,
          tenantId,
          branchId,
          reminderType: '24h',
          expectedStart,
        },
        {
          delay: send24hDelayMs,
          jobId: `reminder:appt:${appointmentId}:24h`,
          removeOnComplete: true,
        },
      );
      this.logger.debug(
        `Scheduled 24h reminder for appt ${appointmentId} in ${Math.round(send24hDelayMs / 1000 / 60)} minutes`,
      );
    }

    if (send2hDelayMs !== null) {
      await this.reminderQueue.add(
        'appointment_reminder',
        {
          appointmentId,
          tenantId,
          branchId,
          reminderType: '2h',
          expectedStart,
        },
        {
          delay: send2hDelayMs,
          jobId: `reminder:appt:${appointmentId}:2h`,
          removeOnComplete: true,
        },
      );
      this.logger.debug(
        `Scheduled 2h reminder for appt ${appointmentId} in ${Math.round(send2hDelayMs / 1000 / 60)} minutes`,
      );
    }
  }
}
