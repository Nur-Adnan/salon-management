'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

const s = (fd: FormData, k: string): string => String(fd.get(k) ?? '').trim();

export async function runPayroll(fd: FormData): Promise<void> {
  const staffId = s(fd, 'staffId');
  const periodStart = s(fd, 'periodStart');
  const periodEnd = s(fd, 'periodEnd');
  if (!staffId || !periodStart || !periodEnd) return;
  await apiFetch('/payroll/run', {
    method: 'POST',
    body: JSON.stringify({
      staffId,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
    }),
  });
  revalidatePath('/payroll');
}

export async function markPaid(id: string): Promise<void> {
  await apiFetch(`/payroll/payslips/${id}/mark-paid`, { method: 'POST', body: JSON.stringify({}) });
  revalidatePath('/payroll');
}
