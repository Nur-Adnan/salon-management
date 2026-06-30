import { Injectable } from '@nestjs/common';
import type { Role } from '@salon/shared';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface MembershipView {
  tenantId: string;
  branchId: string | null; // null = org-wide
  role: Role;
}

// Per-request identity + active tenant/branch scope. Populated by the auth guard,
// read by the tenant-scoped repository so no query can escape its tenant.
export interface RequestContext {
  userId?: string;
  supabaseUserId?: string;
  email?: string;
  tenantId?: string;
  branchId?: string;
  role?: Role;
  memberships: MembershipView[];
}

@Injectable()
export class RequestContextService {
  // ponytail: stdlib AsyncLocalStorage instead of nestjs-cls; one class, no new dep.
  private readonly als = new AsyncLocalStorage<RequestContext>();

  run<T>(seed: RequestContext, fn: () => T): T {
    return this.als.run(seed, fn);
  }

  get(): RequestContext | undefined {
    return this.als.getStore();
  }

  set(patch: Partial<RequestContext>): void {
    const store = this.als.getStore();
    if (store) Object.assign(store, patch);
  }
}
