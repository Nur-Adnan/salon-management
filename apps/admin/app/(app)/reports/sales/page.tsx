import { apiFetch } from '@/lib/api';

interface Bucket { key: string; gross: number; discounts: number; net: number; tax: number; tips: number; total: number; count: number }
interface SalesReport {
  groupBy: string;
  buckets: Bucket[];
  byPaymentMethod: { method: string; amount: number }[];
  byLineKind: { kind: string; net: number }[];
  totals: Omit<Bucket, 'key'>;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (p: number) => `৳${(p / 100).toFixed(2)}`;

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; groupBy?: string }>;
}) {
  const { from, to, groupBy = 'day' } = await searchParams;
  const qs = new URLSearchParams({ groupBy, ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const res = await apiFetch<SalesReport>(`/reports/sales?${qs}`);
  if (res.status === 403) return <p className="opacity-70">You don’t have access to reports.</p>;
  const r = res.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Sales report</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs opacity-70">from<input type="date" name="from" defaultValue={from} className={box} /></label>
        <label className="flex flex-col text-xs opacity-70">to<input type="date" name="to" defaultValue={to} className={box} /></label>
        <label className="flex flex-col text-xs opacity-70">group by
          <select name="groupBy" defaultValue={groupBy} className={box}>
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
          </select>
        </label>
        <button type="submit" className="rounded-medium bg-brand px-4 py-2 text-sm text-white">Apply</button>
      </form>

      {r ? (
        <>
          <table className="w-full max-w-3xl text-sm">
            <thead className="text-left opacity-60">
              <tr><th className="py-1">Period</th><th>Net</th><th>Tax</th><th>Tips</th><th>Total</th><th>Count</th></tr>
            </thead>
            <tbody>
              {r.buckets.map((b) => (
                <tr key={b.key} className="border-t border-default-200">
                  <td className="py-1 font-mono">{b.key}</td><td>{bdt(b.net)}</td><td>{bdt(b.tax)}</td><td>{bdt(b.tips)}</td><td>{bdt(b.total)}</td><td>{b.count}</td>
                </tr>
              ))}
              {r.buckets.length === 0 ? <tr><td colSpan={6} className="py-2 opacity-50">No sales in range.</td></tr> : null}
              <tr className="border-t-2 border-default-300 font-semibold">
                <td className="py-1">Total</td><td>{bdt(r.totals.net)}</td><td>{bdt(r.totals.tax)}</td><td>{bdt(r.totals.tips)}</td><td>{bdt(r.totals.total)}</td><td>{r.totals.count}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex flex-wrap gap-8 text-sm">
            <section>
              <h2 className="font-semibold">By payment method</h2>
              <ul className="opacity-80">{r.byPaymentMethod.map((p) => <li key={p.method}>{p.method}: {bdt(p.amount)}</li>)}</ul>
            </section>
            <section>
              <h2 className="font-semibold">By line kind (net)</h2>
              <ul className="opacity-80">{r.byLineKind.map((l) => <li key={l.kind}>{l.kind}: {bdt(l.net)}</li>)}</ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
