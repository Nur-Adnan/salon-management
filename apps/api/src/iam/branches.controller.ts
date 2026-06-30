import { Body, Controller, Get, Post } from '@nestjs/common';
import { type CreateBranch, createBranchSchema } from '@salon/shared';
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
}
