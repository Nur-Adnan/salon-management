import type { StockLevelDocument } from '../pos/schemas/stock-level.schema.js';
import type { StockAdjustmentDocument } from './schemas/stock-adjustment.schema.js';
import type { StockMovementDocument } from './schemas/stock-movement.schema.js';

const iso = (d: unknown): string | null =>
  d instanceof Date ? d.toISOString() : ((d as { toISOString?: () => string })?.toISOString?.() ?? null);

export const serializeStockLevel = (s: StockLevelDocument) => ({
  productId: String(s.productId),
  qtyOnHand: s.qtyOnHand,
  reorderPoint: s.reorderPoint,
});

export const serializeStockMovement = (m: StockMovementDocument) => ({
  id: String(m._id),
  productId: String(m.productId),
  qtyDelta: m.qtyDelta,
  reason: m.reason,
  refType: m.refType,
  refId: String(m.refId),
  note: m.note ?? null,
  createdAt: iso((m as unknown as { createdAt?: Date }).createdAt),
});

export const serializeStockAdjustment = (a: StockAdjustmentDocument) => ({
  id: String(a._id),
  productId: String(a.productId),
  qtyDelta: a.qtyDelta,
  reason: a.reason,
  note: a.note ?? null,
  createdByUserId: a.createdByUserId ? String(a.createdByUserId) : null,
  createdAt: iso((a as unknown as { createdAt?: Date }).createdAt),
});
