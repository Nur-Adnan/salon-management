import { describe, expect, it } from 'vitest';
import { inventoryValue, safeRate } from './reporting.js';

describe('safeRate', () => {
  it('divides normally', () => expect(safeRate(3, 12)).toBe(0.25));
  it('is 0 when denominator is 0', () => expect(safeRate(5, 0)).toBe(0));
  it('is 0 when denominator is negative', () => expect(safeRate(5, -2)).toBe(0));
});

describe('inventoryValue', () => {
  it('sums qty*unitCost in minor units', () =>
    expect(inventoryValue([
      { qtyOnHand: 3, unitCost: 20000 },
      { qtyOnHand: 2, unitCost: 500 },
    ])).toBe(61000));
  it('is 0 for empty', () => expect(inventoryValue([])).toBe(0));
});
