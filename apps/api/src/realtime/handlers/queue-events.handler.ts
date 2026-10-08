import { Injectable } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { WaitlistAdded, WaitlistCancelled } from '../../scheduling/events.js';
import { WaitlistEntry, type WaitlistEntryDocument } from '../../scheduling/schemas/waitlist.schema.js';
import { RealtimeGateway } from '../realtime.gateway.js';

@Injectable()
@EventsHandler(WaitlistAdded)
export class RealtimeWaitlistAddedHandler implements IEventHandler<WaitlistAdded> {
  constructor(
    @InjectModel(WaitlistEntry.name) private readonly waitlist: Model<WaitlistEntryDocument>,
    private readonly gateway: RealtimeGateway,
  ) {}

  async handle(event: WaitlistAdded): Promise<void> {
    const { tenantId, branchId, entryId } = event;
    if (!Types.ObjectId.isValid(entryId) || !Types.ObjectId.isValid(tenantId)) return;
    const entry = await this.waitlist.findOne({
      _id: new Types.ObjectId(entryId),
      tenantId: new Types.ObjectId(tenantId),
    }).exec();

    if (!entry) return;

    this.gateway.broadcastQueueEvent(tenantId, branchId, 'queue.entry_added', {
      entryId,
      customerId: String(entry.customerId),
      status: entry.status,
      serviceId: entry.serviceId ? String(entry.serviceId) : null,
      staffId: entry.staffId ? String(entry.staffId) : null,
      createdAt: (entry as any).createdAt,
    });
  }
}

@Injectable()
@EventsHandler(WaitlistCancelled)
export class RealtimeWaitlistCancelledHandler implements IEventHandler<WaitlistCancelled> {
  constructor(private readonly gateway: RealtimeGateway) {}

  async handle(event: WaitlistCancelled): Promise<void> {
    this.gateway.broadcastQueueEvent(event.tenantId, event.branchId, 'queue.entry_cancelled', {
      entryId: event.entryId,
      status: 'cancelled',
    });
  }
}
