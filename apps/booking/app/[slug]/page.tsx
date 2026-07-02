'use client';

import { Button } from '@salon/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Branch {
  id: string;
  name: string;
  timezone: string;
}
interface Svc {
  id: string;
  name: { en: string; bn: string | null };
  durationMin: number;
  price: { amount: number };
}
interface Staff {
  id: string;
  name: string;
}

const box = 'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';
const bdt = (poisha: number) => `৳${(poisha / 100).toFixed(0)}`;
const hhmm = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// Public booking flow: service -> staff -> slot -> details -> confirm.
export default function BookingPage() {
  const slug = String(useParams().slug ?? '');
  const [salon, setSalon] = useState<{ name: string; branches: Branch[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [services, setServices] = useState<Svc[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState<{ start: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/public/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setSalon(d);
        if (d.branches[0]) setBranchId(d.branches[0].id);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    if (!branchId) return;
    fetch(`${API}/public/${slug}/${branchId}/services`).then((r) => r.json()).then((s: Svc[]) => {
      setServices(s);
      if (s[0]) setServiceId(s[0].id);
    });
    fetch(`${API}/public/${slug}/${branchId}/staff`).then((r) => r.json()).then((s: Staff[]) => {
      setStaff(s);
      if (s[0]) setStaffId(s[0].id);
    });
  }, [slug, branchId]);

  async function findSlots() {
    setErr(null);
    setSlot('');
    const r = await fetch(
      `${API}/public/${slug}/${branchId}/availability?staffId=${staffId}&serviceId=${serviceId}&date=${date}`,
    );
    const d = await r.json();
    setSlots(d.slots ?? []);
    if (!d.slots?.length) setErr('No free times that day — try another date.');
  }

  async function confirm() {
    setErr(null);
    const r = await fetch(`${API}/public/${slug}/${branchId}/appointments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer: { name, phone },
        source: 'online',
        lines: [{ serviceId, staffId, start: slot }],
      }),
    });
    if (r.ok) {
      const a = await r.json();
      setDone({ start: a.lines[0].start });
    } else {
      setErr('That slot was just taken — please pick another.');
      void findSlots();
    }
  }

  if (notFound) return <main className="p-8">Salon not found.</main>;
  if (!salon) return <main className="p-8 opacity-60">Loading…</main>;
  if (done) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold text-brand">You&apos;re booked! ✓</h1>
        <p className="mt-2">See you on {hhmm(done.start)}.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold text-brand">Book at {salon.name}</h1>

      {salon.branches.length > 1 ? (
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={box}>
          {salon.branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      ) : null}

      <label className="text-sm opacity-70">Service</label>
      <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={box}>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name.en} · {s.durationMin}m · {bdt(s.price.amount)}
          </option>
        ))}
      </select>

      <label className="text-sm opacity-70">Stylist</label>
      <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={box}>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <label className="text-sm opacity-70">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={box} />

      <Button type="button" onPress={findSlots}>
        Find times
      </Button>

      {slots.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={`rounded-medium border px-2 py-1 text-xs ${
                slot === s ? 'border-brand text-brand' : 'border-default-300'
              }`}
            >
              {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </div>
      ) : null}

      {slot ? (
        <div className="flex flex-col gap-2 border-t border-default-200 pt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={box} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={box} />
          <Button type="button" isDisabled={!name || !phone} onPress={confirm}>
            Confirm {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Button>
        </div>
      ) : null}

      {err ? <p className="text-sm text-danger">{err}</p> : null}
    </main>
  );
}
