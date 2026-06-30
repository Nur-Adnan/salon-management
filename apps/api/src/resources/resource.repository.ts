import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { type RepoFilter, TenantScopedRepository } from '../common/tenant-scoped.repository.js';
import { Resource, type ResourceDocument } from './resource.schema.js';

// Resources are tenant AND branch scoped: every op also requires an active branch,
// so a branch-A member can never touch branch-B resources even within the same tenant.
@Injectable()
export class ResourceRepository extends TenantScopedRepository<ResourceDocument> {
  constructor(
    @InjectModel(Resource.name) model: Model<ResourceDocument>,
    ctx: RequestContextService,
  ) {
    super(model, ctx);
  }

  private get branchId(): Types.ObjectId {
    const b = this.ctx.get()?.branchId;
    if (!b) throw new ForbiddenException('No active branch (set x-branch-id)');
    return new Types.ObjectId(b);
  }

  protected override scoped(filter: RepoFilter = {}): RepoFilter {
    return { ...super.scoped(filter), branchId: this.branchId };
  }

  override create(data: Partial<Resource>): Promise<ResourceDocument> {
    return this.model.create({
      ...data,
      tenantId: this.tenantId,
      branchId: this.branchId,
    }) as Promise<ResourceDocument>;
  }
}
