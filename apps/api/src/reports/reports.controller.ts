import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  type ReportRangeQuery,
  type ReportSalesQuery,
  reportRangeQuerySchema,
  reportSalesQuerySchema,
} from '@salon/shared';
import type { Response } from 'express';
import { Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { ExportService } from './export.service.js';
import { ForecastingService } from './forecasting.service.js';
import { ReportsService } from './reports.service.js';
import { RollupService } from './rollup.service.js';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly rollupService: RollupService,
    private readonly forecastingService: ForecastingService,
    private readonly exportService: ExportService,
    private readonly ctx: RequestContextService,
  ) {}

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

  // --- Phase 11: Enterprise Analytics, Rollups, Forecast & Export ---

  @Get('dashboard-summary')
  @CheckAbility('read', 'Report')
  async dashboardSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId?: string,
  ) {
    const c = this.ctx.get();
    const tenantId = new Types.ObjectId(c!.tenantId);
    const bId = branchId ? new Types.ObjectId(branchId) : c?.branchId ? new Types.ObjectId(c.branchId) : null;
    return this.rollupService.getDashboardSummary(tenantId, from, to, bId);
  }

  @Get('cohort-retention')
  @CheckAbility('read', 'Report')
  async cohortRetention() {
    const c = this.ctx.get();
    const tenantId = new Types.ObjectId(c!.tenantId);
    return this.rollupService.getCohortRetention(tenantId);
  }

  @Get('churn')
  @CheckAbility('read', 'Report')
  async churn(@Query('inactiveDays') inactiveDays?: string) {
    const c = this.ctx.get();
    const tenantId = new Types.ObjectId(c!.tenantId);
    return this.rollupService.getChurnMetrics(tenantId, inactiveDays ? Number(inactiveDays) : 60);
  }

  @Get('forecast')
  @CheckAbility('read', 'Report')
  async forecast(
    @Query('metric') metric?: 'sales' | 'appointments',
    @Query('daysAhead') daysAhead?: string,
  ) {
    const c = this.ctx.get();
    const tenantId = new Types.ObjectId(c!.tenantId);
    const bId = c?.branchId ? new Types.ObjectId(c.branchId) : null;
    return this.forecastingService.getForecast(
      tenantId,
      metric ?? 'sales',
      daysAhead ? Number(daysAhead) : 14,
      bId,
    );
  }

  @Get('export')
  @CheckAbility('read', 'Report')
  async exportReport(
    @Query('type') type: 'sales' | 'staff' | 'inventory',
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: 'csv' | 'excel' | 'pdf' = 'csv',
    @Res() res: Response,
  ) {
    let data: any;
    if (type === 'sales') {
      data = await this.reports.salesReport(from, to, 'day');
    } else if (type === 'staff') {
      data = await this.reports.staffPerformance(from, to);
    } else {
      data = await this.reports.inventoryValue(from, to);
    }

    const result = this.exportService.exportReport(type, data, format);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  }

  @Post('recompute-rollups')
  @CheckAbility('manage', 'Report')
  async recomputeRollups(@Body() body: { date: string; branchId?: string }) {
    const c = this.ctx.get();
    const tenantId = new Types.ObjectId(c!.tenantId);
    const bId = body.branchId ? new Types.ObjectId(body.branchId) : null;
    return this.rollupService.generateDailyRollup(tenantId, body.date, bId);
  }
}
