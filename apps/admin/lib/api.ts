import { getActiveScope } from './active-scope';
import { createClient } from './supabase/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Server-side call to the NestJS API: attaches the Supabase access token plus the
// active tenant/branch headers (which the API validates against memberships).
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { tenantId?: string; branchId?: string } = {},
): Promise<{ status: number; data: T | null }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const scope = await getActiveScope();

  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (session?.access_token) headers.set('authorization', `Bearer ${session.access_token}`);
  const tenantId = init.tenantId ?? scope.tenantId;
  const branchId = init.branchId ?? scope.branchId;
  if (tenantId) headers.set('x-tenant-id', tenantId);
  if (branchId) headers.set('x-branch-id', branchId);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    // empty body
  }
  return { status: res.status, data };
}

export interface MembershipView {
  tenantId: string;
  branchId: string | null;
  role: string;
}
export interface Me {
  userId: string | null;
  email: string | null;
  activeTenantId: string | null;
  activeBranchId: string | null;
  role: string | null;
  memberships: MembershipView[];
}
export interface ResourceView {
  id: string;
  branchId: string;
  name: string;
  type: string;
  capacity: number;
  bookable: boolean;
}
