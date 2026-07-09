import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import {
  type CreateStockAdjustment,
  type SetReorderPoint,
  type SetStock,
  createStockAdjustmentSchema,
  setReorderPointSchema,
  setStockSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { InventoryService } from './inventory.service.js';
import { serializeStockAdjustment, serializeStockLevel, serializeStockMovement } from './inventory.mappers.js';

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
}
