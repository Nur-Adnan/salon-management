'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();

export async function createPlan(fd: FormData): Promise<void> {
  const price = Math.round((Number.parseFloat(s(fd, 'price')) || 0) * 100);
  await apiFetch('/subscription-plans', {
    method: 'POST',
    body: JSON.stringify({
      name: { en: s(fd, 'en') },
      price: { amount: price },
      billingPeriodDays: Number(s(fd, 'billingPeriodDays')) || 30,
    }),
  });
  revalidatePath('/subscription-plans');
}

export async function togglePlan(id: string, active: boolean): Promise<void> {
  await apiFetch(`/subscription-plans/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !active }) });
  revalidatePath('/subscription-plans');
}
