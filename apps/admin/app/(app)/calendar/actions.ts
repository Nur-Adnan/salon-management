'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function getAvailability(
  staffId: string,
  serviceId: string,
  date: string,
): Promise<string[]> {
  if (!staffId || !serviceId || !date) return [];
  const r = await apiFetch<{ slots: string[] }>(
    `/appointments/availability?staffId=${staffId}&serviceId=${serviceId}&date=${date}`,
  );
  return r.data?.slots ?? [];
}

export async function createAppointment(input: {
  name: string;
  phone: string;
  serviceId: string;
  staffId: string;
  start: string;
}): Promise<{ ok: boolean; error?: string }> {
  const r = await apiFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      customer: { name: input.name, phone: input.phone },
      source: 'walk_in',
      lines: [{ serviceId: input.serviceId, staffId: input.staffId, start: input.start }],
    }),
  });
  revalidatePath('/calendar');
  if (r.status !== 201) {
    return { ok: false, error: r.status === 409 ? 'slot just taken' : `failed (${r.status})` };
  }
  return { ok: true };
}

export async function transitionAppointment(id: string, status: string): Promise<void> {
  await apiFetch(`/appointments/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
  revalidatePath('/calendar');
}

export async function addToWaitlist(fd: FormData): Promise<void> {
  await apiFetch('/waitlist', {
    method: 'POST',
    body: JSON.stringify({
      customer: { name: String(fd.get('name') ?? ''), phone: String(fd.get('phone') ?? '') },
      note: String(fd.get('note') ?? '') || undefined,
    }),
  });
  revalidatePath('/calendar');
}

export async function removeFromWaitlist(id: string): Promise<void> {
  await apiFetch(`/waitlist/${id}`, { method: 'DELETE' });
  revalidatePath('/calendar');
}
