'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { MembershipView } from '@/lib/api';
import { setScope } from './actions';

const selectCls = 'rounded-medium border border-default-300 bg-default-50 px-2 py-1 text-sm';

export function ScopeSwitcher({
  memberships,
  activeTenantId,
  activeBranchId,
}: {
  memberships: MembershipView[];
  activeTenantId: string | null;
  activeBranchId: string | null;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  if (memberships.length === 0) return null;

  const value = `${activeTenantId ?? ''}|${activeBranchId ?? ''}`;
  return (
    <select
      aria-label="Active org/branch"
      className={selectCls}
      value={value}
      onChange={(e) => {
        const [tenantId, branchId] = e.target.value.split('|');
        start(async () => {
          await setScope(tenantId ?? '', branchId || null);
          router.refresh();
        });
      }}
    >
      {memberships.map((m) => (
        <option key={`${m.tenantId}|${m.branchId ?? ''}`} value={`${m.tenantId}|${m.branchId ?? ''}`}>
          {m.role} · {m.branchId ? `branch …${m.branchId.slice(-4)}` : 'org-wide'}
        </option>
      ))}
    </select>
  );
}
