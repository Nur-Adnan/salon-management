import { describe, expect, it } from 'vitest';
import { calculateWeightedAverageCogs, fefoPickBatches, isLowStock, purchaseOrderTotal } from './inventory.js';
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

  describe('fefoPickBatches', () => {
    const b1 = { id: '1', batchNumber: 'LOT-MAY', qtyOnHand: 10, expiryDate: new Date('2026-05-01') };
    const b2 = { id: '2', batchNumber: 'LOT-JAN', qtyOnHand: 5, expiryDate: new Date('2026-01-01') };
    const b3 = { id: '3', batchNumber: 'LOT-DEC', qtyOnHand: 20, expiryDate: new Date('2026-12-01') };

    it('picks earliest expiry batch first', () => {
      // Requested 8: should take 5 from b2 (Jan), and 3 from b1 (May)
      const picks = fefoPickBatches([b1, b2, b3], 8);
      expect(picks).toEqual([
        { batchId: '2', batchNumber: 'LOT-JAN', qtyPicked: 5 },
        { batchId: '1', batchNumber: 'LOT-MAY', qtyPicked: 3 },
      ]);
    });

    it('throws error when total available across batches is insufficient', () => {
      expect(() => fefoPickBatches([b1, b2], 20)).toThrow('Insufficient batch stock');
    });

    it('returns empty array when requestedQty is 0', () => {
      expect(fefoPickBatches([b1, b2], 0)).toEqual([]);
    });
  });

  describe('calculateWeightedAverageCogs', () => {
    it('calculates weighted average cost correctly', () => {
      // Current 10 units at ৳100 (10000 poisha) + Incoming 20 units at ৳130 (13000 poisha)
      // Total value = 100,000 + 260,000 = 360,000
      // Total qty = 30
      // New average = 360,000 / 30 = 12000 poisha (৳120)
      const avg = calculateWeightedAverageCogs(10, 10000, 20, 13000);
      expect(avg).toBe(12000);
    });

    it('handles initial stock receipt (currentQty 0)', () => {
      expect(calculateWeightedAverageCogs(0, 0, 15, 8500)).toBe(8500);
    });
  });
});
