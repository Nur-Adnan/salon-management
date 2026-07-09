import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { CreateStockAdjustment, SetReorderPoint, SetStock } from '@salon/shared';
import { type Connection, type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { StockLevel, type StockLevelDocument } from '../pos/schemas/stock-level.schema.js';
import { StockAdjustment, type StockAdjustmentDocument } from './schemas/stock-adjustment.schema.js';
import { StockMovement, type StockMovementDocument } from './schemas/stock-movement.schema.js';
import { applyStockDelta } from './stock.util.js';

// Stock levels, the movement ledger, manual adjustments, and reorder points for
// the active branch. POS decrements stock inside checkout; this owns the manual
// surface (set/seed, adjust, reorder) and the read side (levels, movements, low
// stock). Full replenishment (purchase orders) lives in SuppliersModule.
@Injectable()
export class InventoryService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(StockLevel.name) private readonly stock: Model<StockLevelDocument>,
    @InjectModel(StockMovement.name) private readonly movements: Model<StockMovementDocument>,
    @InjectModel(StockAdjustment.name) private readonly adjustments: Model<StockAdjustmentDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId; userId: string | null } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return {
      tenantId: new Types.ObjectId(c.tenantId),
      branchId: new Types.ObjectId(c.branchId),
      userId: c.userId ?? null,
    };
  }

  async setStock(dto: SetStock): Promise<StockLevelDocument> {
    const { tenantId, branchId } = this.scope();
    return this.stock
      .findOneAndUpdate(
        { tenantId, branchId, productId: new Types.ObjectId(dto.productId) },
        { $set: { qtyOnHand: dto.qtyOnHand } },
        { upsert: true, new: true },
      )
      .exec();
  }

  async setReorderPoint(dto: SetReorderPoint): Promise<StockLevelDocument> {
    const { tenantId, branchId } = this.scope();
    return this.stock
      .findOneAndUpdate(
        { tenantId, branchId, productId: new Types.ObjectId(dto.productId) },
        { $set: { reorderPoint: dto.reorderPoint } },
        { upsert: true, new: true },
      )
      .exec();
  }

  // Manual signed correction. The adjustment record and the atomic stock change +
  // movement commit together, so the record and the ledger can never diverge.
  async adjust(dto: CreateStockAdjustment): Promise<StockAdjustmentDocument> {
    const { tenantId, branchId, userId } = this.scope();
    const productId = new Types.ObjectId(dto.productId);
    const adjustmentId = new Types.ObjectId();

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        await this.adjustments.create(
          [
            {
              _id: adjustmentId,
              tenantId,
              branchId,
              productId,
              qtyDelta: dto.qtyDelta,
              reason: dto.reason,
              note: dto.note ?? null,
              createdByUserId: userId ? new Types.ObjectId(userId) : null,
            },
          ] as never,
          { session },
        );
        await applyStockDelta(
          { stock: this.stock, movements: this.movements },
          {
            tenantId,
            branchId,
            productId,
            qtyDelta: dto.qtyDelta,
            reason: 'adjustment',
            refType: 'adjustment',
            refId: adjustmentId,
            note: dto.note ?? null,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    const created = await this.adjustments.findById(adjustmentId).exec();
    return created as StockAdjustmentDocument;
  }

  listStock(): Promise<StockLevelDocument[]> {
    const { tenantId, branchId } = this.scope();
    return this.stock.find({ tenantId, branchId }).exec();
  }

  listMovements(productId?: string): Promise<StockMovementDocument[]> {
    const { tenantId, branchId } = this.scope();
    const q: Record<string, unknown> = { tenantId, branchId };
    if (productId) q.productId = new Types.ObjectId(productId);
    return this.movements.find(q).sort({ createdAt: -1 }).limit(500).exec();
  }

  listAdjustments(): Promise<StockAdjustmentDocument[]> {
    const { tenantId, branchId } = this.scope();
    return this.adjustments.find({ tenantId, branchId }).sort({ createdAt: -1 }).limit(500).exec();
  }

  // Rows at or below a POSITIVE reorder point (reorderPoint 0 = not tracked).
  lowStock(): Promise<StockLevelDocument[]> {
    const { tenantId, branchId } = this.scope();
    return this.stock
      .find({
        tenantId,
        branchId,
        $expr: { $and: [{ $gt: ['$reorderPoint', 0] }, { $lte: ['$qtyOnHand', '$reorderPoint'] }] },
      })
      .exec();
  }
}
