'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();

export async function createSupplier(fd: FormData): Promise<void> {
  const phone = s(fd, 'phone');
  const email = s(fd, 'email');
  await apiFetch('/suppliers', {
    method: 'POST',
    body: JSON.stringify({
      name: s(fd, 'name'),
      contact: { phone: phone || undefined, email: email || undefined },
      address: s(fd, 'address') || undefined,
      note: s(fd, 'note') || undefined,
    }),
  });
  revalidatePath('/suppliers');
}

export async function deleteSupplier(id: string): Promise<void> {
  await apiFetch(`/suppliers/${id}`, { method: 'DELETE' });
  revalidatePath('/suppliers');
}
