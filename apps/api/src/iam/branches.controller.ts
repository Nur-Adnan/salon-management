import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateBranch,
  type UpdateBranchSchedule,
  type UpdateBranchTax,
  createBranchSchema,
  objectIdSchema,
  updateBranchScheduleSchema,
  updateBranchTaxSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from './casl/check-ability.decorator.js';
import { serializeBranch } from './mappers.js';
import { BranchRepository } from './services/branch.repository.js';

@Controller('branches')
export class BranchesController {
  constructor(private readonly repo: BranchRepository) {}

  @Get()
  @CheckAbility('read', 'Branch')
  async list() {
    return (await this.repo.find()).map(serializeBranch);
  }

  @Post()
  @CheckAbility('create', 'Branch')
  async create(@Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranch) {
    return serializeBranch(await this.repo.create(dto));
  }

  // Set the booking grid + weekly working hours (drives the availability engine).
  @Patch(':id/schedule')
  @CheckAbility('update', 'Branch')
  async setSchedule(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateBranchScheduleSchema)) dto: UpdateBranchSchedule,
  ) {
    const b = await this.repo.updateById(id, dto);
    if (!b) throw new NotFoundException('branch not found');
    return serializeBranch(b);
  }

  // Set the branch VAT rate (basis points) applied by POS to taxable lines.
  @Patch(':id/tax')
  @CheckAbility('update', 'Branch')
  async setTax(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateBranchTaxSchema)) dto: UpdateBranchTax,
  ) {
    const b = await this.repo.updateById(id, dto);
    if (!b) throw new NotFoundException('branch not found');
    return serializeBranch(b);
  }
}
