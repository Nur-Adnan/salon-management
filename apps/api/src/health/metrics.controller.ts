import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../iam/auth/public.decorator.js';
import { MetricsService } from './metrics.service.js';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    return this.metrics.getPrometheusFormat();
  }
}
