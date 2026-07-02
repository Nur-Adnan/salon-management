import { Body, Controller, Get, Put } from '@nestjs/common';
import { type SetStock, setStockSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { InventoryService } from './inventory.service.js';
import { serializeStockLevel } from './mappers.js';

// Minimal stock surface for Phase 4 (POS decrements it on sale). Phase 7 replaces
// this with the full Inventory module.
@Controller('inventory/stock')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @CheckAbility('read', 'Catalog')
  async list() {
    return (await this.inventory.list()).map(serializeStockLevel);
  }

  @Put()
  @CheckAbility('update', 'Catalog')
  async setStock(@Body(new ZodValidationPipe(setStockSchema)) dto: SetStock) {
    return serializeStockLevel(await this.inventory.setStock(dto));
  }
}
