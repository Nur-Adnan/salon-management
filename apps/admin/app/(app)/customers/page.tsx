import { Button } from '@salon/ui';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { createCustomer } from './actions';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

const i = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

export default async function CustomersPage() {
  const res = await apiFetch<Customer[]>('/customers');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to manage customers.</p>;
  const customers = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Customers</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {customers.map((c) => (
          <li key={c.id}>
            <Link href={`/customers/${c.id}`} className="hover:text-brand">
              <span className="font-medium">{c.name}</span>{' '}
              <span className="opacity-50">{c.phone}</span>
              {c.email ? <span className="opacity-40"> · {c.email}</span> : null}
            </Link>
          </li>
        ))}
        {customers.length === 0 ? <li className="opacity-50">No customers yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Add customer</h2>
        <form action={createCustomer} className="flex max-w-xl flex-wrap gap-2">
          <input name="name" placeholder="Name" className={i} required />
          <input name="phone" placeholder="Phone" className={i} required />
          <input name="email" type="email" placeholder="Email (optional)" className={i} />
          <Button type="submit">Add</Button>
        </form>
      </section>
    </div>
  );
}
