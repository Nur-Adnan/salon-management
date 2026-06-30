import { formatMoney } from '@salon/shared';
import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { createPackage, deletePackage } from '../actions';

interface Named {
  en: string;
  bn: string | null;
}
interface Money {
  amount: number;
}
interface Service {
  id: string;
  name: Named;
}
interface Pkg {
  id: string;
  name: Named;
  items: { kind: string; refId: string; quantity: number }[];
  price: Money;
  validityDays: number;
  componentTotal: Money | null;
  savings: Money | null;
}

const bdt = (m: Money | null) => (m ? formatMoney({ amount: m.amount, currency: 'BDT' }) : '—');
const i = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function PackagesPage() {
  const res = await apiFetch<Pkg[]>('/catalog/packages');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to manage the catalog.</p>;
  const packages = res.data ?? [];
  const services = (await apiFetch<Service[]>('/catalog/services')).data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Packages</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {packages.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <span className="font-medium">{p.name.en}</span>
            <span className="opacity-60">{p.items.length} items ·</span>
            <span className="text-brand">{bdt(p.price)}</span>
            <span className="opacity-50">
              (worth {bdt(p.componentTotal)}, save {bdt(p.savings)})
            </span>
            <span className="opacity-40">· {p.validityDays}d</span>
            <form action={deletePackage.bind(null, p.id)}>
              <button type="submit" className="text-danger opacity-60 hover:opacity-100">
                ✕
              </button>
            </form>
          </li>
        ))}
        {packages.length === 0 ? <li className="opacity-50">No packages yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Add package</h2>
        <form action={createPackage} className="flex max-w-2xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input name="en" placeholder="Package name (EN)" className={i} required />
            <input name="price" type="number" min={0} step="0.01" placeholder="price BDT" className={`${i} w-28`} required />
            <input name="validityDays" type="number" min={1} placeholder="valid days" defaultValue={90} className={`${i} w-28`} />
          </div>
          <label className="text-sm opacity-70">Include services (ctrl/cmd-click for multiple):</label>
          <select name="serviceIds" multiple className={`${i} min-h-28`}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.en}
              </option>
            ))}
          </select>
          <div>
            <Button type="submit">Add package</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
