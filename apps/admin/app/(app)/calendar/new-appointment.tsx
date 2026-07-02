'use client';

import { Button } from '@salon/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createAppointment, getAvailability } from './actions';

interface Opt {
  id: string;
  name: string;
}

const i =
  'rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function NewAppointment({
  staff,
  services,
  date,
}: {
  staff: Opt[];
  services: Opt[];
  date: string;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function findSlots() {
    setMsg(null);
    const s = await getAvailability(staffId, serviceId, date);
    setSlots(s);
    if (s.length === 0) setMsg('no free slots for this staff/service/day');
  }

  function book(slot: string) {
    if (!name.trim() || !phone.trim()) {
      setMsg('enter customer name + phone first');
      return;
    }
    startTx(async () => {
      const r = await createAppointment({ name, phone, serviceId, staffId, start: slot });
      if (r.ok) {
        setSlots([]);
        setName('');
        setPhone('');
        setMsg('booked ✓');
        router.refresh();
      } else {
        setMsg(r.error ?? 'failed');
      }
    });
  }

  return (
    <section className="flex max-w-2xl flex-col gap-2 rounded-large border border-default-200 p-4">
      <h2 className="font-semibold">New walk-in ({date})</h2>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" className={i} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={i} />
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={i}>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={i}>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button type="button" onPress={findSlots}>
          Find slots
        </Button>
      </div>

      {slots.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              disabled={pending}
              title={slot}
              onClick={() => book(slot)}
              className="rounded-medium border border-default-300 px-2 py-1 text-xs hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {hhmm(slot)}
            </button>
          ))}
        </div>
      ) : null}
      {msg ? <p className="text-sm text-brand">{msg}</p> : null}
    </section>
  );
}
