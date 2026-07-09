import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { type CreatePurchaseOrder, money, purchaseOrderTotal } from '@salon/shared';
import { type Connection, type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { Product, type ProductDocument } from '../catalog/schemas/product.schema.js';
import { applyStockDelta } from '../inventory/stock.util.js';
import { StockMovement, type StockMovementDocument } from '../inventory/schemas/stock-movement.schema.js';
import { Counter, type CounterDocument } from '../pos/schemas/counter.schema.js';
import { StockLevel, type StockLevelDocument } from '../pos/schemas/stock-level.schema.js';
import { PurchaseOrder, type PurchaseOrderDocument } from './schemas/purchase-order.schema.js';
import { Supplier, type SupplierDocument } from './schemas/supplier.schema.js';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(PurchaseOrder.name) private readonly pos: Model<PurchaseOrderDocument>,
    @InjectModel(Supplier.name) private readonly suppliers: Model<SupplierDocument>,
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(StockLevel.name) private readonly stock: Model<StockLevelDocument>,
    @InjectModel(StockMovement.name) private readonly movements: Model<StockMovementDocument>,
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

  async create(dto: CreatePurchaseOrder): Promise<PurchaseOrderDocument> {
    const { tenantId, branchId, userId } = this.scope();

    const supplier = await this.suppliers
      .findOne({ _id: new Types.ObjectId(dto.supplierId), tenantId, deletedAt: null })
      .exec();
    if (!supplier) throw new BadRequestException('unknown supplier');

    const productIds = [...new Set(dto.lines.map((l) => l.productId))];
    const found = await this.products
      .find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) }, tenantId, deletedAt: null })
      .select('_id')
      .exec();
    if (found.length !== productIds.length) throw new BadRequestException('a line references an unknown product');

    const totalCost = purchaseOrderTotal(dto.lines.map((l) => ({ quantity: l.quantity, unitCost: money(l.unitCost) })));
    const poNumber = await this.nextPoNumber(tenantId);

    return this.pos.create({
      tenantId,
      branchId,
      supplierId: supplier._id,
      poNumber,
      status: 'draft',
      lines: dto.lines.map((l) => ({
        productId: new Types.ObjectId(l.productId),
        quantity: l.quantity,
        unitCost: { amount: l.unitCost, currency: 'BDT' },
      })),
      totalCost: { amount: totalCost.amount, currency: 'BDT' },
      note: dto.note ?? null,
      createdByUserId: userId ? new Types.ObjectId(userId) : null,
    } as never);
  }

  // Receive a draft PO: flip draft->received (one-time guarded, so concurrent or
  // duplicated receives can never double-stock) and stock IN every line — one
  // movement per distinct product (aggregate first, keeping the movement
  // idempotency index valid), all in a single transaction.
  async receive(id: string): Promise<PurchaseOrderDocument> {
    const { tenantId, branchId } = this.scope();
    const _id = new Types.ObjectId(id);

    const session = await this.conn.startSession();
    try {
      await session.withTransaction(async () => {
        const before = await this.pos
          .findOneAndUpdate(
            { _id, tenantId, branchId, status: 'draft', deletedAt: null },
            { $set: { status: 'received', receivedAt: new Date() } },
            { new: false, session },
          )
          .exec();
        if (!before) {
          const exists = await this.pos.findOne({ _id, tenantId, branchId, deletedAt: null }).session(session).exec();
          if (!exists) throw new NotFoundException('purchase order not found');
          throw new BadRequestException(`purchase order is already ${exists.status}`);
        }

        const byProduct = new Map<string, number>();
        for (const l of before.lines) {
          byProduct.set(String(l.productId), (byProduct.get(String(l.productId)) ?? 0) + l.quantity);
        }
        for (const [productId, qty] of byProduct) {
          await applyStockDelta(
            { stock: this.stock, movements: this.movements },
            {
              tenantId,
              branchId,
              productId: new Types.ObjectId(productId),
              qtyDelta: qty,
              reason: 'purchase',
              refType: 'purchase_order',
              refId: _id,
            },
            session,
          );
        }
      });
    } finally {
      await session.endSession();
    }
    return this.get(id);
  }

  async cancel(id: string): Promise<PurchaseOrderDocument> {
    const { tenantId, branchId } = this.scope();
    const _id = new Types.ObjectId(id);
    const po = await this.pos
      .findOneAndUpdate(
        { _id, tenantId, branchId, status: 'draft', deletedAt: null },
        { $set: { status: 'cancelled' } },
        { new: true },
      )
      .exec();
    if (!po) {
      const exists = await this.pos.findOne({ _id, tenantId, branchId, deletedAt: null }).exec();
      if (!exists) throw new NotFoundException('purchase order not found');
      throw new BadRequestException(`cannot cancel a ${exists.status} purchase order`);
    }
    return po;
  }

  list(): Promise<PurchaseOrderDocument[]> {
    const { tenantId, branchId } = this.scope();
    return this.pos.find({ tenantId, branchId, deletedAt: null }).sort({ createdAt: -1 }).limit(500).exec();
  }

  async get(id: string): Promise<PurchaseOrderDocument> {
    const { tenantId, branchId } = this.scope();
    const po = await this.pos
      .findOne({ _id: new Types.ObjectId(id), tenantId, branchId, deletedAt: null })
      .exec();
    if (!po) throw new NotFoundException('purchase order not found');
    return po;
  }

  private async nextPoNumber(tenantId: Types.ObjectId): Promise<string> {
    const c = await this.counters
      .findOneAndUpdate({ key: `${String(tenantId)}:po` }, { $inc: { seq: 1 } }, { upsert: true, new: true })
      .exec();
    return `PO-${String(c.seq).padStart(6, '0')}`;
  }
}
