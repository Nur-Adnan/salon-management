import { apiFetch } from '@/lib/api';

interface StaffRow { staffId: string; netAttributed: number; commission: number; tips: number; hoursWorked: number; saleCount: number }

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (p: number) => `৳${(p / 100).toFixed(2)}`;

export default async function StaffReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const res = await apiFetch<StaffRow[]>(`/reports/staff-performance?${qs}`);
  if (res.status === 403) return <p className="opacity-70">You don’t have access to reports.</p>;
  const rows = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Staff performance</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs opacity-70">from<input type="date" name="from" defaultValue={from} className={box} /></label>
        <label className="flex flex-col text-xs opacity-70">to<input type="date" name="to" defaultValue={to} className={box} /></label>
        <button type="submit" className="rounded-medium bg-brand px-4 py-2 text-sm text-white">Apply</button>
      </form>

      <table className="w-full max-w-3xl text-sm">
        <thead className="text-left opacity-60">
          <tr><th className="py-1">Staff</th><th>Net sales</th><th>Commission</th><th>Tips</th><th>Hours</th><th>Sales</th></tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.staffId} className="border-t border-default-200">
              <td className="py-1 font-mono opacity-70">…{s.staffId.slice(-6)}</td>
              <td>{bdt(s.netAttributed)}</td><td>{bdt(s.commission)}</td><td>{bdt(s.tips)}</td><td>{s.hoursWorked}</td><td>{s.saleCount}</td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={6} className="py-2 opacity-50">No staff activity in range.</td></tr> : null}
        </tbody>
      </table>
      <p className="text-xs opacity-50">Staff shown by id suffix — cross-reference the Team page.</p>
    </div>
  );
}
