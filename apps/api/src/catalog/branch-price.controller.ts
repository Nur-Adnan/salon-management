import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { branchPriceOverrideSchema, type BranchPriceOverrideInput } from '@salon/shared';
import { type Model, Types } from 'mongoose';
import { RequestContextService } from '../common/context/request-context.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import {
  BranchPriceOverride,
  type BranchPriceOverrideDocument,
} from './schemas/branch-price-override.schema.js';

@Controller('catalog/overrides')
export class BranchPriceController {
  constructor(
    @InjectModel(BranchPriceOverride.name)
    private readonly overrides: Model<BranchPriceOverrideDocument>,
    private readonly ctx: RequestContextService,
  ) {}

  private tenantId(): Types.ObjectId {
    const t = this.ctx.get()?.tenantId;
    if (!t) throw new ForbiddenException('active tenant required');
    return new Types.ObjectId(t);
  }

  @Get()
  @CheckAbility('read', 'Catalog')
  async list(@Query('branchId') branchId?: string) {
    const tenantId = this.tenantId();
    const filter: Record<string, unknown> = { tenantId };
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const docs = await this.overrides.find(filter).exec();
    return docs.map((d) => ({
      id: String(d._id),
      branchId: String(d.branchId),
      itemType: d.itemType,
      itemId: String(d.itemId),
      price: d.price,
    }));
  }

  @Put()
  @CheckAbility('manage', 'Catalog')
  async upsert(@Body(new ZodValidationPipe(branchPriceOverrideSchema)) dto: BranchPriceOverrideInput) {
    const tenantId = this.tenantId();
    const branchId = new Types.ObjectId(dto.branchId);
    const itemId = new Types.ObjectId(dto.itemId);

    const updated = await this.overrides
      .findOneAndUpdate(
        { tenantId, branchId, itemType: dto.itemType, itemId },
        { price: { amount: dto.priceMinor, currency: 'BDT' } },
        { upsert: true, new: true },
      )
      .exec();

    return {
      id: String(updated._id),
      branchId: String(updated.branchId),
      itemType: updated.itemType,
      itemId: String(updated.itemId),
      price: updated.price,
    };
  }

  @Delete(':id')
  @CheckAbility('manage', 'Catalog')
  async remove(@Param('id') id: string) {
    const tenantId = this.tenantId();
    await this.overrides.deleteOne({ _id: new Types.ObjectId(id), tenantId }).exec();
    return { ok: true };
  }
}
