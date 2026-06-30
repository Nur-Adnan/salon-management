import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS } from '../infra/redis/redis.module.js';

// Custom Terminus indicator (v11 HealthIndicatorService API).
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const reply = await this.redis.ping();
      return reply === 'PONG' ? indicator.up() : indicator.down({ reply });
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}
