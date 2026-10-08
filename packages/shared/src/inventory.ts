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

export interface BatchCandidate {
  id: string;
  batchNumber: string;
  qtyOnHand: number;
  expiryDate: Date;
}

export interface BatchPickResult {
  batchId: string;
  batchNumber: string;
  qtyPicked: number;
}

/**
 * Picks stock from batches using FEFO (First-Expired, First-Out).
 * Sorts batches by expiryDate ascending.
 * Throws if total available across batches is less than requestedQty.
 */
export function fefoPickBatches(batches: BatchCandidate[], requestedQty: number): BatchPickResult[] {
  if (requestedQty <= 0) return [];
  const sorted = [...batches]
    .filter((b) => b.qtyOnHand > 0)
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

  const totalAvailable = sorted.reduce((sum, b) => sum + b.qtyOnHand, 0);
  if (totalAvailable < requestedQty) {
    throw new Error(`Insufficient batch stock: requested ${requestedQty}, available ${totalAvailable}`);
  }

  const picks: BatchPickResult[] = [];
  let remaining = requestedQty;
  for (const batch of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.qtyOnHand);
    picks.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      qtyPicked: take,
    });
    remaining -= take;
  }
  return picks;
}

/**
 * Calculates new moving weighted-average unit cost (integer minor units) when incoming stock arrives.
 */
export function calculateWeightedAverageCogs(
  currentQty: number,
  currentAvgCostMinor: number,
  incomingQty: number,
  incomingUnitCostMinor: number,
): number {
  if (currentQty <= 0 && incomingQty <= 0) return 0;
  if (currentQty <= 0) return incomingUnitCostMinor;
  if (incomingQty <= 0) return currentAvgCostMinor;

  const totalValue = currentQty * currentAvgCostMinor + incomingQty * incomingUnitCostMinor;
  const totalQty = currentQty + incomingQty;
  return Math.round(totalValue / totalQty);
}
