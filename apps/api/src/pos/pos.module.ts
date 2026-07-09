import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { Package, PackageSchema } from '../catalog/schemas/package.schema.js';
import { Product, ProductSchema } from '../catalog/schemas/product.schema.js';
import { Service, ServiceSchema } from '../catalog/schemas/service.schema.js';
import { Coupon, CouponSchema } from '../crm/schemas/coupon.schema.js';
import { GiftCard, GiftCardSchema } from '../crm/schemas/gift-card.schema.js';
import { GiftCardLedgerEntry, GiftCardLedgerEntrySchema } from '../crm/schemas/gift-card-ledger-entry.schema.js';
import { LoyaltyAccount, LoyaltyAccountSchema } from '../crm/schemas/loyalty-account.schema.js';
import { LoyaltyLedgerEntry, LoyaltyLedgerEntrySchema } from '../crm/schemas/loyalty-ledger-entry.schema.js';
import { Referral, ReferralSchema } from '../crm/schemas/referral.schema.js';
import { SubscriptionPlan, SubscriptionPlanSchema } from '../crm/schemas/subscription-plan.schema.js';
import { Customer, CustomerSchema } from '../customers/customer.schema.js';
import { StaffEarningEntry, StaffEarningEntrySchema } from '../hr/schemas/staff-earning-entry.schema.js';
import { StockMovement, StockMovementSchema } from '../inventory/schemas/stock-movement.schema.js';
import { Branch, BranchSchema } from '../iam/schemas/branch.schema.js';
import { Membership, MembershipSchema } from '../iam/schemas/membership.schema.js';
import { Appointment, AppointmentSchema } from '../scheduling/schemas/appointment.schema.js';
import { PaymentGateway } from './payment/providers.js';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { Counter, CounterSchema } from './schemas/counter.schema.js';
import { Sale, SaleSchema } from './schemas/sale.schema.js';
import { StockLevel, StockLevelSchema } from './schemas/stock-level.schema.js';

@Module({
  imports: [
    CqrsModule, // EventBus for SaleCompleted / SaleVoided
    MongooseModule.forFeature([
      { name: Sale.name, schema: SaleSchema },
      { name: StockLevel.name, schema: StockLevelSchema },
      { name: Counter.name, schema: CounterSchema },
      // read access to catalog / tenancy / scheduling collections (models shared per connection)
      { name: Service.name, schema: ServiceSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Package.name, schema: PackageSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      // Phase 5 CRM collections — SalesService redeems/claims these directly
      // (never via CrmModule's services) so there is no circular module import;
      // CrmModule is the one that imports PosModule, never the reverse.
      { name: GiftCard.name, schema: GiftCardSchema },
      { name: GiftCardLedgerEntry.name, schema: GiftCardLedgerEntrySchema },
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: LoyaltyLedgerEntry.name, schema: LoyaltyLedgerEntrySchema },
      { name: Referral.name, schema: ReferralSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
      // Phase 6 HR: voidSale() reverses commission/tip entries synchronously
      // in its own transaction (see hr/ledger.util.ts) — same "redeem/claim
      // directly, no circular module import" convention as the CRM models above.
      { name: StaffEarningEntry.name, schema: StaffEarningEntrySchema },
      // Phase 7: checkout/void write StockMovements through applyStockDelta —
      // schema-level sharing, same no-circular-import convention as above.
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
  ],
  controllers: [SalesController],
  providers: [SalesService, PaymentGateway],
  exports: [SalesService],
})
export class PosModule {}
