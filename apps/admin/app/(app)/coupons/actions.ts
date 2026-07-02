'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();

export async function createCoupon(fd: FormData): Promise<void> {
  const type = s(fd, 'type') as 'percent' | 'fixed';
  const rawValue = Number.parseFloat(s(fd, 'value')) || 0;
  // percent: "10" (meaning 10%) -> 1000 basis points. fixed: "100" (BDT) -> 10000 poisha.
  // Both are the same "× 100" conversion, just with a different unit on the input.
  const value = Math.round(rawValue * 100);
  const minSpendBdt = Number.parseFloat(s(fd, 'minSpend')) || 0;
  const maxRedemptions = Number.parseInt(s(fd, 'maxRedemptions'), 10);

  await apiFetch('/coupons', {
    method: 'POST',
    body: JSON.stringify({
      code: s(fd, 'code'),
      type,
      value,
      minSpend: Math.round(minSpendBdt * 100),
      maxRedemptions: Number.isFinite(maxRedemptions) && maxRedemptions > 0 ? maxRedemptions : undefined,
    }),
  });
  revalidatePath('/coupons');
}

export async function toggleCoupon(id: string, active: boolean): Promise<void> {
  await apiFetch(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !active }) });
  revalidatePath('/coupons');
}

export async function deleteCoupon(id: string): Promise<void> {
  await apiFetch(`/coupons/${id}`, { method: 'DELETE' });
  revalidatePath('/coupons');
}
