import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { calculateExplainableForecast, type ForecastResult } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { DailyRollup, type DailyRollupDocument } from './schemas/daily-rollup.schema.js';

@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);

  constructor(
    @InjectModel(DailyRollup.name) private readonly rollups: Model<DailyRollupDocument>,
  ) {}

  async getForecast(
    tenantId: Types.ObjectId,
    metric: 'sales' | 'appointments' = 'sales',
    daysAhead: number = 14,
    branchId?: Types.ObjectId | null,
  ): Promise<ForecastResult> {
    const historicalLimit = 60;
    const items = await this.rollups
      .find({
        tenantId,
        branchId: branchId ?? null,
      })
      .sort({ date: -1 })
      .limit(historicalLimit)
      .exec();

    // Reverse to chronological order (oldest -> newest)
    const chronological = items.reverse();

    const series = chronological.map((r) => ({
      date: r.date,
      value: metric === 'sales' ? (r.revenue?.net ?? 0) : (r.appointments?.total ?? 0),
    }));

    return calculateExplainableForecast(series, daysAhead);
  }
}
