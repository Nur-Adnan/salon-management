'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export interface BarcodeProduct {
  id: string;
  name: { en: string; bn: string | null };
  retailPrice: { amount: number };
  taxable: boolean;
}

export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  if (!code.trim()) return null;
  const r = await apiFetch<BarcodeProduct>(`/catalog/products/barcode/${encodeURIComponent(code.trim())}`);
  return r.status === 200 ? r.data : null;
}

export interface CheckoutLine {
  kind: 'service' | 'product' | 'package';
  refId: string;
  quantity: number;
  discount: number;
  staffId?: string;
}

export interface CheckoutPayment {
  method: string;
  amount: number;
  providerRef?: string; // the card code, for method: 'gift_card'
}

export interface CheckoutInput {
  customerId?: string;
  lines: CheckoutLine[];
  tip: number;
  payments: CheckoutPayment[];
  couponCode?: string;
  note?: string;
}

export async function checkout(
  input: CheckoutInput,
): Promise<{ ok: boolean; sale?: unknown; error?: string }> {
  // A fresh key per checkout attempt; the API dedupes replays of the same key.
  const key = randomUUID();
  const r = await apiFetch('/sales', {
    method: 'POST',
    headers: { 'idempotency-key': key },
    body: JSON.stringify({
      customerId: input.customerId || undefined,
      lines: input.lines,
      tip: input.tip,
      payments: input.payments,
      couponCode: input.couponCode || undefined,
      note: input.note || undefined,
    }),
  });
  if (r.status !== 201) {
    const msg = Array.isArray((r.data as { message?: unknown })?.message)
      ? ((r.data as { message: string[] }).message.join('; '))
      : `checkout failed (${r.status})`;
    return { ok: false, error: msg };
  }
  revalidatePath('/sales');
  return { ok: true, sale: r.data };
}
