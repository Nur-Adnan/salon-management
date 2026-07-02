import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { createCoupon, deleteCoupon, toggleCoupon } from './actions';

interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSpend: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  active: boolean;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;
const describe = (c: Coupon) => (c.type === 'percent' ? `${(c.value / 100).toFixed(0)}%` : bdt(c.value));

export default async function CouponsPage() {
  const res = await apiFetch<Coupon[]>('/coupons');
  if (res.status === 403) return <p className="opacity-70">Select a workspace above to build coupons.</p>;
  const coupons = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Coupons</h1>

      <ul className="flex flex-col gap-1 text-sm">
        {coupons.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 font-mono">
            <span className="font-bold">{c.code}</span>
            <span className="opacity-70">{describe(c)} off</span>
            {c.minSpend > 0 ? <span className="opacity-50">min {bdt(c.minSpend)}</span> : null}
            <span className="opacity-50">
              {c.redeemedCount}/{c.maxRedemptions ?? '∞'} used
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${c.active ? 'bg-brand/10 text-brand' : 'bg-default-100 opacity-60'}`}>
              {c.active ? 'active' : 'inactive'}
            </span>
            <form action={toggleCoupon.bind(null, c.id, c.active)}>
              <button type="submit" className="text-xs opacity-60 hover:opacity-100">
                {c.active ? 'deactivate' : 'activate'}
              </button>
            </form>
            <form action={deleteCoupon.bind(null, c.id)}>
              <button type="submit" className="text-xs text-danger opacity-60 hover:opacity-100">
                delete
              </button>
            </form>
          </li>
        ))}
        {coupons.length === 0 ? <li className="opacity-50">No coupons yet.</li> : null}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Coupon builder</h2>
        <form action={createCoupon} className="flex max-w-3xl flex-wrap items-center gap-2">
          <input name="code" placeholder="CODE" className={`${box} w-32 uppercase`} required />
          <select name="type" className={box} defaultValue="percent">
            <option value="percent">% off</option>
            <option value="fixed">BDT off</option>
          </select>
          <input name="value" type="number" min={0} step="0.01" placeholder="value (10 = 10% or 100.00 BDT)" className={`${box} w-56`} required />
          <input name="minSpend" type="number" min={0} step="0.01" placeholder="min spend BDT" className={`${box} w-36`} />
          <input name="maxRedemptions" type="number" min={1} placeholder="max uses (blank = ∞)" className={`${box} w-40`} />
          <Button type="submit">Create coupon</Button>
        </form>
      </section>
    </div>
  );
}
