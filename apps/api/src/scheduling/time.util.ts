import type { WorkingDay } from '@salon/shared';
import { DateTime } from 'luxon';

const hh = (t: string): number => Number(t.slice(0, 2));
const mm = (t: string): number => Number(t.slice(3, 5));

// The branch's open/close for a local calendar date as absolute UTC instants (ms).
// luxon resolves that date's actual offset, so this is DST-correct.
export function dayBoundaries(
  dateYMD: string,
  tz: string,
  wd: WorkingDay,
): { openMs: number; closeMs: number } | null {
  if (wd.closed) return null;
  const base = DateTime.fromISO(dateYMD, { zone: tz });
  if (!base.isValid) return null;
  const open = base.set({ hour: hh(wd.open), minute: mm(wd.open), second: 0, millisecond: 0 });
  const close = base.set({ hour: hh(wd.close), minute: mm(wd.close), second: 0, millisecond: 0 });
  return { openMs: open.toMillis(), closeMs: close.toMillis() };
}

// Candidate start instants (UTC ms) at slot granularity within working hours.
// Steps in the zone (via luxon) so a DST change mid-day doesn't drift the grid.
export function candidateStarts(
  dateYMD: string,
  tz: string,
  wd: WorkingDay,
  slotMinutes: number,
): number[] {
  const b = dayBoundaries(dateYMD, tz, wd);
  if (!b) return [];
  let t = DateTime.fromMillis(b.openMs, { zone: tz });
  const out: number[] = [];
  while (t.toMillis() < b.closeMs) {
    out.push(t.toMillis());
    t = t.plus({ minutes: slotMinutes });
  }
  return out;
}

// UTC [start, end) covering the local calendar day (for reservation range queries).
export function dayRangeUtc(dateYMD: string, tz: string): { start: Date; end: Date } {
  const base = DateTime.fromISO(dateYMD, { zone: tz });
  return { start: base.startOf('day').toUTC().toJSDate(), end: base.endOf('day').toUTC().toJSDate() };
}
