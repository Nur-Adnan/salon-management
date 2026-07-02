import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { voidSale } from './actions';

interface Money {
  amount: number;
}
interface SaleRow {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  lines: { quantity: number }[];
  total: Money;
  paymentStatus: string;
  status: string;
  createdAt: string | null;
}
interface Summary {
  count: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  tip: number;
  total: number;
  byMethod: Record<string, number>;
}
interface Cust {
  id: string;
  name: string;
}

const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;
const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? new Date().toISOString().slice(0, 10);

  const first = await apiFetch<SaleRow[]>(`/sales?date=${date}`);
  if (first.status === 403) {
    return <p className="opacity-70">Select a workspace + branch above to view sales.</p>;
  }
  const sales = first.data ?? [];
  const summary = (await apiFetch<Summary>(`/sales/summary?date=${date}`)).data;
  const customers = (await apiFetch<Cust[]>('/customers')).data ?? [];
  const custName = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Sales</h1>
        <Link href={`/sales?date=${addDays(date, -1)}`} className="opacity-70 hover:text-brand">
          ←
        </Link>
        <span className="text-brand">{date}</span>
        <Link href={`/sales?date=${addDays(date, 1)}`} className="opacity-70 hover:text-brand">
          →
        </Link>
        <Link href="/sales" className="text-sm opacity-60">
          today
        </Link>
      </header>

      {summary ? (
        <section className="flex flex-wrap gap-6 rounded-large border border-default-200 p-4 text-sm">
          <Stat label="Sales" value={String(summary.count)} />
          <Stat label="Subtotal" value={bdt(summary.subtotal)} />
          <Stat label="Discount" value={bdt(summary.discountTotal)} />
          <Stat label="Tax" value={bdt(summary.taxTotal)} />
          <Stat label="Tips" value={bdt(summary.tip)} />
          <Stat label="Total" value={bdt(summary.total)} strong />
          {Object.entries(summary.byMethod).map(([m, amt]) => (
            <Stat key={m} label={m} value={bdt(amt)} />
          ))}
        </section>
      ) : null}

      <section className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left opacity-60">
            <tr className="border-b border-default-200">
              <th className="py-2">Invoice</th>
              <th>Time</th>
              <th>Customer</th>
              <th>Items</th>
              <th className="text-right">Total</th>
              <th>Payment</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-default-100">
                <td className="py-2 font-mono">{s.invoiceNumber}</td>
                <td>{hhmm(s.createdAt)}</td>
                <td>{s.customerId ? (custName.get(s.customerId) ?? 'customer') : 'walk-in'}</td>
                <td>{s.lines.reduce((n, l) => n + l.quantity, 0)}</td>
                <td className="text-right font-mono">{bdt(s.total.amount)}</td>
                <td>
                  <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs">
                    {s.status === 'voided' ? 'voided' : s.paymentStatus}
                  </span>
                </td>
                <td className="text-right">
                  {s.status === 'completed' ? (
                    <form action={voidSale.bind(null, s.id)}>
                      <button type="submit" className="text-xs text-danger opacity-60 hover:opacity-100">
                        void
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 opacity-50">
                  No sales on {date}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase opacity-50">{label}</span>
      <span className={strong ? 'font-mono text-base font-bold' : 'font-mono'}>{value}</span>
    </div>
  );
}
