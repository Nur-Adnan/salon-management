import { Controller, Get } from '@nestjs/common';
import type { RequestContext } from '../common/context/request-context.service.js';
import { CurrentUser } from './auth/current-user.decorator.js';

@Controller()
export class IamController {
  // Identity + memberships + active scope. No tenant required (a fresh user with
  // no memberships calls this to discover they need to create/join an org).
  @Get('me')
  me(@CurrentUser() ctx?: RequestContext) {
    return {
      userId: ctx?.userId ?? null,
      email: ctx?.email ?? null,
      activeTenantId: ctx?.tenantId ?? null,
      activeBranchId: ctx?.branchId ?? null,
      role: ctx?.role ?? null,
      memberships: ctx?.memberships ?? [],
    };
  }
}
