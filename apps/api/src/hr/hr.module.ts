import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { IamModule } from '../iam/iam.module.js';
import { Membership, MembershipSchema } from '../iam/schemas/membership.schema.js';
import { Sale, SaleSchema } from '../pos/schemas/sale.schema.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { HrSaleCompletedHandler } from './events/sale-completed.handler.js';
import { PayrollController } from './payroll.controller.js';
import { PayrollService } from './payroll.service.js';
import { AttendanceRecord, AttendanceRecordSchema } from './schemas/attendance-record.schema.js';
import { Payslip, PayslipSchema } from './schemas/payslip.schema.js';
import { StaffCompensation, StaffCompensationSchema } from './schemas/staff-compensation.schema.js';
import { StaffEarningEntry, StaffEarningEntrySchema } from './schemas/staff-earning-entry.schema.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [
    CqrsModule, // HrSaleCompletedHandler subscribes via EventBus (void-time reversal is synchronous — see pos/sales.service.ts)
    IamModule, // AbilityFactory — self-vs-manage checks in Staff/Attendance/Payroll services
    MongooseModule.forFeature([
      { name: StaffCompensation.name, schema: StaffCompensationSchema },
      { name: AttendanceRecord.name, schema: AttendanceRecordSchema },
      { name: StaffEarningEntry.name, schema: StaffEarningEntrySchema },
      { name: Payslip.name, schema: PayslipSchema },
      // Read access only, re-registered directly (matching how PosModule/
      // CrmModule share models across module boundaries with no circular
      // import): Membership for assertStaffMember, Sale for the event handler.
      { name: Membership.name, schema: MembershipSchema },
      { name: Sale.name, schema: SaleSchema },
    ]),
  ],
  controllers: [StaffController, AttendanceController, PayrollController],
  providers: [StaffService, AttendanceService, PayrollService, HrSaleCompletedHandler],
})
export class HrModule {}
