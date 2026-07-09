import { Controller, Get, Query } from '@nestjs/common';
import {
  type ReportRangeQuery,
  type ReportSalesQuery,
  reportRangeQuerySchema,
  reportSalesQuerySchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  @CheckAbility('read', 'Report')
  sales(@Query(new ZodValidationPipe(reportSalesQuerySchema)) q: ReportSalesQuery) {
    return this.reports.salesReport(q.from, q.to, q.groupBy);
  }

  @Get('staff-performance')
  @CheckAbility('read', 'Report')
  staff(@Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery) {
    return this.reports.staffPerformance(q.from, q.to);
  }

  @Get('inventory-value')
  @CheckAbility('read', 'Report')
  inventory(@Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery) {
    return this.reports.inventoryValue(q.from, q.to);
  }

  @Get('appointments')
  @CheckAbility('read', 'Report')
  appointments(@Query(new ZodValidationPipe(reportRangeQuerySchema)) q: ReportRangeQuery) {
    return this.reports.appointments(q.from, q.to);
  }

  @Get('crm-liabilities')
  @CheckAbility('read', 'Report')
  crmLiabilities() {
    return this.reports.crmLiabilities();
  }
}
