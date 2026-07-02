'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();

export async function createCustomer(fd: FormData): Promise<void> {
  await apiFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: s(fd, 'name'), phone: s(fd, 'phone'), email: s(fd, 'email') || undefined }),
  });
  revalidatePath('/customers');
}

export async function updateProfile(id: string, fd: FormData): Promise<void> {
  const allergies = s(fd, 'allergies')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  await apiFetch(`/customers/${id}/profile`, {
    method: 'PATCH',
    body: JSON.stringify({ preferenceNotes: s(fd, 'preferenceNotes') || undefined, allergies }),
  });
  revalidatePath(`/customers/${id}`);
}

export async function getReferralCode(id: string): Promise<{ referralCode: string } | null> {
  const r = await apiFetch<{ referralCode: string }>(`/customers/${id}/referral-code`, { method: 'POST' });
  revalidatePath(`/customers/${id}`);
  return r.data;
}

// ---- treatment records ----
export async function createTreatmentRecord(customerId: string, fd: FormData): Promise<void> {
  const allergies = s(fd, 'allergies')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  await apiFetch('/treatment-records', {
    method: 'POST',
    body: JSON.stringify({
      customerId,
      colorFormula: s(fd, 'colorFormula') || undefined,
      notes: s(fd, 'notes') || undefined,
      allergies,
    }),
  });
  revalidatePath(`/customers/${customerId}`);
}

export async function addTreatmentPhoto(customerId: string, recordId: string, fd: FormData): Promise<void> {
  await apiFetch(`/treatment-records/${recordId}/photos`, {
    method: 'POST',
    body: JSON.stringify({ url: s(fd, 'url'), type: s(fd, 'type') || 'before' }),
  });
  revalidatePath(`/customers/${customerId}`);
}

export async function setPhotoConsent(
  customerId: string,
  recordId: string,
  photoId: string,
  action: 'grant' | 'decline' | 'revoke',
  scope?: string[],
): Promise<void> {
  await apiFetch(`/treatment-records/${recordId}/photos/${photoId}/consent`, {
    method: 'POST',
    body: JSON.stringify({ action, scope, method: action === 'grant' ? 'verbal' : undefined }),
  });
  revalidatePath(`/customers/${customerId}`);
}

// ---- loyalty ----
export async function adjustLoyalty(customerId: string, fd: FormData): Promise<void> {
  const points = Number(s(fd, 'points'));
  if (!points) return;
  await apiFetch(`/customers/${customerId}/loyalty/adjust`, {
    method: 'POST',
    body: JSON.stringify({ points, note: s(fd, 'note') || undefined }),
  });
  revalidatePath(`/customers/${customerId}`);
}

// ---- gift cards ----
export async function issueGiftCard(customerId: string, fd: FormData): Promise<void> {
  const amount = Math.round((Number.parseFloat(s(fd, 'amount')) || 0) * 100);
  if (amount <= 0) return;
  await apiFetch('/gift-cards', { method: 'POST', body: JSON.stringify({ amount, customerId }) });
  revalidatePath(`/customers/${customerId}`);
}

// ---- subscriptions ----
export async function subscribeCustomer(customerId: string, fd: FormData): Promise<void> {
  await apiFetch('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ customerId, planId: s(fd, 'planId') }),
  });
  revalidatePath(`/customers/${customerId}`);
}

export async function renewSubscription(customerId: string, subscriptionId: string, fd: FormData): Promise<void> {
  const amount = Math.round((Number.parseFloat(s(fd, 'amount')) || 0) * 100);
  const method = s(fd, 'method') || 'cash';
  await apiFetch(`/subscriptions/${subscriptionId}/renew`, {
    method: 'POST',
    headers: { 'idempotency-key': randomUUID() },
    body: JSON.stringify({ payments: amount > 0 ? [{ method, amount }] : [] }),
  });
  revalidatePath(`/customers/${customerId}`);
}

export async function cancelSubscription(customerId: string, subscriptionId: string): Promise<void> {
  await apiFetch(`/subscriptions/${subscriptionId}/cancel`, { method: 'POST' });
  revalidatePath(`/customers/${customerId}`);
}

// ---- referrals ----
export async function createReferral(customerId: string, fd: FormData): Promise<void> {
  await apiFetch(`/referrals`, {
    method: 'POST',
    body: JSON.stringify({ referrerCode: s(fd, 'referrerCode'), referredCustomerId: customerId }),
  });
  revalidatePath(`/customers/${customerId}`);
}
