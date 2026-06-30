'use server';

import { LOCALES, type Locale } from '@salon/shared';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BRANCH_COOKIE, TENANT_COOKIE } from '@/lib/active-scope';
import { apiFetch } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

export async function setScope(tenantId: string, branchId: string | null): Promise<void> {
  const c = await cookies();
  c.set(TENANT_COOKIE, tenantId, { path: '/' });
  if (branchId) c.set(BRANCH_COOKIE, branchId, { path: '/' });
  else c.delete(BRANCH_COOKIE);
  revalidatePath('/', 'layout');
}

export async function setLocale(locale: Locale): Promise<void> {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  const c = await cookies();
  c.set('locale', locale, { path: '/' });
  revalidatePath('/', 'layout');
}

export async function createOrganization(formData: FormData): Promise<void> {
  const body = {
    name: String(formData.get('name') ?? ''),
    slug: String(formData.get('slug') ?? ''),
  };
  const r = await apiFetch<{ id: string }>('/organizations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (r.status === 201 && r.data?.id) await setScope(r.data.id, null);
  revalidatePath('/', 'layout');
}

export async function createBranch(formData: FormData): Promise<void> {
  await apiFetch('/branches', {
    method: 'POST',
    body: JSON.stringify({ name: String(formData.get('name') ?? '') }),
  });
  revalidatePath('/', 'layout');
}

export async function createResource(formData: FormData): Promise<void> {
  await apiFetch('/resources', {
    method: 'POST',
    body: JSON.stringify({
      name: String(formData.get('name') ?? ''),
      type: String(formData.get('type') ?? 'chair'),
    }),
  });
  revalidatePath('/resources');
}

export async function inviteMember(formData: FormData): Promise<void> {
  const branchId = String(formData.get('branchId') ?? '');
  await apiFetch('/invitations', {
    method: 'POST',
    body: JSON.stringify({
      email: String(formData.get('email') ?? ''),
      role: String(formData.get('role') ?? 'stylist'),
      branchId: branchId || undefined,
    }),
  });
  revalidatePath('/team');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
