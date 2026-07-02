'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();

export async function issueGiftCard(fd: FormData): Promise<void> {
  const amount = Math.round((Number.parseFloat(s(fd, 'amount')) || 0) * 100);
  if (amount <= 0) return;
  await apiFetch('/gift-cards', { method: 'POST', body: JSON.stringify({ amount }) });
  revalidatePath('/gift-cards');
}

export async function cancelGiftCard(id: string): Promise<void> {
  await apiFetch(`/gift-cards/${id}/cancel`, { method: 'POST' });
  revalidatePath('/gift-cards');
}
