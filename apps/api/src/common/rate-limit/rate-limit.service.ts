import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../infra/redis/redis.module.js';

export interface RateLimitResult {
  allowed: boolean;
  total: number;
  remaining: number;
  resetSeconds: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  // In-memory sliding window fallback when Redis is unavailable or in unit tests
  private readonly memoryStore = new Map<string, number[]>();

  constructor(@Optional() @Inject(REDIS) private readonly redis?: Redis) {}

  async consume(
    identifier: string,
    points: number,
    durationSeconds: number,
    prefix = 'default',
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - durationSeconds * 1000;

    if (this.redis && this.redis.status === 'ready') {
      try {
        const pipeline = this.redis.pipeline();
        // Remove old entries outside the window
        pipeline.zremrangebyscore(key, 0, windowStart);
        // Add current hit
        pipeline.zadd(key, now, `${now}:${Math.random()}`);
        // Count entries in the current window
        pipeline.zcard(key);
        // Set expiry on key
        pipeline.expire(key, durationSeconds + 1);

        const results = await pipeline.exec();
        const total = (results?.[2]?.[1] as number) ?? 1;
        const allowed = total <= points;
        const remaining = Math.max(0, points - total);

        return {
          allowed,
          total,
          remaining,
          resetSeconds: durationSeconds,
        };
      } catch (err: unknown) {
        this.logger.warn(`Redis rate limit error, falling back to memory: ${(err as Error).message}`);
      }
    }

    // Memory sliding-window fallback
    const history = (this.memoryStore.get(key) ?? []).filter((ts) => ts > windowStart);
    history.push(now);
    this.memoryStore.set(key, history);

    const total = history.length;
    const allowed = total <= points;
    const remaining = Math.max(0, points - total);

    return {
      allowed,
      total,
      remaining,
      resetSeconds: durationSeconds,
    };
  }

  // Helper for tests to clear state
  resetMemoryStore(): void {
    this.memoryStore.clear();
  }
}
