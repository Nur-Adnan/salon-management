import { ForbiddenException } from '@nestjs/common';
import type { MembershipView, RequestContext } from '../../common/context/request-context.service.js';

type ResolvedScope = Pick<RequestContext, 'tenantId' | 'branchId' | 'role'>;

// Turn the x-tenant-id / x-branch-id headers into an active scope, validated
// against the user's memberships. Requesting a tenant/branch you don't belong to
// is a 403 — this is the cross-tenant / cross-branch gate.
export function resolveScope(
  memberships: MembershipView[],
  tenantHeader?: string,
  branchHeader?: string,
): ResolvedScope {
  if (!tenantHeader) {
    if (branchHeader) throw new ForbiddenException('x-branch-id requires x-tenant-id');
    return {}; // no active tenant — only bootstrap routes (create org) work
  }

  const inTenant = memberships.filter((m) => m.tenantId === tenantHeader);
  if (inTenant.length === 0) throw new ForbiddenException('Not a member of this tenant');

  const orgWide = inTenant.find((m) => m.branchId === null);

  if (!branchHeader) {
    const chosen = orgWide ?? inTenant[0]!;
    return { tenantId: tenantHeader, branchId: chosen.branchId ?? undefined, role: chosen.role };
  }

  // Org-wide membership grants every branch; otherwise need a membership for it.
  const chosen = inTenant.find((m) => m.branchId === branchHeader) ?? orgWide;
  if (!chosen) throw new ForbiddenException('Not a member of this branch');
  return { tenantId: tenantHeader, branchId: branchHeader, role: chosen.role };
}
