import { type AppointmentStatus, allowedTransitions } from '@salon/shared';
import { Button } from '@salon/ui';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { addToWaitlist, removeFromWaitlist, transitionAppointment } from './actions';
import { NewAppointment } from './new-appointment';

interface Named {
  en: string;
  bn: string | null;
}
interface Svc {
  id: string;
  name: Named;
}
interface Staff {
  id: string;
  name: string;
}
interface Cust {
  id: string;
  name: string;
}
interface Line {
  serviceId: string;
  staffId: string;
  start: string;
}
interface Appt {
  id: string;
  customerId: string;
  status: AppointmentStatus;
  source: string;
  lines: Line[];
}
interface Wait {
  id: string;
  customerId: string;
  note: string | null;
}

const inputCls =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam ?? new Date().toISOString().slice(0, 10);

  const first = await apiFetch<Appt[]>(`/appointments?date=${date}`);
  if (first.status === 403) {
    return <p className="opacity-70">Select a workspace + branch above to view the calendar.</p>;
  }
  const appts = first.data ?? [];
  const services = (await apiFetch<Svc[]>('/catalog/services')).data ?? [];
  const staff = (await apiFetch<Staff[]>('/staff')).data ?? [];
  const customers = (await apiFetch<Cust[]>('/customers')).data ?? [];
  const waitlist = (await apiFetch<Wait[]>('/waitlist')).data ?? [];

  const svcName = new Map(services.map((s) => [s.id, s.name.en]));
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const custName = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Calendar</h1>
        <Link href={`/calendar?date=${addDays(date, -1)}`} className="opacity-70 hover:text-brand">
          ←
        </Link>
        <span className="text-brand">{date}</span>
        <Link href={`/calendar?date=${addDays(date, 1)}`} className="opacity-70 hover:text-brand">
          →
        </Link>
        <Link href="/calendar" className="text-sm opacity-60">
          today
        </Link>
      </header>

      <NewAppointment
        staff={staff.map((s) => ({ id: s.id, name: s.name }))}
        services={services.map((s) => ({ id: s.id, name: s.name.en }))}
        date={date}
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Appointments</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {appts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-3 border-b border-default-100 pb-2"
            >
              <span className="font-mono">{a.lines.map((l) => hhmm(l.start)).join(', ')}</span>
              <span className="font-medium">{custName.get(a.customerId) ?? 'customer'}</span>
              <span className="opacity-60">
                {a.lines.map((l) => svcName.get(l.serviceId) ?? 'service').join(' + ')} ·{' '}
                {a.lines.map((l) => staffName.get(l.staffId) ?? 'staff').join(', ')}
              </span>
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs">{a.status}</span>
              <span className="text-xs opacity-40">{a.source}</span>
              <span className="flex gap-1">
                {allowedTransitions(a.status).map((to) => (
                  <form key={to} action={transitionAppointment.bind(null, a.id, to)}>
                    <button
                      type="submit"
                      className="rounded border border-default-300 px-1.5 py-0.5 text-xs hover:border-brand"
                    >
                      {to.replace('_', ' ')}
                    </button>
                  </form>
                ))}
              </span>
            </li>
          ))}
          {appts.length === 0 ? <li className="opacity-50">No appointments on {date}.</li> : null}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Waitlist</h2>
        <ul className="text-sm">
          {waitlist.map((w) => (
            <li key={w.id} className="flex items-center gap-3">
              <span>{custName.get(w.customerId) ?? 'customer'}</span>
              {w.note ? <span className="opacity-50">{w.note}</span> : null}
              <form action={removeFromWaitlist.bind(null, w.id)}>
                <button type="submit" className="text-danger opacity-60 hover:opacity-100">
                  ✕
                </button>
              </form>
            </li>
          ))}
          {waitlist.length === 0 ? <li className="opacity-50">Empty.</li> : null}
        </ul>
        <form action={addToWaitlist} className="flex max-w-lg flex-wrap gap-2">
          <input name="name" placeholder="Name" className={inputCls} required />
          <input name="phone" placeholder="Phone" className={inputCls} required />
          <input name="note" placeholder="Note" className={inputCls} />
          <Button type="submit">Add to waitlist</Button>
        </form>
      </section>
    </div>
  );
}
