'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();
const n = (fd: FormData, k: string): number => Number.parseInt(s(fd, k), 10) || 0;

export async function setStock(fd: FormData): Promise<void> {
  await apiFetch('/inventory/stock', {
    method: 'PUT',
    body: JSON.stringify({ productId: s(fd, 'productId'), qtyOnHand: n(fd, 'qtyOnHand') }),
  });
  revalidatePath('/inventory');
}

export async function setReorder(fd: FormData): Promise<void> {
  await apiFetch('/inventory/reorder', {
    method: 'PUT',
    body: JSON.stringify({ productId: s(fd, 'productId'), reorderPoint: n(fd, 'reorderPoint') }),
  });
  revalidatePath('/inventory');
}

export async function adjustStock(fd: FormData): Promise<void> {
  await apiFetch('/inventory/adjustments', {
    method: 'POST',
    body: JSON.stringify({
      productId: s(fd, 'productId'),
      qtyDelta: n(fd, 'qtyDelta'),
      reason: s(fd, 'reason'),
      note: s(fd, 'note') || undefined,
    }),
  });
  revalidatePath('/inventory');
}
