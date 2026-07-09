import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { createSupplier, deleteSupplier } from './actions';

interface Supplier {
  id: string;
  name: string;
  contact: { phone: string | null; email: string | null };
  address: string | null;
  note: string | null;
  active: boolean;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function SuppliersPage() {
  const res = await apiFetch<Supplier[]>('/suppliers');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to manage suppliers.</p>;
  const suppliers = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Suppliers</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {suppliers.map((sup) => (
          <li key={sup.id} className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">{sup.name}</span>
            {sup.contact.phone ? <span className="opacity-60">{sup.contact.phone}</span> : null}
            {sup.contact.email ? <span className="opacity-60">{sup.contact.email}</span> : null}
            {sup.address ? <span className="opacity-40">{sup.address}</span> : null}
            <form action={deleteSupplier.bind(null, sup.id)}>
              <button type="submit" className="text-xs text-danger opacity-60 hover:opacity-100">
                delete
              </button>
            </form>
          </li>
        ))}
        {suppliers.length === 0 ? <li className="opacity-50">No suppliers yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Add supplier</h2>
        <form action={createSupplier} className="flex max-w-3xl flex-wrap items-center gap-2">
          <input name="name" placeholder="Name" className={`${box} w-48`} required />
          <input name="phone" placeholder="Phone" className={`${box} w-36`} />
          <input name="email" type="email" placeholder="Email" className={`${box} w-48`} />
          <input name="address" placeholder="Address" className={`${box} w-56`} />
          <input name="note" placeholder="Note" className={`${box} w-56`} />
          <Button type="submit">Add supplier</Button>
        </form>
      </section>
    </div>
  );
}
