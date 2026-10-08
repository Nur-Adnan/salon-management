import { Injectable } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { SaleCompleted, SaleVoided } from '../../pos/events.js';
import { Sale, type SaleDocument } from '../../pos/schemas/sale.schema.js';
import { RealtimeGateway } from '../realtime.gateway.js';

@Injectable()
@EventsHandler(SaleCompleted)
export class RealtimeSaleCompletedHandler implements IEventHandler<SaleCompleted> {
  constructor(
    @InjectModel(Sale.name) private readonly sales: Model<SaleDocument>,
    private readonly gateway: RealtimeGateway,
  ) {}

  async handle(event: SaleCompleted): Promise<void> {
    const { tenantId, branchId, saleId } = event;
    if (!Types.ObjectId.isValid(saleId) || !Types.ObjectId.isValid(tenantId)) return;
    const sale = await this.sales.findOne({
      _id: new Types.ObjectId(saleId),
      tenantId: new Types.ObjectId(tenantId),
    }).exec();

    if (!sale) return;

    this.gateway.broadcastPosEvent(tenantId, branchId, 'pos.sale_completed', {
      saleId,
      invoiceNumber: sale.invoiceNumber,
      total: sale.total,
      status: sale.status,
      customerId: sale.customerId ? String(sale.customerId) : null,
      lineCount: sale.lines.length,
    });
  }
}

@Injectable()
@EventsHandler(SaleVoided)
export class RealtimeSaleVoidedHandler implements IEventHandler<SaleVoided> {
  constructor(private readonly gateway: RealtimeGateway) {}

  async handle(event: SaleVoided): Promise<void> {
    this.gateway.broadcastPosEvent(event.tenantId, event.branchId, 'pos.sale_voided', {
      saleId: event.saleId,
      status: 'voided',
    });
  }
}
