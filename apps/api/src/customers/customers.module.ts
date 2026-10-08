import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerSubscription, CustomerSubscriptionSchema } from '../crm/schemas/customer-subscription.schema.js';
import { GiftCard, GiftCardSchema } from '../crm/schemas/gift-card.schema.js';
import { LoyaltyAccount, LoyaltyAccountSchema } from '../crm/schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, LoyaltyLedgerEntrySchema } from '../crm/schemas/loyalty-ledger-entry.schema.js';
import { Organization, OrganizationSchema } from '../iam/schemas/organization.schema.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { Appointment, AppointmentSchema } from '../scheduling/schemas/appointment.schema.js';
import { SlotReservation, SlotReservationSchema } from '../scheduling/schemas/slot-reservation.schema.js';
import { ClientAuthGuard } from './client-auth.guard.js';
import { ClientPortalController } from './client-portal.controller.js';
import { ClientPortalService } from './client-portal.service.js';
import { CustomerRepository } from './customer.repository.js';
import { Customer, CustomerSchema } from './customer.schema.js';
import { CustomersController } from './customers.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: SlotReservation.name, schema: SlotReservationSchema },
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: LoyaltyLedgerEntry.name, schema: LoyaltyLedgerEntrySchema },
      { name: CustomerSubscription.name, schema: CustomerSubscriptionSchema },
      { name: GiftCard.name, schema: GiftCardSchema },
    ]),
    CqrsModule,
    NotificationsModule,
  ],
  controllers: [CustomersController, ClientPortalController],
  providers: [CustomerRepository, ClientPortalService, ClientAuthGuard],
  exports: [CustomerRepository, ClientPortalService, MongooseModule],
})
export class CustomersModule {}
