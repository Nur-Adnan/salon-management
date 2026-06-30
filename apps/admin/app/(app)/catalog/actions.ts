'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

// User types prices in BDT; store integer minor units (poisha). Round at the input
// boundary so the domain never sees a float.
const toPoisha = (bdt: FormDataEntryValue | null): number =>
  Math.round(Number.parseFloat(String(bdt ?? '0')) * 100) || 0;

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();
const name = (fd: FormData) => ({ en: s(fd, 'en'), bn: s(fd, 'bn') || undefined });

// ---- services ----
export async function createServiceCategory(fd: FormData): Promise<void> {
  await apiFetch('/catalog/service-categories', {
    method: 'POST',
    body: JSON.stringify({ name: { en: s(fd, 'en') } }),
  });
  revalidatePath('/catalog/services');
}

export async function createService(fd: FormData): Promise<void> {
  await apiFetch('/catalog/services', {
    method: 'POST',
    body: JSON.stringify({
      name: name(fd),
      categoryId: s(fd, 'categoryId') || undefined,
      durationMin: Number(s(fd, 'durationMin')) || 30,
      price: { amount: toPoisha(fd.get('price')) },
      taxable: fd.get('taxable') === 'on',
    }),
  });
  revalidatePath('/catalog/services');
}

export async function deleteService(id: string): Promise<void> {
  await apiFetch(`/catalog/services/${id}`, { method: 'DELETE' });
  revalidatePath('/catalog/services');
}

// ---- products ----
export async function createProductCategory(fd: FormData): Promise<void> {
  await apiFetch('/catalog/product-categories', {
    method: 'POST',
    body: JSON.stringify({ name: { en: s(fd, 'en') } }),
  });
  revalidatePath('/catalog/products');
}

export async function createProduct(fd: FormData): Promise<void> {
  await apiFetch('/catalog/products', {
    method: 'POST',
    body: JSON.stringify({
      name: name(fd),
      categoryId: s(fd, 'categoryId') || undefined,
      sku: s(fd, 'sku'),
      barcode: s(fd, 'barcode') || undefined,
      retailPrice: { amount: toPoisha(fd.get('retailPrice')) },
      cost: { amount: toPoisha(fd.get('cost')) },
      taxable: fd.get('taxable') === 'on',
      expiryTracked: fd.get('expiryTracked') === 'on',
    }),
  });
  revalidatePath('/catalog/products');
}

export async function deleteProduct(id: string): Promise<void> {
  await apiFetch(`/catalog/products/${id}`, { method: 'DELETE' });
  revalidatePath('/catalog/products');
}

// ---- packages ----
export async function createPackage(fd: FormData): Promise<void> {
  const serviceIds = fd.getAll('serviceIds').map(String).filter(Boolean);
  await apiFetch('/catalog/packages', {
    method: 'POST',
    body: JSON.stringify({
      name: { en: s(fd, 'en') },
      items: serviceIds.map((id) => ({ kind: 'service', refId: id, quantity: 1 })),
      price: { amount: toPoisha(fd.get('price')) },
      validityDays: Number(s(fd, 'validityDays')) || 90,
    }),
  });
  revalidatePath('/catalog/packages');
}

export async function deletePackage(id: string): Promise<void> {
  await apiFetch(`/catalog/packages/${id}`, { method: 'DELETE' });
  revalidatePath('/catalog/packages');
}
