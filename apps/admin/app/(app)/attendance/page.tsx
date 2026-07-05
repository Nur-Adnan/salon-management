import { Button } from '@salon/ui';
import { apiFetch } from '@/lib/api';
import { clockIn, clockOut } from './actions';

interface AttendanceRecord {
  id: string;
  staffId: string;
  clockIn: string;
  clockOut: string | null;
  claimed: boolean;
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' });
const hoursBetween = (start: string, end: string) => ((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000).toFixed(2);

export default async function AttendancePage() {
  const res = await apiFetch<AttendanceRecord[]>('/attendance');
  if (res.status === 403) return <p className="opacity-70">You do not have permission to view attendance.</p>;
  const records = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Attendance</h1>

      <div className="flex gap-3">
        <form action={clockIn}>
          <Button type="submit">Clock in</Button>
        </form>
        <form action={clockOut}>
          <Button type="submit">Clock out</Button>
        </form>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="opacity-60">
          <tr>
            <th className="pb-2 pr-4">Staff</th>
            <th className="pb-2 pr-4">Clock in</th>
            <th className="pb-2 pr-4">Clock out</th>
            <th className="pb-2">Hours</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t border-default-100">
              <td className="py-1 pr-4 font-mono text-xs">{r.staffId}</td>
              <td className="py-1 pr-4">{fmt(r.clockIn)}</td>
              <td className="py-1 pr-4">{r.clockOut ? fmt(r.clockOut) : <span className="text-brand">open</span>}</td>
              <td className="py-1">{r.clockOut ? hoursBetween(r.clockIn, r.clockOut) : '—'}</td>
            </tr>
          ))}
          {records.length === 0 ? (
            <tr>
              <td className="py-1 opacity-50" colSpan={4}>
                No attendance records yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
