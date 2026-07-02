export const MINUTE_MS = 60_000;

export const alignDown = (ms: number, slotMs: number): number => Math.floor(ms / slotMs) * slotMs;

// Every grid slot-start (a multiple of slotMs) that the window [startMs, endMs) touches.
export function occupiedSlots(startMs: number, endMs: number, slotMs: number): number[] {
  const slots: number[] = [];
  for (let s = alignDown(startMs, slotMs); s < endMs; s += slotMs) slots.push(s);
  return slots;
}

// Half-open overlap: [aStart,aEnd) and [bStart,bEnd). Touching edges do NOT overlap.
export const windowsOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean => aStart < bEnd && bStart < aEnd;
