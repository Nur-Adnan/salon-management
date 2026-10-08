import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.decorator.js';
import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Extract real client IP handling reverse proxy headers safely
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (
      typeof forwarded === 'string'
        ? (forwarded.split(',')[0]?.trim() || '127.0.0.1')
        : req.socket.remoteAddress || req.ip || '127.0.0.1'
    );

    const prefix = options.keyPrefix ?? `${req.baseUrl || ''}${req.route?.path || req.path}`;
    const result = await this.rateLimitService.consume(
      ip,
      options.points,
      options.durationSeconds,
      prefix,
    );

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', options.points);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetSeconds);
    }

    if (!result.allowed) {
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', result.resetSeconds);
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please slow down and try again later.',
          retryAfter: result.resetSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
