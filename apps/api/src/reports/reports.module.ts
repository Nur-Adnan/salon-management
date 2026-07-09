import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../catalog/schemas/product.schema.js';
import { CustomerSubscription, CustomerSubscriptionSchema } from '../crm/schemas/customer-subscription.schema.js';
import { GiftCard, GiftCardSchema } from '../crm/schemas/gift-card.schema.js';
import { LoyaltyAccount, LoyaltyAccountSchema } from '../crm/schemas/loyalty-account.schema.js';
import { AttendanceRecord, AttendanceRecordSchema } from '../hr/schemas/attendance-record.schema.js';
import { StaffEarningEntry, StaffEarningEntrySchema } from '../hr/schemas/staff-earning-entry.schema.js';
import { Branch, BranchSchema } from '../iam/schemas/branch.schema.js';
import { Sale, SaleSchema } from '../pos/schemas/sale.schema.js';
import { StockLevel, StockLevelSchema } from '../pos/schemas/stock-level.schema.js';
import { Appointment, AppointmentSchema } from '../scheduling/schemas/appointment.schema.js';
import { PurchaseOrder, PurchaseOrderSchema } from '../suppliers/schemas/purchase-order.schema.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

// Read-only cross-cutting analytics: registers the collections it aggregates
// directly (schema-level sharing, never writes) — no service cross-imports.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name, schema: SaleSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: StaffEarningEntry.name, schema: StaffEarningEntrySchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: StockLevel.name, schema: StockLevelSchema },
      { name: Product.name, schema: ProductSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: GiftCard.name, schema: GiftCardSchema },
      { name: CustomerSubscription.name, schema: CustomerSubscriptionSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
