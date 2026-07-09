import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../catalog/schemas/product.schema.js';
import { StockMovement, StockMovementSchema } from '../inventory/schemas/stock-movement.schema.js';
import { Counter, CounterSchema } from '../pos/schemas/counter.schema.js';
import { StockLevel, StockLevelSchema } from '../pos/schemas/stock-level.schema.js';
import { PurchaseOrdersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { PurchaseOrder, PurchaseOrderSchema } from './schemas/purchase-order.schema.js';
import { Supplier, SupplierSchema } from './schemas/supplier.schema.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      // Receiving a PO stocks in via applyStockDelta (plain fn) — register the
      // stock + movement + counter + product models directly, no circular import.
      { name: StockLevel.name, schema: StockLevelSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
})
export class SuppliersModule {}
