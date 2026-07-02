'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function voidSale(id: string): Promise<void> {
  await apiFetch(`/sales/${id}/void`, { method: 'POST', body: JSON.stringify({}) });
  revalidatePath('/sales');
}
