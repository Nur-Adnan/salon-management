import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersModule } from '../customers/customers.module.js';
import { PosModule } from '../pos/pos.module.js';
import { Sale, SaleSchema } from '../pos/schemas/sale.schema.js';
import { Appointment, AppointmentSchema } from '../scheduling/schemas/appointment.schema.js';
import { CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { SaleCompletedHandler } from './events/sale-completed.handler.js';
import { GiftCardsController } from './gift-cards.controller.js';
import { GiftCardsService } from './gift-cards.service.js';
import { LoyaltyController } from './loyalty.controller.js';
import { LoyaltyService } from './loyalty.service.js';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';
import { Coupon, CouponSchema } from './schemas/coupon.schema.js';
import {
  CustomerSubscription,
  CustomerSubscriptionSchema,
} from './schemas/customer-subscription.schema.js';
import { GiftCard, GiftCardSchema } from './schemas/gift-card.schema.js';
import { GiftCardLedgerEntry, GiftCardLedgerEntrySchema } from './schemas/gift-card-ledger-entry.schema.js';
import { LoyaltyAccount, LoyaltyAccountSchema } from './schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, LoyaltyLedgerEntrySchema } from './schemas/loyalty-ledger-entry.schema.js';
import { Referral, ReferralSchema } from './schemas/referral.schema.js';
import { SubscriptionPlan, SubscriptionPlanSchema } from './schemas/subscription-plan.schema.js';
import { TreatmentRecord, TreatmentRecordSchema } from './schemas/treatment-record.schema.js';
import {
  CustomerSubscriptionsController,
  SubscriptionPlansController,
} from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { TreatmentRecordsController } from './treatment-records.controller.js';
import { TreatmentRecordsService } from './treatment-records.service.js';

@Module({
  imports: [
    CqrsModule, // SaleCompletedHandler subscribes via EventBus
    CustomersModule, // CustomerRepository (referral code lookup, profile lookup)
    PosModule, // SalesService — the ONLY thing CrmModule needs from Pos (subscription renew)
    MongooseModule.forFeature([
      { name: TreatmentRecord.name, schema: TreatmentRecordSchema },
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: LoyaltyLedgerEntry.name, schema: LoyaltyLedgerEntrySchema },
      { name: GiftCard.name, schema: GiftCardSchema },
      { name: GiftCardLedgerEntry.name, schema: GiftCardLedgerEntrySchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: Referral.name, schema: ReferralSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      { name: CustomerSubscription.name, schema: CustomerSubscriptionSchema },
      // read access for the SaleCompleted handler + Customer 360 aggregation
      { name: Sale.name, schema: SaleSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
  ],
  controllers: [
    LoyaltyController,
    GiftCardsController,
    CouponsController,
    ReferralsController,
    TreatmentRecordsController,
    SubscriptionPlansController,
    CustomerSubscriptionsController,
    CustomerProfileController,
  ],
  providers: [
    LoyaltyService,
    GiftCardsService,
    CouponsService,
    ReferralsService,
    TreatmentRecordsService,
    SubscriptionsService,
    CustomerProfileService,
    SaleCompletedHandler,
  ],
})
export class CrmModule {}
