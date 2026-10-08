import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Membership, MembershipSchema } from '../iam/schemas/membership.schema.js';
import { User, UserSchema } from '../iam/schemas/user.schema.js';
import { Sale, SaleSchema } from '../pos/schemas/sale.schema.js';
import { Appointment, AppointmentSchema } from '../scheduling/schemas/appointment.schema.js';
import { WaitlistEntry, WaitlistEntrySchema } from '../scheduling/schemas/waitlist.schema.js';
import {
  RealtimeAppointmentCancelledHandler,
  RealtimeAppointmentCompletedHandler,
  RealtimeAppointmentCreatedHandler,
} from './handlers/calendar-events.handler.js';
import {
  RealtimeSaleCompletedHandler,
  RealtimeSaleVoidedHandler,
} from './handlers/pos-events.handler.js';
import {
  RealtimeWaitlistAddedHandler,
  RealtimeWaitlistCancelledHandler,
} from './handlers/queue-events.handler.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Membership.name, schema: MembershipSchema },
      { name: User.name, schema: UserSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Sale.name, schema: SaleSchema },
      { name: WaitlistEntry.name, schema: WaitlistEntrySchema },
    ]),
  ],
  providers: [
    RealtimeGateway,
    RealtimeAppointmentCreatedHandler,
    RealtimeAppointmentCompletedHandler,
    RealtimeAppointmentCancelledHandler,
    RealtimeSaleCompletedHandler,
    RealtimeSaleVoidedHandler,
    RealtimeWaitlistAddedHandler,
    RealtimeWaitlistCancelledHandler,
  ],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
