import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type CreatePackage,
  type UpdatePackage,
  createPackageSchema,
  objectIdSchema,
  updatePackageSchema,
} from '@salon/shared';
import { Types } from 'mongoose';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializePackage } from './mappers.js';
import { PackagesService } from './packages.service.js';
import { PackageRepository } from './repositories.js';
import type { PackageDocument } from './schemas/package.schema.js';

function toPackageDoc(dto: CreatePackage | UpdatePackage): Partial<PackageDocument> {
  const doc: Record<string, unknown> = { ...dto };
  if (dto.items) {
    doc.items = dto.items.map((i) => ({
      kind: i.kind,
      refId: new Types.ObjectId(i.refId),
      quantity: i.quantity,
    }));
  }
  return doc as unknown as Partial<PackageDocument>;
}

@Controller('catalog')
export class PackagesController {
  constructor(
    private readonly packages: PackageRepository,
    private readonly pricing: PackagesService,
  ) {}

  @Get('packages')
  @CheckAbility('read', 'Catalog')
  async list() {
    const pkgs = await this.packages.find();
    return Promise.all(pkgs.map(async (p) => serializePackage(p, await this.pricing.pricing(p))));
  }

  @Post('packages')
  @CheckAbility('create', 'Catalog')
  async create(@Body(new ZodValidationPipe(createPackageSchema)) dto: CreatePackage) {
    await this.pricing.assertItemsExist(dto.items);
    const doc = await this.packages.create(toPackageDoc(dto));
    return serializePackage(doc, await this.pricing.pricing(doc));
  }

  @Patch('packages/:id')
  @CheckAbility('update', 'Catalog')
  async update(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updatePackageSchema)) dto: UpdatePackage,
  ) {
    if (dto.items) await this.pricing.assertItemsExist(dto.items);
    const u = await this.packages.updateById(id, toPackageDoc(dto));
    if (!u) throw new NotFoundException('package not found');
    return serializePackage(u, await this.pricing.pricing(u));
  }

  @Delete('packages/:id')
  @CheckAbility('delete', 'Catalog')
  async remove(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const d = await this.packages.softDeleteById(id);
    if (!d) throw new NotFoundException('package not found');
    return { id: String(d._id), deleted: true };
  }
}
