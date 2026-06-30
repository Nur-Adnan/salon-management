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
  type CreateService,
  type CreateServiceCategory,
  type UpdateService,
  type UpdateServiceCategory,
  createServiceCategorySchema,
  createServiceSchema,
  objectIdSchema,
  updateServiceCategorySchema,
  updateServiceSchema,
} from '@salon/shared';
import { Types } from 'mongoose';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeService, serializeServiceCategory } from './mappers.js';
import { ServiceCategoryRepository, ServiceRepository } from './repositories.js';
import type { ServiceDocument } from './schemas/service.schema.js';

// zod validated the shape; mongoose casts categoryId (string -> ObjectId).
function toServiceDoc(dto: CreateService | UpdateService): Partial<ServiceDocument> {
  const { categoryId, ...rest } = dto;
  return {
    ...rest,
    ...(categoryId ? { categoryId: new Types.ObjectId(categoryId) } : {}),
  } as unknown as Partial<ServiceDocument>;
}

@Controller('catalog')
export class ServicesController {
  constructor(
    private readonly categories: ServiceCategoryRepository,
    private readonly services: ServiceRepository,
  ) {}

  // ---- service categories ----
  @Get('service-categories')
  @CheckAbility('read', 'Catalog')
  async listCategories() {
    return (await this.categories.find()).map(serializeServiceCategory);
  }

  @Post('service-categories')
  @CheckAbility('create', 'Catalog')
  async createCategory(
    @Body(new ZodValidationPipe(createServiceCategorySchema)) dto: CreateServiceCategory,
  ) {
    return serializeServiceCategory(await this.categories.create(dto));
  }

  @Patch('service-categories/:id')
  @CheckAbility('update', 'Catalog')
  async updateCategory(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateServiceCategorySchema)) dto: UpdateServiceCategory,
  ) {
    const u = await this.categories.updateById(id, dto);
    if (!u) throw new NotFoundException('service category not found');
    return serializeServiceCategory(u);
  }

  @Delete('service-categories/:id')
  @CheckAbility('delete', 'Catalog')
  async removeCategory(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const d = await this.categories.softDeleteById(id);
    if (!d) throw new NotFoundException('service category not found');
    return { id: String(d._id), deleted: true };
  }

  // ---- services ----
  @Get('services')
  @CheckAbility('read', 'Catalog')
  async list() {
    return (await this.services.find()).map(serializeService);
  }

  @Post('services')
  @CheckAbility('create', 'Catalog')
  async create(@Body(new ZodValidationPipe(createServiceSchema)) dto: CreateService) {
    return serializeService(await this.services.create(toServiceDoc(dto)));
  }

  @Patch('services/:id')
  @CheckAbility('update', 'Catalog')
  async update(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) dto: UpdateService,
  ) {
    const u = await this.services.updateById(id, toServiceDoc(dto));
    if (!u) throw new NotFoundException('service not found');
    return serializeService(u);
  }

  @Delete('services/:id')
  @CheckAbility('delete', 'Catalog')
  async remove(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const d = await this.services.softDeleteById(id);
    if (!d) throw new NotFoundException('service not found');
    return { id: String(d._id), deleted: true };
  }
}
