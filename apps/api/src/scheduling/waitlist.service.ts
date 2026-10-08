import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import type { CreateWaitlist } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { CustomerRepository } from '../customers/customer.repository.js';
import { WaitlistAdded, WaitlistCancelled } from './events.js';
import { WaitlistEntry, type WaitlistEntryDocument } from './schemas/waitlist.schema.js';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectModel(WaitlistEntry.name) private readonly waitlist: Model<WaitlistEntryDocument>,
    private readonly customers: CustomerRepository,
    private readonly ctx: RequestContextService,
    private readonly eventBus: EventBus,
  ) {}

  private scope(): { tenantId: Types.ObjectId; branchId: Types.ObjectId } {
    const c = this.ctx.get();
    if (!c?.tenantId || !c?.branchId) throw new ForbiddenException('active tenant + branch required');
    return { tenantId: new Types.ObjectId(c.tenantId), branchId: new Types.ObjectId(c.branchId) };
  }

  async add(dto: CreateWaitlist): Promise<WaitlistEntryDocument> {
    const { tenantId, branchId } = this.scope();
    const customerId = await this.customers.resolveId({
      customerId: dto.customerId,
      customer: dto.customer,
    });
    const entry = await this.waitlist.create({
      tenantId,
      branchId,
      customerId,
      serviceId: dto.serviceId ? new Types.ObjectId(dto.serviceId) : null,
      staffId: dto.staffId ? new Types.ObjectId(dto.staffId) : null,
      desiredDate: dto.desiredDate ?? null,
      note: dto.note ?? null,
      status: 'waiting',
    });
    this.eventBus.publish(new WaitlistAdded(String(tenantId), String(branchId), String(entry._id)));
    return entry;
  }

  async list(): Promise<WaitlistEntryDocument[]> {
    const { tenantId, branchId } = this.scope();
    return this.waitlist
      .find({ tenantId, branchId, status: 'waiting', deletedAt: null })
      .sort({ createdAt: 1 })
      .exec();
  }

  async cancel(id: string): Promise<WaitlistEntryDocument> {
    const { tenantId, branchId } = this.scope();
    const w = await this.waitlist
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), tenantId, branchId },
        { status: 'cancelled' },
        { new: true },
      )
      .exec();
    if (!w) throw new NotFoundException('waitlist entry not found');
    this.eventBus.publish(new WaitlistCancelled(String(tenantId), String(branchId), String(w._id)));
    return w;
  }
}
