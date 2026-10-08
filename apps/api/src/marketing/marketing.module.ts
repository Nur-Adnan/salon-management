import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerSubscription, CustomerSubscriptionSchema } from '../crm/schemas/customer-subscription.schema.js';
import { LoyaltyAccount, LoyaltyAccountSchema } from '../crm/schemas/loyalty-account.schema.js';
import { Customer, CustomerSchema } from '../customers/customer.schema.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { Sale, SaleSchema } from '../pos/schemas/sale.schema.js';
import { CampaignProcessor } from '../queue/campaign.processor.js';
import { CAMPAIGN_QUEUE } from '../queue/queue.constants.js';
import { Appointment, AppointmentSchema } from '../scheduling/schemas/appointment.schema.js';
import { CampaignsController } from './campaigns.controller.js';
import { CampaignsService } from './campaigns.service.js';
import { Campaign, CampaignSchema } from './schemas/campaign.schema.js';
import { SegmentationService } from './segmentation.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campaign.name, schema: CampaignSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Sale.name, schema: SaleSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: CustomerSubscription.name, schema: CustomerSubscriptionSchema },
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
    ]),
    BullModule.registerQueue({ name: CAMPAIGN_QUEUE }),
    NotificationsModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, SegmentationService, CampaignProcessor],
  exports: [CampaignsService, SegmentationService],
})
export class MarketingModule {}
