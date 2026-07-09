// The ONE path every stock change flows through — POS sale/void, PO receipt,
// and manual adjustment. In a single transaction it atomically mutates the
// cached StockLevel.qtyOnHand AND appends an immutable StockMovement, so the
// cache and its ledger can never diverge (same guarantee the loyalty
// balance/ledger has). A plain function (not a provider) so every module calls
// it against its own injected models without a circular import — same
// convention as crm/ledger.util.ts and hr/ledger.util.ts.
import { ConflictException } from '@nestjs/common';
import type { StockMovementReason } from '@salon/shared';
import type { ClientSession, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../common/mongo.util.js';
import type { StockLevelDocument } from '../pos/schemas/stock-level.schema.js';
import type { StockMovementDocument } from './schemas/stock-movement.schema.js';

export interface StockModels {
  stock: Model<StockLevelDocument>;
  movements: Model<StockMovementDocument>;
}

export interface StockDelta {
  tenantId: Types.ObjectId;
  branchId: Types.ObjectId;
  productId: Types.ObjectId;
  qtyDelta: number; // signed; negative decrements (guarded >= 0), positive increments
  reason: StockMovementReason;
  refType: string; // 'sale' | 'purchase_order' | 'adjustment'
  refId: Types.ObjectId;
  note?: string | null;
  // Increments upsert a stock row by default (PO receipt / adjustment establish
  // stock). A void restore sets this false so it never resurrects a row for a
  // product that was untracked at sale time (matching pre-Phase-7 behavior).
  createIfMissing?: boolean;
}

/**
 * Apply one signed stock delta for one (branch, product) and record the movement.
 * MUST be called with exactly one delta per (refId, product) — callers aggregate
 * by product first (checkout's productQtys map; PO receipt aggregation) — so the
 * movement idempotency index stays valid.
 *
 * Decrements are guarded in the FILTER (`qtyOnHand >= -qtyDelta`), so stock can
 * never go negative. A no-match on a decrement means either an untracked product
 * (no stock row — allowed, no movement, preserves pre-Phase-7 behavior) or a
 * tracked row with insufficient stock (blocked with a 409).
 */
export async function applyStockDelta(m: StockModels, p: StockDelta, session: ClientSession): Promise<void> {
  if (p.qtyDelta === 0) return;
  const key = { tenantId: p.tenantId, branchId: p.branchId, productId: p.productId };

  if (p.qtyDelta < 0) {
    const res = await m.stock
      .updateOne({ ...key, qtyOnHand: { $gte: -p.qtyDelta } }, { $inc: { qtyOnHand: p.qtyDelta } }, { session })
      .exec();
    if (res.matchedCount === 0) {
      const tracked = await m.stock.findOne(key).session(session).exec();
      if (tracked) throw new ConflictException(`insufficient stock for product ${String(p.productId)}`);
      return; // untracked product: not inventory-managed, no movement to record
    }
  } else {
    const create = p.createIfMissing !== false;
    const res = await m.stock.updateOne(key, { $inc: { qtyOnHand: p.qtyDelta } }, { upsert: create, session }).exec();
    // createIfMissing:false on an untracked product (no row) → nothing to restore,
    // and no movement to record.
    if (!create && res.matchedCount === 0) return;
  }

  try {
    await m.movements.create(
      [
        {
          tenantId: p.tenantId,
          branchId: p.branchId,
          productId: p.productId,
          qtyDelta: p.qtyDelta,
          reason: p.reason,
          refType: p.refType,
          refId: p.refId,
          note: p.note ?? null,
        },
      ] as never,
      { session },
    );
  } catch (err) {
    // Idempotent against a transaction retry re-running this pass — the unique
    // {tenantId,refType,refId,productId,reason} index makes a second attempt's
    // insert a caught no-op rather than a duplicate movement.
    if (!isDuplicateKeyError(err)) throw err;
  }
}
