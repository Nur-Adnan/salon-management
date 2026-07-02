import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from '../catalog/schemas/service.schema.js';
import { CustomersModule } from '../customers/customers.module.js';
import { Branch, BranchSchema } from '../iam/schemas/branch.schema.js';
import { Membership, MembershipSchema } from '../iam/schemas/membership.schema.js';
import { Organization, OrganizationSchema } from '../iam/schemas/organization.schema.js';
import { User, UserSchema } from '../iam/schemas/user.schema.js';
import { Resource, ResourceSchema } from '../resources/resource.schema.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { AvailabilityService } from './availability.service.js';
import { BookingService } from './booking.service.js';
import { PublicBookingController } from './public-booking.controller.js';
import { StaffController } from './staff.controller.js';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema.js';
import { SlotReservation, SlotReservationSchema } from './schemas/slot-reservation.schema.js';
import { WaitlistEntry, WaitlistEntrySchema } from './schemas/waitlist.schema.js';
import { WaitlistController } from './waitlist.controller.js';
import { WaitlistService } from './waitlist.service.js';

@Module({
  imports: [
    CqrsModule, // EventBus for domain events
    CustomersModule, // provides CustomerRepository
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: SlotReservation.name, schema: SlotReservationSchema },
      { name: WaitlistEntry.name, schema: WaitlistEntrySchema },
      // read access to catalog/tenancy collections (models are shared per connection)
      { name: Service.name, schema: ServiceSchema },
      { name: Resource.name, schema: ResourceSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AppointmentsController, WaitlistController, PublicBookingController, StaffController],
  providers: [BookingService, AppointmentsService, AvailabilityService, WaitlistService],
})
export class SchedulingModule {}
