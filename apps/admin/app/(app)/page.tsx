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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm opacity-70">
          Active: {me.activeBranchId ? `branch …${me.activeBranchId.slice(-4)}` : 'org-wide'} · role{' '}
          <span className="text-brand">{me.role}</span>
        </p>
      </div>

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
