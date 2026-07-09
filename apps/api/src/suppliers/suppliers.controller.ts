import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateSupplier,
  type UpdateSupplier,
  createSupplierSchema,
  updateSupplierSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeSupplier } from './suppliers.mappers.js';
import { SuppliersService } from './suppliers.service.js';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @CheckAbility('read', 'Supplier')
  async list() {
    return (await this.suppliers.list()).map(serializeSupplier);
  }

  @Get(':id')
  @CheckAbility('read', 'Supplier')
  async get(@Param('id') id: string) {
    return serializeSupplier(await this.suppliers.get(id));
  }

  @Post()
  @CheckAbility('create', 'Supplier')
  async create(@Body(new ZodValidationPipe(createSupplierSchema)) dto: CreateSupplier) {
    return serializeSupplier(await this.suppliers.create(dto));
  }

  @Patch(':id')
  @CheckAbility('update', 'Supplier')
  async update(@Param('id') id: string, @Body(new ZodValidationPipe(updateSupplierSchema)) dto: UpdateSupplier) {
    return serializeSupplier(await this.suppliers.update(id, dto));
  }

  @Delete(':id')
  @CheckAbility('delete', 'Supplier')
  async remove(@Param('id') id: string) {
    return this.suppliers.remove(id);
  }
}
