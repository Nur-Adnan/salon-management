import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import {
  type RequestContext,
  RequestContextService,
} from '../../common/context/request-context.service.js';
import { ProvisioningService } from './provisioning.service.js';
import { IS_PUBLIC } from './public.decorator.js';
import { resolveScope } from './scope.resolver.js';
import type { SupabaseJwtPayload } from './supabase-jwt.strategy.js';

// Global guard: validates the Supabase JWT, provisions the user, resolves the
// active tenant/branch from headers (against memberships), and populates the
// request context that scopes every downstream query.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly provisioning: ProvisioningService,
    private readonly ctx: RequestContextService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const ok = (await super.canActivate(context)) as boolean; // runs strategy -> req.user
    if (!ok) return false;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user: SupabaseJwtPayload; context?: RequestContext }>();

    const { user, memberships } = await this.provisioning.provisionAndLoad(req.user);
    const scope = resolveScope(memberships, header(req, 'x-tenant-id'), header(req, 'x-branch-id'));

    const resolved: RequestContext = {
      userId: String(user._id),
      supabaseUserId: user.supabaseUserId,
      email: user.email,
      memberships,
      ...scope,
    };
    this.ctx.set(resolved);
    req.context = resolved; // for @CurrentUser
    return true;
  }

  override handleRequest<T = SupabaseJwtPayload>(err: unknown, user: T): T {
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException();
    return user;
  }
}

function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
