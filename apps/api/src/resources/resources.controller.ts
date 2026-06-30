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
  type CreateResource,
  type UpdateResource,
  createResourceSchema,
  objectIdSchema,
  updateResourceSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CheckAbility } from '../iam/casl/check-ability.decorator';
import { ResourceRepository } from './resource.repository';
import type { ResourceDocument } from './resource.schema';

function serialize(r: ResourceDocument) {
  return {
    id: String(r._id),
    branchId: String(r.branchId),
    name: r.name,
    type: r.type,
    capacity: r.capacity,
    bookable: r.bookable,
  };
}

@Controller('resources')
export class ResourcesController {
  constructor(private readonly repo: ResourceRepository) {}

  @Get()
  @CheckAbility('read', 'Resource')
  async list() {
    return (await this.repo.find()).map(serialize);
  }

  @Post()
  @CheckAbility('create', 'Resource')
  async create(@Body(new ZodValidationPipe(createResourceSchema)) dto: CreateResource) {
    return serialize(await this.repo.create(dto));
  }

  @Patch(':id')
  @CheckAbility('update', 'Resource')
  async update(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateResourceSchema)) dto: UpdateResource,
  ) {
    const updated = await this.repo.updateById(id, dto);
    if (!updated) throw new NotFoundException('resource not found');
    return serialize(updated);
  }

  @Delete(':id')
  @CheckAbility('delete', 'Resource')
  async remove(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    const deleted = await this.repo.softDeleteById(id);
    if (!deleted) throw new NotFoundException('resource not found');
    return { id: String(deleted._id), deleted: true };
  }
}
