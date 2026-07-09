'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();

export async function createPurchaseOrder(fd: FormData): Promise<void> {
  // Up to 3 line rows (product{i}, qty{i}, cost{i}); blank product rows skipped.
  // cost is entered in BDT and converted to poisha (× 100).
  const lines: { productId: string; quantity: number; unitCost: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const productId = s(fd, `product${i}`);
    if (!productId) continue;
    const quantity = Number.parseInt(s(fd, `qty${i}`), 10) || 0;
    const unitCost = Math.round((Number.parseFloat(s(fd, `cost${i}`)) || 0) * 100);
    if (quantity > 0) lines.push({ productId, quantity, unitCost });
  }
  if (lines.length === 0) return;

  await apiFetch('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({ supplierId: s(fd, 'supplierId'), lines, note: s(fd, 'note') || undefined }),
  });
  revalidatePath('/purchase-orders');
}

export async function receivePurchaseOrder(id: string): Promise<void> {
  await apiFetch(`/purchase-orders/${id}/receive`, { method: 'POST' });
  revalidatePath('/purchase-orders');
  revalidatePath('/inventory');
}

export async function cancelPurchaseOrder(id: string): Promise<void> {
  await apiFetch(`/purchase-orders/${id}/cancel`, { method: 'POST' });
  revalidatePath('/purchase-orders');
}
