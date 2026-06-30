import { formatMoney } from '@salon/shared';
import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { createService, createServiceCategory, deleteService } from '../actions';

interface Named {
  en: string;
  bn: string | null;
}
interface Category {
  id: string;
  name: Named;
}
interface Service {
  id: string;
  name: Named;
  categoryId: string | null;
  durationMin: number;
  price: { amount: number };
  taxable: boolean;
}

const i = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function ServicesPage() {
  const res = await apiFetch<Service[]>('/catalog/services');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to manage the catalog.</p>;
  const services = res.data ?? [];
  const categories = (await apiFetch<Category[]>('/catalog/service-categories')).data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Services</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {services.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <span className="font-medium">{s.name.en}</span>
            {s.name.bn ? <span className="opacity-50">{s.name.bn}</span> : null}
            <span className="opacity-60">· {s.durationMin}m ·</span>
            <span className="text-brand">{formatMoney({ amount: s.price.amount, currency: 'BDT' })}</span>
            {!s.taxable ? <span className="opacity-50">· tax-free</span> : null}
            <form action={deleteService.bind(null, s.id)}>
              <button type="submit" className="text-danger opacity-60 hover:opacity-100">
                ✕
              </button>
            </form>
          </li>
        ))}
        {services.length === 0 ? <li className="opacity-50">No services yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Add service</h2>
        <form action={createService} className="flex max-w-2xl flex-wrap items-center gap-2">
          <input name="en" placeholder="Name (EN)" className={i} required />
          <input name="bn" placeholder="নাম (BN)" className={i} />
          <select name="categoryId" className={i} defaultValue="">
            <option value="">— category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.en}
              </option>
            ))}
          </select>
          <input name="durationMin" type="number" min={1} placeholder="min" defaultValue={30} className={`${i} w-24`} />
          <input name="price" type="number" min={0} step="0.01" placeholder="BDT" className={`${i} w-28`} required />
          <label className="flex items-center gap-1 text-sm">
            <input name="taxable" type="checkbox" defaultChecked /> taxable
          </label>
          <Button type="submit">Add</Button>
        </form>

        <form action={createServiceCategory} className="flex max-w-sm gap-2">
          <input name="en" placeholder="New category (EN)" className={i} required />
          <Button type="submit">Add category</Button>
        </form>
      </section>
    </div>
  );
}
