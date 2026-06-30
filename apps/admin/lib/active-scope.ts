import { cookies } from 'next/headers';

export const TENANT_COOKIE = 'active_tenant';
export const BRANCH_COOKIE = 'active_branch';

// The active org/branch the user is operating in (sent to the API as headers).
export async function getActiveScope(): Promise<{ tenantId?: string; branchId?: string }> {
  const c = await cookies();
  return {
    tenantId: c.get(TENANT_COOKIE)?.value,
    branchId: c.get(BRANCH_COOKIE)?.value,
  };
}
