import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type AppointmentStatus,
  type AvailabilityQuery,
  type CreateAppointment,
  type RescheduleAppointment,
  appointmentTransitionSchema,
  availabilityQuerySchema,
  createAppointmentSchema,
  objectIdSchema,
  rescheduleAppointmentSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { AppointmentsService } from './appointments.service.js';
import { AvailabilityService } from './availability.service.js';
import { BookingService } from './booking.service.js';
import { serializeAppointment } from './mappers.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly booking: BookingService,
    private readonly appointments: AppointmentsService,
    private readonly availability: AvailabilityService,
  ) {}

  // Declared before ':id' so it isn't captured as an id param.
  @Get('availability')
  @CheckAbility('read', 'Appointment')
  async availabilitySlots(
    @Query(new ZodValidationPipe(availabilityQuerySchema)) q: AvailabilityQuery,
  ) {
    return { slots: await this.availability.staffAvailability(q.staffId, q.serviceId, q.date) };
  }

  @Get()
  @CheckAbility('read', 'Appointment')
  async list(
    @Query('date') date?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
  ) {
    const appts = await this.appointments.list({
      date,
      staffId,
      status: status as AppointmentStatus | undefined,
    });
    return appts.map(serializeAppointment);
  }

  @Get(':id')
  @CheckAbility('read', 'Appointment')
  async get(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return serializeAppointment(await this.appointments.get(id));
  }

  @Post()
  @CheckAbility('create', 'Appointment')
  async create(@Body(new ZodValidationPipe(createAppointmentSchema)) dto: CreateAppointment) {
    return serializeAppointment(await this.booking.book(dto));
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  @CheckAbility('update', 'Appointment')
  async reschedule(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(rescheduleAppointmentSchema)) dto: RescheduleAppointment,
  ) {
    return serializeAppointment(await this.booking.reschedule(id, dto.lines));
  }

  @Post(':id/status')
  @HttpCode(200)
  @CheckAbility('update', 'Appointment')
  async transition(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(appointmentTransitionSchema)) dto: { status: AppointmentStatus },
  ) {
    return serializeAppointment(await this.appointments.transition(id, dto.status));
  }
}
