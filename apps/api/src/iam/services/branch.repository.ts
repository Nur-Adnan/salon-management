import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { RequestContextService } from '../../common/context/request-context.service';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { Branch, type BranchDocument } from '../schemas/branch.schema';

@Injectable()
export class BranchRepository extends TenantScopedRepository<BranchDocument> {
  constructor(@InjectModel(Branch.name) model: Model<BranchDocument>, ctx: RequestContextService) {
    super(model, ctx);
  }
}
