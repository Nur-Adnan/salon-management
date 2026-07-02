import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  type AddPayments,
  type CreateSale,
  type VoidSale,
  addPaymentsSchema,
  createSaleSchema,
  objectIdSchema,
  voidSaleSchema,
} from '@salon/shared';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeSale } from './mappers.js';
import { SalesService } from './sales.service.js';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  // Idempotent checkout: the interceptor replays the cached response for a repeated
  // Idempotency-Key (Redis fast path); the service + unique index guarantee a single
  // sale even if Redis is unavailable.
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @CheckAbility('create', 'Sale')
  async checkout(
    @Body(new ZodValidationPipe(createSaleSchema)) dto: CreateSale,
    @Headers('idempotency-key') key?: string,
  ) {
    return serializeSale(await this.sales.checkout(dto, key ?? null));
  }

  // Declared before ':id' so it isn't captured as an id param.
  @Get('summary')
  @CheckAbility('read', 'Sale')
  async summary(@Query('date') date?: string) {
    return this.sales.summary(date);
  }

  @Get()
  @CheckAbility('read', 'Sale')
  async list(@Query('date') date?: string, @Query('status') status?: string) {
    return (await this.sales.list({ date, status })).map(serializeSale);
  }

  @Get(':id')
  @CheckAbility('read', 'Sale')
  async get(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return serializeSale(await this.sales.get(id));
  }

  @Post(':id/payments')
  @HttpCode(200)
  @CheckAbility('update', 'Sale')
  async addPayments(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(addPaymentsSchema)) dto: AddPayments,
  ) {
    return serializeSale(await this.sales.addPayments(id, dto.payments));
  }

  @Post(':id/void')
  @HttpCode(200)
  @CheckAbility('update', 'Sale')
  async voidSale(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(voidSaleSchema)) dto: VoidSale,
  ) {
    return serializeSale(await this.sales.voidSale(id, dto.reason));
  }
}
