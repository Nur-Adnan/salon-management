import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { type Observable, catchError, from, of, switchMap, tap } from 'rxjs';
import { REDIS } from '../../infra/redis/redis.module.js';

// Replays the stored response for a repeated (tenant, Idempotency-Key). Applied to
// mutating routes that create money/inventory/appointment effects. Degrades to
// pass-through if Redis is unavailable (no key, no dedupe) rather than failing the request.
// ponytail: 24h window, JSON body cache. Phase 4 hardens this for the money paths.
const TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.header('idempotency-key');
    if (!key) return next.handle();

    const tenantId = (req.headers['x-tenant-id'] as string) ?? 'public';
    // Scope the cache entry to the specific endpoint (controller.handler), so a
    // client that reuses one Idempotency-Key across different routes can't be
    // served another route's stored response body.
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const cacheKey = `idem:${tenantId}:${route}:${key}`;

    return from(this.redis.get(cacheKey)).pipe(
      catchError(() => of(null)),
      switchMap((cached) => {
        if (cached) return of(JSON.parse(cached) as unknown);
        return next.handle().pipe(
          tap((body) => {
            void this.redis
              .set(cacheKey, JSON.stringify(body), 'EX', TTL_SECONDS, 'NX')
              .catch(() => undefined);
          }),
        );
      }),
    );
  }
}
