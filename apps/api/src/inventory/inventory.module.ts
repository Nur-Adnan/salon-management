import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockLevel, StockLevelSchema } from '../pos/schemas/stock-level.schema.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { StockAdjustment, StockAdjustmentSchema } from './schemas/stock-adjustment.schema.js';
import { StockMovement, StockMovementSchema } from './schemas/stock-movement.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockLevel.name, schema: StockLevelSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: StockAdjustment.name, schema: StockAdjustmentSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
