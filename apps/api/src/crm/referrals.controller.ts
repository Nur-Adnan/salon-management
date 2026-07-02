import { Body, Controller, Get, Post } from '@nestjs/common';
import { type CreateReferral, createReferralSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeReferral } from './mappers.js';
import { ReferralsService } from './referrals.service.js';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  @CheckAbility('read', 'Customer')
  async list() {
    return (await this.referrals.list()).map(serializeReferral);
  }

  @Post()
  @CheckAbility('create', 'Customer')
  async create(@Body(new ZodValidationPipe(createReferralSchema)) dto: CreateReferral) {
    return serializeReferral(await this.referrals.create(dto));
  }
}
