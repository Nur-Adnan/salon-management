import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { RequestContext } from '../../common/context/request-context.service.js';

// Returns the resolved identity + active scope (attached by JwtAuthGuard).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext | undefined => {
    const req = ctx.switchToHttp().getRequest<{ context?: RequestContext }>();
    return req.context;
  },
);
