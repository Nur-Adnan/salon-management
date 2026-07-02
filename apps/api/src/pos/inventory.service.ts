import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { SetStock } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { StockLevel, type StockLevelDocument } from './schemas/stock-level.schema.js';

// Minimal stock read/seed for the active branch. POS decrements these rows inside
// the checkout transaction; this service just lets an owner set the starting count.
// Full Inventory (batches, movements, POs, reorder) is Phase 7.
@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(StockLevel.name) private readonly stock: Model<StockLevelDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return { tenantId: new Types.ObjectId(c.tenantId), branchId: new Types.ObjectId(c.branchId) };
  }

  async setStock(dto: SetStock): Promise<StockLevelDocument> {
    const { tenantId, branchId } = this.scope();
    const doc = await this.stock
      .findOneAndUpdate(
        { tenantId, branchId, productId: new Types.ObjectId(dto.productId) },
        { $set: { qtyOnHand: dto.qtyOnHand } },
        { upsert: true, new: true },
      )
      .exec();
    return doc;
  }

  list(): Promise<StockLevelDocument[]> {
    const { tenantId, branchId } = this.scope();
    return this.stock.find({ tenantId, branchId }).exec();
  }
}
