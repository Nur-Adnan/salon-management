import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { createPlan, togglePlan } from './actions';

interface Plan {
  id: string;
  name: { en: string };
  price: { amount: number };
  billingPeriodDays: number;
  active: boolean;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;

export default async function SubscriptionPlansPage() {
  const res = await apiFetch<Plan[]>('/subscription-plans');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to manage plans.</p>;
  const plans = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Membership plans</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {plans.map((pl) => (
          <li key={pl.id} className="flex items-center gap-3">
            <span className="font-medium">{pl.name.en}</span>
            <span className="opacity-70">{bdt(pl.price.amount)} / {pl.billingPeriodDays}d</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${pl.active ? 'bg-brand/10 text-brand' : 'bg-default-100 opacity-60'}`}>
              {pl.active ? 'active' : 'inactive'}
            </span>
            <form action={togglePlan.bind(null, pl.id, pl.active)}>
              <button type="submit" className="text-xs opacity-60 hover:opacity-100">
                {pl.active ? 'deactivate' : 'activate'}
              </button>
            </form>
          </li>
        ))}
        {plans.length === 0 ? <li className="opacity-50">No plans yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Add plan</h2>
        <form action={createPlan} className="flex max-w-2xl flex-wrap items-center gap-2">
          <input name="en" placeholder="Plan name" className={box} required />
          <input name="price" type="number" min={0} step="0.01" placeholder="Price (BDT)" className={`${box} w-36`} required />
          <input name="billingPeriodDays" type="number" min={1} placeholder="Billing period (days)" className={`${box} w-48`} defaultValue={30} />
          <Button type="submit">Add plan</Button>
        </form>
      </section>
    </div>
  );
}
