import { describe, expect, it } from 'vitest';
import { isLowStock, purchaseOrderTotal } from './inventory.js';
import { money } from './money.js';

describe('purchaseOrderTotal', () => {
  it('sums unitCost*qty across lines in integer minor units', () => {
    expect(
      purchaseOrderTotal([
        { quantity: 3, unitCost: money(1500) },
        { quantity: 2, unitCost: money(999) },
      ]),
    ).toEqual(money(3 * 1500 + 2 * 999));
  });

  it('is zero for no lines', () => {
    expect(purchaseOrderTotal([])).toEqual(money(0));
  });

  it('handles a single line', () => {
    expect(purchaseOrderTotal([{ quantity: 10, unitCost: money(250) }])).toEqual(money(2500));
  });
});

describe('isLowStock', () => {
  it('true at or below a positive reorder point', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(4, 5)).toBe(true);
    expect(isLowStock(0, 5)).toBe(true);
  });

  it('false above the point', () => {
    expect(isLowStock(6, 5)).toBe(false);
  });

  it('reorderPoint 0 is never low (feature off, even at zero stock)', () => {
    expect(isLowStock(0, 0)).toBe(false);
    expect(isLowStock(10, 0)).toBe(false);
  });
});
