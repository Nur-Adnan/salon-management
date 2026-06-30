import { ForbiddenException } from '@nestjs/common';
import { type FilterQuery, type Model, Types, type UpdateQuery } from 'mongoose';
import { RequestContextService } from './context/request-context.service';

// Base for every tenant-owned collection. EVERY read/write is scoped to the
// active tenant from the request context. A query that escapes its tenant is a
// security bug, so the scoping lives here (the repository layer), not in callers.
export abstract class TenantScopedRepository<T> {
  protected constructor(
    protected readonly model: Model<T>,
    protected readonly ctx: RequestContextService,
  ) {}

  protected get tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('No active tenant in request context');
    return new Types.ObjectId(t);
  }

  /** Force tenant + not-deleted onto every filter. */
  protected scoped(filter: FilterQuery<T> = {}): FilterQuery<T> {
    return { ...filter, tenantId: this.tenantId, deletedAt: null } as FilterQuery<T>;
  }

  create(data: Partial<T>): Promise<T> {
    return this.model.create({ ...data, tenantId: this.tenantId } as Partial<T>) as Promise<T>;
  }

  find(filter: FilterQuery<T> = {}): Promise<T[]> {
    return this.model.find(this.scoped(filter)).exec();
  }

  findById(id: string): Promise<T | null> {
    return this.model.findOne(this.scoped({ _id: new Types.ObjectId(id) } as FilterQuery<T>)).exec();
  }

  findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(this.scoped(filter)).exec();
  }

  updateById(id: string, patch: UpdateQuery<T>): Promise<T | null> {
    return this.model
      .findOneAndUpdate(this.scoped({ _id: new Types.ObjectId(id) } as FilterQuery<T>), patch, {
        new: true,
      })
      .exec();
  }

  softDeleteById(id: string): Promise<T | null> {
    return this.model
      .findOneAndUpdate(
        this.scoped({ _id: new Types.ObjectId(id) } as FilterQuery<T>),
        { deletedAt: new Date() } as UpdateQuery<T>,
        { new: true },
      )
      .exec();
  }
}
