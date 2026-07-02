import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateCoupon,
  type UpdateCoupon,
  createCouponSchema,
  objectIdSchema,
  updateCouponSchema,
} from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { CouponsService } from './coupons.service.js';
import { serializeCoupon } from './mappers.js';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  @CheckAbility('read', 'Coupon')
  async list() {
    return (await this.coupons.list()).map(serializeCoupon);
  }

  @Post()
  @CheckAbility('manage', 'Coupon')
  async create(@Body(new ZodValidationPipe(createCouponSchema)) dto: CreateCoupon) {
    return serializeCoupon(await this.coupons.create(dto));
  }

  @Patch(':id')
  @CheckAbility('manage', 'Coupon')
  async update(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateCouponSchema)) dto: UpdateCoupon,
  ) {
    return serializeCoupon(await this.coupons.update(id, dto));
  }

  @Delete(':id')
  @CheckAbility('manage', 'Coupon')
  async remove(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    await this.coupons.remove(id);
    return { id, deleted: true };
  }
}
