import { Body, Controller, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { type SetCompensation, objectIdSchema, setCompensationSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeStaffCompensation } from './mappers.js';
import { StaffService } from './staff.service.js';

@Controller('staff/:staffId/compensation')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @CheckAbility('read', 'Staff')
  async get(@Param('staffId', new ZodValidationPipe(objectIdSchema)) staffId: string) {
    return serializeStaffCompensation(await this.staff.get(staffId));
  }

  @Patch()
  @HttpCode(200)
  @CheckAbility('manage', 'Staff')
  async set(
    @Param('staffId', new ZodValidationPipe(objectIdSchema)) staffId: string,
    @Body(new ZodValidationPipe(setCompensationSchema)) dto: SetCompensation,
  ) {
    return serializeStaffCompensation(await this.staff.set(staffId, dto));
  }
}
