import { Button } from '@salon/ui';
import { type Me, apiFetch } from '@/lib/api';
import { createBranch, createOrganization } from './actions';

interface Branch {
  id: string;
  name: string;
  timezone: string;
  status: string;
}

const inputCls =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function Dashboard() {
  const me = (await apiFetch<Me>('/me')).data;

  if (!me || me.memberships.length === 0) {
    return (
      <section className="flex max-w-sm flex-col gap-3">
        <h1 className="text-xl font-bold">Create your salon</h1>
        <p className="text-sm opacity-70">You are not part of any workspace yet.</p>
        <form action={createOrganization} className="flex flex-col gap-2">
          <input name="name" placeholder="Business name" className={inputCls} required />
          <input name="slug" placeholder="url-slug" className={inputCls} required />
          <Button type="submit">Create organization</Button>
        </form>
      </section>
    );
  }

  if (!me.activeTenantId) {
    return <p className="opacity-70">Select a workspace from the switcher above.</p>;
  }

  const branches = (await apiFetch<Branch[]>('/branches')).data ?? [];

  // KPI tiles — only for roles with report access (403 => skip silently).
  const [salesRes, invRes, crmRes] = await Promise.all([
    apiFetch<{ totals: { net: number; count: number } }>('/reports/sales'),
    apiFetch<{ totalValue: number; lowStockCount: number }>('/reports/inventory-value'),
    apiFetch<{ giftCardOutstandingMinor: number; loyaltyValueMinor: number; dueBalanceMinor: number }>('/reports/crm-liabilities'),
  ]);
  const bdt = (p: number) => `৳${(p / 100).toFixed(2)}`;
  const kpis =
    salesRes.status !== 403
      ? [
          { label: 'Net sales (all-time)', value: bdt(salesRes.data?.totals.net ?? 0) },
          { label: 'Sales count', value: String(salesRes.data?.totals.count ?? 0) },
          { label: 'Stock value', value: bdt(invRes.data?.totalValue ?? 0) },
          { label: 'Low-stock items', value: String(invRes.data?.lowStockCount ?? 0) },
          { label: 'Outstanding due', value: bdt(crmRes.data?.dueBalanceMinor ?? 0) },
          { label: 'Gift-card liability', value: bdt(crmRes.data?.giftCardOutstandingMinor ?? 0) },
        ]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm opacity-70">
          Active: {me.activeBranchId ? `branch …${me.activeBranchId.slice(-4)}` : 'org-wide'} · role{' '}
          <span className="text-brand">{me.role}</span>
        </p>
      </div>

      {kpis.length > 0 ? (
        <section className="flex flex-wrap gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-medium border border-default-200 px-4 py-3 text-sm">
              <div className="opacity-60">{k.label}</div>
              <div className="text-lg font-bold">{k.value}</div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Branches</h2>
        <ul className="text-sm">
          {branches.map((b) => (
            <li key={b.id}>
              {b.name} <span className="opacity-50">({b.status})</span>
            </li>
          ))}
          {branches.length === 0 ? <li className="opacity-50">No branches yet.</li> : null}
        </ul>
        {/* The API rejects this for roles without `create Branch`. */}
        <form action={createBranch} className="flex max-w-sm gap-2">
          <input name="name" placeholder="New branch name" className={inputCls} required />
          <Button type="submit">Add</Button>
        </form>
      </section>
    </div>
  );
}
