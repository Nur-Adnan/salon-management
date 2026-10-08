import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from '../pos/schemas/counter.schema.js';
import { StockLevel, StockLevelSchema } from '../pos/schemas/stock-level.schema.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { StockAdjustment, StockAdjustmentSchema } from './schemas/stock-adjustment.schema.js';
import { StockBatch, StockBatchSchema } from './schemas/stock-batch.schema.js';
import { StockMovement, StockMovementSchema } from './schemas/stock-movement.schema.js';
import { StockTransfer, StockTransferSchema } from './schemas/stock-transfer.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockLevel.name, schema: StockLevelSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: StockAdjustment.name, schema: StockAdjustmentSchema },
      { name: StockBatch.name, schema: StockBatchSchema },
      { name: StockTransfer.name, schema: StockTransferSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
