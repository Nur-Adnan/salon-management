import { describe, expect, it } from 'vitest';
import { MINUTE_MS, alignDown, occupiedSlots, windowsOverlap } from './slots.util.js';

const SLOT = 15 * MINUTE_MS;

describe('slot math', () => {
  it('aligns down to the grid', () => {
    expect(alignDown(20 * MINUTE_MS, SLOT)).toBe(15 * MINUTE_MS);
    expect(alignDown(15 * MINUTE_MS, SLOT)).toBe(15 * MINUTE_MS);
  });

  it('occupies every 15m slot a 45m service touches', () => {
    const start = 9 * 60 * MINUTE_MS;
    expect(occupiedSlots(start, start + 45 * MINUTE_MS, SLOT)).toEqual([
      start,
      start + SLOT,
      start + 2 * SLOT,
    ]);
  });

  it('a window straddling a boundary grabs both slots', () => {
    const nine = 9 * 60 * MINUTE_MS;
    const start = nine + 5 * MINUTE_MS; // 09:05 -> 09:20
    expect(occupiedSlots(start, start + 15 * MINUTE_MS, SLOT)).toEqual([nine, nine + SLOT]);
  });

  it('detects overlap but treats touching edges as free', () => {
    expect(windowsOverlap(0, 10, 5, 15)).toBe(true);
    expect(windowsOverlap(0, 10, 10, 20)).toBe(false);
    expect(windowsOverlap(10, 20, 0, 10)).toBe(false);
  });
});
