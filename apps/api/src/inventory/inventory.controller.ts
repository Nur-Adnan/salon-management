import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  type CreateStockAdjustment,
  createStockAdjustmentSchema,
  type CreateStockBatch,
  createStockBatchSchema,
  type CreateStockTransfer,
  createStockTransferSchema,
  type SetReorderPoint,
  setReorderPointSchema,
  type SetStock,
  setStockSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import {
  serializeStockAdjustment,
  serializeStockLevel,
  serializeStockMovement,
} from './inventory.mappers.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('stock')
  @CheckAbility('read', 'Inventory')
  async listStock() {
    return (await this.inventory.listStock()).map(serializeStockLevel);
  }

  @Put('stock')
  @CheckAbility('update', 'Inventory')
  async setStock(@Body(new ZodValidationPipe(setStockSchema)) dto: SetStock) {
    return serializeStockLevel(await this.inventory.setStock(dto));
  }

  @Put('reorder')
  @CheckAbility('update', 'Inventory')
  async setReorder(@Body(new ZodValidationPipe(setReorderPointSchema)) dto: SetReorderPoint) {
    return serializeStockLevel(await this.inventory.setReorderPoint(dto));
  }

  @Post('adjustments')
  @CheckAbility('update', 'Inventory')
  async adjust(@Body(new ZodValidationPipe(createStockAdjustmentSchema)) dto: CreateStockAdjustment) {
    return serializeStockAdjustment(await this.inventory.adjust(dto));
  }

  @Get('adjustments')
  @CheckAbility('read', 'Inventory')
  async listAdjustments() {
    return (await this.inventory.listAdjustments()).map(serializeStockAdjustment);
  }

  @Get('movements')
  @CheckAbility('read', 'Inventory')
  async listMovements(@Query('productId') productId?: string) {
    return (await this.inventory.listMovements(productId)).map(serializeStockMovement);
  }

  @Get('low-stock')
  @CheckAbility('read', 'Inventory')
  async lowStock() {
    return (await this.inventory.lowStock()).map(serializeStockLevel);
  }

  // --- Batches ---

  @Post('batches')
  @CheckAbility('manage', 'Inventory')
  async createBatch(@Body(new ZodValidationPipe(createStockBatchSchema)) dto: CreateStockBatch) {
    const b = await this.inventory.createBatch(dto);
    return {
      id: String(b._id),
      branchId: String(b.branchId),
      productId: String(b.productId),
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate.toISOString().slice(0, 10),
      qtyOnHand: b.qtyOnHand,
      unitCostMinor: b.unitCostMinor,
    };
  }

  @Get('batches')
  @CheckAbility('read', 'Inventory')
  async listBatches(@Query('productId') productId?: string) {
    const list = await this.inventory.listBatches(productId);
    return list.map((b) => ({
      id: String(b._id),
      branchId: String(b.branchId),
      productId: String(b.productId),
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate.toISOString().slice(0, 10),
      qtyOnHand: b.qtyOnHand,
      unitCostMinor: b.unitCostMinor,
    }));
  }

  // --- Inter-Branch Stock Transfers ---

  @Post('transfers')
  @CheckAbility('manage', 'Inventory')
  async createTransfer(@Body(new ZodValidationPipe(createStockTransferSchema)) dto: CreateStockTransfer) {
    const t = await this.inventory.createTransfer(dto);
    return {
      id: String(t._id),
      transferNumber: t.transferNumber,
      fromBranchId: String(t.fromBranchId),
      toBranchId: String(t.toBranchId),
      status: t.status,
      lines: t.lines.map((l) => ({
        productId: String(l.productId),
        quantity: l.quantity,
        batchNumber: l.batchNumber,
      })),
      note: t.note,
    };
  }

  @Get('transfers')
  @CheckAbility('read', 'Inventory')
  async listTransfers(@Query('status') status?: string) {
    const list = await this.inventory.listTransfers(status);
    return list.map((t) => ({
      id: String(t._id),
      transferNumber: t.transferNumber,
      fromBranchId: String(t.fromBranchId),
      toBranchId: String(t.toBranchId),
      status: t.status,
      lines: t.lines.map((l) => ({
        productId: String(l.productId),
        quantity: l.quantity,
        batchNumber: l.batchNumber,
      })),
      note: t.note,
      shippedAt: t.shippedAt?.toISOString() ?? null,
      receivedAt: t.receivedAt?.toISOString() ?? null,
    }));
  }

  @Post('transfers/:id/dispatch')
  @CheckAbility('manage', 'Inventory')
  async dispatchTransfer(@Param('id') id: string) {
    const t = await this.inventory.dispatchTransfer(id);
    return {
      id: String(t._id),
      status: t.status,
      shippedAt: t.shippedAt?.toISOString() ?? null,
    };
  }

  @Post('transfers/:id/receive')
  @CheckAbility('manage', 'Inventory')
  async receiveTransfer(@Param('id') id: string) {
    const t = await this.inventory.receiveTransfer(id);
    return {
      id: String(t._id),
      status: t.status,
      receivedAt: t.receivedAt?.toISOString() ?? null,
    };
  }

  @Post('transfers/:id/cancel')
  @CheckAbility('manage', 'Inventory')
  async cancelTransfer(@Param('id') id: string) {
    const t = await this.inventory.cancelTransfer(id);
    return {
      id: String(t._id),
      status: t.status,
    };
  }
}
