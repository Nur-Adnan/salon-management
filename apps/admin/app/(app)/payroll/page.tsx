import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { markPaid, runPayroll } from './actions';

interface Payslip {
  id: string;
  staffId: string;
  periodStart: string;
  periodEnd: string;
  netMinor: number;
  paidAt: string | null;
}

interface Earning {
  id: string;
  staffId: string;
  kind: string;
  amountMinor: number;
  claimed: boolean;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(2)}`;
const ymd = (iso: string) => new Date(iso).toLocaleDateString('en-BD');

export default async function PayrollPage() {
  const [slipsRes, earningsRes] = await Promise.all([
    apiFetch<Payslip[]>('/payroll/payslips'),
    apiFetch<Earning[]>('/payroll/earnings'),
  ]);
  if (slipsRes.status === 403) return <p className="opacity-70">You do not have permission to view payroll.</p>;
  const slips = slipsRes.data ?? [];
  const outstanding = (earningsRes.data ?? []).filter((e) => !e.claimed);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Payroll</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Run payroll</h2>
        <form action={runPayroll} className="flex max-w-2xl flex-wrap items-center gap-2">
          <input name="staffId" placeholder="staff user id" className={`${box} font-mono`} required />
          <input name="periodStart" type="date" className={box} required />
          <span className="opacity-60">to</span>
          <input name="periodEnd" type="date" className={box} required />
          <Button type="submit">Run</Button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Unclaimed commission &amp; tips</h2>
        <ul className="text-sm">
          {outstanding.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="font-mono text-xs opacity-70">{e.staffId}</span>
              <span className="opacity-60">{e.kind}</span>
              <span>{bdt(e.amountMinor)}</span>
            </li>
          ))}
          {outstanding.length === 0 ? <li className="opacity-50">Nothing outstanding.</li> : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Payslips</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {slips.map((s) => (
            <li key={s.id} className="flex items-center gap-3">
              <span className="font-mono text-xs opacity-70">{s.staffId}</span>
              <span className="opacity-60">
                {ymd(s.periodStart)}–{ymd(s.periodEnd)}
              </span>
              <span>net {bdt(s.netMinor)}</span>
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs">{s.paidAt ? 'paid' : 'unpaid'}</span>
              {!s.paidAt ? (
                <form action={markPaid.bind(null, s.id)}>
                  <button type="submit" className="text-xs text-brand opacity-70 hover:opacity-100">
                    mark paid
                  </button>
                </form>
              ) : null}
            </li>
          ))}
          {slips.length === 0 ? <li className="opacity-50">No payroll runs yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
