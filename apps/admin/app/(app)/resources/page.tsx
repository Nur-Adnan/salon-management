import { RESOURCE_TYPES } from '@salon/shared';
import { Button } from '@salon/ui';
import { type ResourceView, apiFetch } from '@/lib/api';
import { createResource } from '../actions';

const inputCls =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function ResourcesPage() {
  const res = await apiFetch<ResourceView[]>('/resources');

  if (res.status === 403) {
    return (
      <p className="opacity-70">
        Select a branch from the switcher above to view its resources (chairs, rooms, stations).
      </p>
    );
  }

  const resources = res.data ?? [];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Resources</h1>
      <ul className="text-sm">
        {resources.map((r) => (
          <li key={r.id}>
            {r.name} <span className="opacity-50">· {r.type} · cap {r.capacity}</span>
          </li>
        ))}
        {resources.length === 0 ? <li className="opacity-50">No resources yet.</li> : null}
      </ul>

      {/* The API enforces `create Resource` (owner/manager only). */}
      <form action={createResource} className="flex max-w-md flex-wrap gap-2">
        <input name="name" placeholder="Resource name" className={inputCls} required />
        <select name="type" className={inputCls} defaultValue="chair">
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button type="submit">Add resource</Button>
      </form>
    </div>
  );
}
