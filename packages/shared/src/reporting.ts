// Divide safely: a rate is 0 when there's nothing to divide by (no appointments
// in a period => a 0% no-show rate, not NaN/Infinity).
export function safeRate(numerator: number, denominator: number): number {
  return denominator <= 0 ? 0 : numerator / denominator;
}

// Total inventory value = Σ(qtyOnHand × unitCost), all integer minor units.
export function inventoryValue(rows: { qtyOnHand: number; unitCost: number }[]): number {
  return rows.reduce((n, r) => n + r.qtyOnHand * r.unitCost, 0);
}
