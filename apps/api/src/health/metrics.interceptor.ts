import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = performance.now() - start;
          const route = req.route?.path || req.baseUrl || req.path || 'unknown';
          this.metrics.recordRequest(req.method, route, res.statusCode || 200, duration);
        },
        error: (err: { status?: number }) => {
          const duration = performance.now() - start;
          const route = req.route?.path || req.baseUrl || req.path || 'unknown';
          const status = err.status || 500;
          this.metrics.recordRequest(req.method, route, status, duration);
        },
      }),
    );
  }
}
