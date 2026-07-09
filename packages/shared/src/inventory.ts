import { type Money, add, money, mulInt } from './money.js';

// Server-authoritative purchase-order total: Σ(unitCost × quantity), all in
// integer minor units. Same discipline as the POS pricing engine.
export function purchaseOrderTotal(lines: { quantity: number; unitCost: Money }[]): Money {
  return lines.reduce((acc, l) => add(acc, mulInt(l.unitCost, l.quantity)), money(0));
}

// Low-stock predicate: a reorderPoint of 0 means "not tracked for reorder", so
// it is never low regardless of on-hand.
export function isLowStock(qtyOnHand: number, reorderPoint: number): boolean {
  return reorderPoint > 0 && qtyOnHand <= reorderPoint;
}
