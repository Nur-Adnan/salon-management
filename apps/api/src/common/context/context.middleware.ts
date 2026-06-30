import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service.js';

// Establishes a fresh AsyncLocalStorage store for the whole request; the auth
// guard fills it in. Runs before guards, so the store exists by the time they do.
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly ctx: RequestContextService) {}

  use(_req: Request, _res: Response, next: NextFunction): void {
    this.ctx.run({ memberships: [] }, () => next());
  }
}
