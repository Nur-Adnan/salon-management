import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type MarkPayslipPaid,
  type RunPayroll,
  markPayslipPaidSchema,
  objectIdSchema,
  runPayrollSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializePayslip, serializeStaffEarningEntry } from './mappers.js';
import { PayrollService } from './payroll.service.js';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('earnings')
  @CheckAbility('read', 'Payroll')
  async earnings(@Query('staffId') staffId?: string) {
    return (await this.payroll.listEarnings(staffId)).map(serializeStaffEarningEntry);
  }

  @Post('run')
  @HttpCode(200)
  @CheckAbility('manage', 'Payroll')
  async run(@Body(new ZodValidationPipe(runPayrollSchema)) dto: RunPayroll) {
    const slip = await this.payroll.run(
      dto.staffId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
      dto.adjustments,
    );
    return serializePayslip(slip);
  }

  @Get('payslips')
  @CheckAbility('read', 'Payroll')
  async payslips(@Query('staffId') staffId?: string) {
    return (await this.payroll.listPayslips(staffId)).map(serializePayslip);
  }

  @Get('payslips/:id')
  @CheckAbility('read', 'Payroll')
  async payslip(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return serializePayslip(await this.payroll.getPayslip(id));
  }

  @Post('payslips/:id/mark-paid')
  @HttpCode(200)
  @CheckAbility('manage', 'Payroll')
  async markPaid(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(markPayslipPaidSchema)) dto: MarkPayslipPaid,
  ) {
    return serializePayslip(await this.payroll.markPaid(id, dto.disbursementNote));
  }
}
