import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  calculateWeightedAverageCogs,
  type CreateStockAdjustment,
  type CreateStockBatch,
  type CreateStockTransfer,
  fefoPickBatches,
  type SetReorderPoint,
  type SetStock,
} from '@salon/shared';
import { type Connection, type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { Counter, type CounterDocument } from '../pos/schemas/counter.schema.js';
import { StockLevel, type StockLevelDocument } from '../pos/schemas/stock-level.schema.js';
import { StockAdjustment, type StockAdjustmentDocument } from './schemas/stock-adjustment.schema.js';
import { StockBatch, type StockBatchDocument } from './schemas/stock-batch.schema.js';
import { StockMovement, type StockMovementDocument } from './schemas/stock-movement.schema.js';
import { StockTransfer, type StockTransferDocument } from './schemas/stock-transfer.schema.js';
import { applyStockDelta } from './stock.util.js';

@Injectable()
export class InventoryService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(StockLevel.name) private readonly stock: Model<StockLevelDocument>,
    @InjectModel(StockMovement.name) private readonly movements: Model<StockMovementDocument>,
    @InjectModel(StockAdjustment.name) private readonly adjustments: Model<StockAdjustmentDocument>,
    @InjectModel(StockBatch.name) private readonly batches: Model<StockBatchDocument>,
    @InjectModel(StockTransfer.name) private readonly transfers: Model<StockTransferDocument>,
    @InjectModel(Counter.name) private readonly counters: Model<CounterDocument>,
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

  // --- Batch Tracking, FEFO & Weighted Average COGS ---

  async createBatch(dto: CreateStockBatch): Promise<StockBatchDocument> {
    const { tenantId } = this.scope();
    const branchId = new Types.ObjectId(dto.branchId);
    const productId = new Types.ObjectId(dto.productId);
    const expiryDate = new Date(dto.expiryDate);

    const session = await this.conn.startSession();
    try {
      let createdBatch: StockBatchDocument | null = null;
      await session.withTransaction(async () => {
        const batchDocs = await this.batches.create(
          [
            {
              tenantId,
              branchId,
              productId,
              batchNumber: dto.batchNumber,
              expiryDate,
              qtyOnHand: dto.qtyOnHand,
              unitCostMinor: dto.unitCostMinor,
            },
          ] as never,
          { session },
        );
        createdBatch = batchDocs[0] as StockBatchDocument;

        // Update moving weighted-average COGS on StockLevel
        const currentStock = await this.stock.findOne({ tenantId, branchId, productId }).session(session).exec();
        const currentQty = currentStock?.qtyOnHand ?? 0;
        const currentAvg = (currentStock as unknown as { avgUnitCostMinor?: number })?.avgUnitCostMinor ?? 0;
        const newAvg = calculateWeightedAverageCogs(currentQty, currentAvg, dto.qtyOnHand, dto.unitCostMinor);

        await this.stock.updateOne(
          { tenantId, branchId, productId },
          { $set: { avgUnitCostMinor: newAvg } },
          { session },
        );

        await applyStockDelta(
          { stock: this.stock, movements: this.movements },
          {
            tenantId,
            branchId,
            productId,
            qtyDelta: dto.qtyOnHand,
            reason: 'purchase',
            refType: 'batch_in',
            refId: createdBatch._id,
            note: `Batch ${dto.batchNumber}`,
          },
          session,
        );
      });
      return createdBatch!;
    } finally {
      await session.endSession();
    }
  }

  listBatches(productId?: string): Promise<StockBatchDocument[]> {
    const { tenantId, branchId } = this.scope();
    const q: Record<string, unknown> = { tenantId, branchId };
    if (productId) q.productId = new Types.ObjectId(productId);
    return this.batches.find(q).sort({ expiryDate: 1 }).exec();
  }

  async consumeBatchesFEFO(productId: string, requestedQty: number): Promise<void> {
    const { tenantId, branchId } = this.scope();
    const pId = new Types.ObjectId(productId);

    const availableBatches = await this.batches
      .find({ tenantId, branchId, productId: pId, qtyOnHand: { $gt: 0 } })
      .sort({ expiryDate: 1 })
      .exec();

    const picks = fefoPickBatches(
      availableBatches.map((b) => ({
        id: String(b._id),
        batchNumber: b.batchNumber,
        qtyOnHand: b.qtyOnHand,
        expiryDate: b.expiryDate,
      })),
      requestedQty,
    );

    for (const pick of picks) {
      await this.batches.updateOne(
        { _id: new Types.ObjectId(pick.batchId), qtyOnHand: { $gte: pick.qtyPicked } },
        { $inc: { qtyOnHand: -pick.qtyPicked } },
      );
    }
  }

  // --- Inter-Branch Stock Transfers ---

  async createTransfer(dto: CreateStockTransfer): Promise<StockTransferDocument> {
    const { tenantId, userId } = this.scope();
    const fromBranchId = new Types.ObjectId(dto.fromBranchId);
    const toBranchId = new Types.ObjectId(dto.toBranchId);

    if (String(fromBranchId) === String(toBranchId)) {
      throw new BadRequestException('cannot transfer stock to the same branch');
    }

    const c = await this.counters.findOneAndUpdate(
      { key: `${tenantId}:transfer` },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    const transferNumber = `TR-${String(c.seq).padStart(6, '0')}`;

    return this.transfers.create({
      tenantId,
      transferNumber,
      fromBranchId,
      toBranchId,
      status: 'draft',
      lines: dto.lines.map((l) => ({
        productId: new Types.ObjectId(l.productId),
        quantity: l.quantity,
        batchNumber: l.batchNumber ?? null,
      })),
      note: dto.note ?? null,
      createdById: userId ? new Types.ObjectId(userId) : null,
    } as never);
  }

  async dispatchTransfer(transferId: string): Promise<StockTransferDocument> {
    const { tenantId } = this.scope();
    const tId = new Types.ObjectId(transferId);

    const session = await this.conn.startSession();
    try {
      let updated: StockTransferDocument | null = null;
      await session.withTransaction(async () => {
        const transfer = await this.transfers
          .findOneAndUpdate(
            { _id: tId, tenantId, status: 'draft' },
            { $set: { status: 'in_transit', shippedAt: new Date() } },
            { session, new: true },
          )
          .exec();
        if (!transfer) throw new ConflictException('transfer not found or not in draft status');

        for (const line of transfer.lines) {
          await applyStockDelta(
            { stock: this.stock, movements: this.movements },
            {
              tenantId,
              branchId: transfer.fromBranchId,
              productId: line.productId,
              qtyDelta: -line.quantity,
              reason: 'transfer_out',
              refType: 'stock_transfer',
              refId: transfer._id,
              note: `Transfer ${transfer.transferNumber} shipped`,
            },
            session,
          );
        }
        updated = transfer;
      });
      return updated!;
    } finally {
      await session.endSession();
    }
  }

  async receiveTransfer(transferId: string): Promise<StockTransferDocument> {
    const { tenantId } = this.scope();
    const tId = new Types.ObjectId(transferId);

    const session = await this.conn.startSession();
    try {
      let updated: StockTransferDocument | null = null;
      await session.withTransaction(async () => {
        const transfer = await this.transfers
          .findOneAndUpdate(
            { _id: tId, tenantId, status: 'in_transit' },
            { $set: { status: 'received', receivedAt: new Date() } },
            { session, new: true },
          )
          .exec();
        if (!transfer) throw new ConflictException('transfer not found or not in transit');

        for (const line of transfer.lines) {
          await applyStockDelta(
            { stock: this.stock, movements: this.movements },
            {
              tenantId,
              branchId: transfer.toBranchId,
              productId: line.productId,
              qtyDelta: line.quantity,
              reason: 'transfer_in',
              refType: 'stock_transfer',
              refId: transfer._id,
              note: `Transfer ${transfer.transferNumber} received`,
            },
            session,
          );
        }
        updated = transfer;
      });
      return updated!;
    } finally {
      await session.endSession();
    }
  }

  async cancelTransfer(transferId: string): Promise<StockTransferDocument> {
    const { tenantId } = this.scope();
    const tId = new Types.ObjectId(transferId);

    const session = await this.conn.startSession();
    try {
      let updated: StockTransferDocument | null = null;
      await session.withTransaction(async () => {
        const transfer = await this.transfers.findOne({ _id: tId, tenantId }).session(session).exec();
        if (!transfer) throw new NotFoundException('transfer not found');
        if (transfer.status === 'received' || transfer.status === 'cancelled') {
          throw new BadRequestException(`cannot cancel a ${transfer.status} transfer`);
        }

        if (transfer.status === 'in_transit') {
          // Restore stock back to fromBranchId
          for (const line of transfer.lines) {
            await applyStockDelta(
              { stock: this.stock, movements: this.movements },
              {
                tenantId,
                branchId: transfer.fromBranchId,
                productId: line.productId,
                qtyDelta: line.quantity,
                reason: 'transfer_in',
                refType: 'stock_transfer',
                refId: transfer._id,
                note: `Transfer ${transfer.transferNumber} cancelled`,
              },
              session,
            );
          }
        }

        transfer.status = 'cancelled';
        await transfer.save({ session });
        updated = transfer;
      });
      return updated!;
    } finally {
      await session.endSession();
    }
  }

  listTransfers(status?: string): Promise<StockTransferDocument[]> {
    const { tenantId } = this.scope();
    const filter: Record<string, unknown> = { tenantId };
    if (status) filter.status = status;
    return this.transfers.find(filter).sort({ createdAt: -1 }).limit(100).exec();
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
