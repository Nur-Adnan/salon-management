import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsInterceptor } from './metrics.interceptor.js';
import { MetricsService } from './metrics.service.js';
import { RedisHealthIndicator } from './redis.health.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, MetricsController],
  providers: [
    RedisHealthIndicator,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class HealthModule {}
