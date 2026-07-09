import { apiFetch } from '@/lib/api';

interface ApptReport {
  byStatus: Record<string, number>;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
  cancelRate: number;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

export default async function AppointmentsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const res = await apiFetch<ApptReport>(`/reports/appointments?${qs}`);
  if (res.status === 403) return <p className="opacity-70">You don’t have access to reports.</p>;
  const r = res.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Appointments report</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs opacity-70">from<input type="date" name="from" defaultValue={from} className={box} /></label>
        <label className="flex flex-col text-xs opacity-70">to<input type="date" name="to" defaultValue={to} className={box} /></label>
        <button type="submit" className="rounded-medium bg-brand px-4 py-2 text-sm text-white">Apply</button>
      </form>

      {r ? (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="rounded-medium border border-default-200 px-4 py-3"><div className="opacity-60">Total</div><div className="text-lg font-bold">{r.total}</div></div>
            <div className="rounded-medium border border-default-200 px-4 py-3"><div className="opacity-60">Completed</div><div className="text-lg font-bold">{r.completed}</div></div>
            <div className="rounded-medium border border-default-200 px-4 py-3"><div className="opacity-60">No-show rate</div><div className="text-lg font-bold">{pct(r.noShowRate)}</div></div>
            <div className="rounded-medium border border-default-200 px-4 py-3"><div className="opacity-60">Cancel rate</div><div className="text-lg font-bold">{pct(r.cancelRate)}</div></div>
          </div>
          <ul className="text-sm opacity-80">
            {Object.entries(r.byStatus).map(([s, c]) => <li key={s}>{s}: {c}</li>)}
            {r.total === 0 ? <li className="opacity-50">No appointments in range.</li> : null}
          </ul>
        </>
      ) : null}
    </div>
  );
}
