import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerSubscription, CustomerSubscriptionSchema } from '../crm/schemas/customer-subscription.schema.js';
import { GiftCard, GiftCardSchema } from '../crm/schemas/gift-card.schema.js';
import { Customer, CustomerSchema } from '../customers/customer.schema.js';
import { Branch, BranchSchema } from '../iam/schemas/branch.schema.js';
import { NOTIFICATION_QUEUE, REMINDER_QUEUE } from '../queue/queue.constants.js';
import { Appointment, AppointmentSchema } from '../scheduling/schemas/appointment.schema.js';
import { AppointmentCreatedReminderHandler } from './events/appointment-reminders.handler.js';
import { LifecycleScannerService } from './lifecycle-scanner.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { EmailProvider } from './providers/email.provider.js';
import { SmsProvider } from './providers/sms.provider.js';
import { WhatsAppProvider } from './providers/whatsapp.provider.js';
import {
  NotificationLog,
  NotificationLogSchema,
} from './schemas/notification-log.schema.js';

import { NotificationProcessor } from '../queue/notification.processor.js';
import { ReminderProcessor } from '../queue/reminder.processor.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationLog.name, schema: NotificationLogSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: CustomerSubscription.name, schema: CustomerSubscriptionSchema },
      { name: GiftCard.name, schema: GiftCardSchema },
    ]),
    BullModule.registerQueue(
      { name: NOTIFICATION_QUEUE },
      { name: REMINDER_QUEUE },
    ),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    LifecycleScannerService,
    EmailProvider,
    SmsProvider,
    WhatsAppProvider,
    AppointmentCreatedReminderHandler,
    NotificationProcessor,
    ReminderProcessor,
  ],
  exports: [NotificationsService, LifecycleScannerService],
})
export class NotificationsModule {}
