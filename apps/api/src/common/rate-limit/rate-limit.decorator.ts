import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  points: number; // Max allowed requests
  durationSeconds: number; // Time window in seconds
  keyPrefix?: string; // Optional custom prefix
}

export const RATE_LIMIT_KEY = 'RATE_LIMIT_KEY';

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
