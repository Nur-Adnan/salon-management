import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { type CreatePurchaseOrder, createPurchaseOrderSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { serializePurchaseOrder } from './suppliers.mappers.js';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  @CheckAbility('read', 'Supplier')
  async list() {
    return (await this.purchaseOrders.list()).map(serializePurchaseOrder);
  }

  @Get(':id')
  @CheckAbility('read', 'Supplier')
  async get(@Param('id') id: string) {
    return serializePurchaseOrder(await this.purchaseOrders.get(id));
  }

  @Post()
  @CheckAbility('create', 'Supplier')
  async create(@Body(new ZodValidationPipe(createPurchaseOrderSchema)) dto: CreatePurchaseOrder) {
    return serializePurchaseOrder(await this.purchaseOrders.create(dto));
  }

  @Post(':id/receive')
  @HttpCode(200)
  @CheckAbility('update', 'Supplier')
  async receive(@Param('id') id: string) {
    return serializePurchaseOrder(await this.purchaseOrders.receive(id));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @CheckAbility('update', 'Supplier')
  async cancel(@Param('id') id: string) {
    return serializePurchaseOrder(await this.purchaseOrders.cancel(id));
  }
}
