import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { type CreateWaitlist, createWaitlistSchema, objectIdSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeWaitlist } from './mappers.js';
import { WaitlistService } from './waitlist.service.js';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly service: WaitlistService) {}

  @Get()
  @CheckAbility('read', 'Appointment')
  async list() {
    return (await this.service.list()).map(serializeWaitlist);
  }

  @Post()
  @CheckAbility('create', 'Appointment')
  async add(@Body(new ZodValidationPipe(createWaitlistSchema)) dto: CreateWaitlist) {
    return serializeWaitlist(await this.service.add(dto));
  }

  @Delete(':id')
  @CheckAbility('update', 'Appointment')
  async cancel(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return serializeWaitlist(await this.service.cancel(id));
  }
}
