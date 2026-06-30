import { ThemeSwitch } from '@salon/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { type Me, apiFetch } from '@/lib/api';
import { signOut } from './actions';
import { ScopeSwitcher } from './scope-switcher';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await apiFetch<Me>('/me');
  if (me.status === 401 || !me.data) redirect('/login');
  const data = me.data;

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-default-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-brand">
            Salon Admin
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm opacity-80">
            <Link href="/resources">Resources</Link>
            <Link href="/catalog/services">Services</Link>
            <Link href="/catalog/products">Products</Link>
            <Link href="/catalog/packages">Packages</Link>
            <Link href="/team">Team</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ScopeSwitcher
            memberships={data.memberships}
            activeTenantId={data.activeTenantId}
            activeBranchId={data.activeBranchId}
          />
          <span className="text-sm opacity-60">{data.email}</span>
          <ThemeSwitch />
          <form action={signOut}>
            <button type="submit" className="text-sm opacity-70 hover:opacity-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
