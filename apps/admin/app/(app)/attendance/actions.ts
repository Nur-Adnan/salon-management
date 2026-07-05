'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function clockIn(): Promise<void> {
  await apiFetch('/attendance/clock-in', { method: 'POST', body: JSON.stringify({}) });
  revalidatePath('/attendance');
}

export async function clockOut(): Promise<void> {
  await apiFetch('/attendance/clock-out', { method: 'POST', body: JSON.stringify({}) });
  revalidatePath('/attendance');
}
