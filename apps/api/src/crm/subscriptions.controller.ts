import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, UseInterceptors } from '@nestjs/common';
import {
  type CreateSubscriptionPlan,
  type RenewSubscription,
  type SubscribeCustomer,
  type UpdateSubscriptionPlan,
  createSubscriptionPlanSchema,
  objectIdSchema,
  renewSubscriptionSchema,
  subscribeCustomerSchema,
  updateSubscriptionPlanSchema,
} from '@salon/shared';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { serializeSale } from '../pos/mappers.js';
import { serializeCustomerSubscription, serializeSubscriptionPlan } from './mappers.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @CheckAbility('read', 'Subscription')
  async list() {
    return (await this.subscriptions.listPlans()).map(serializeSubscriptionPlan);
  }

  @Post()
  @CheckAbility('manage', 'Subscription')
  async create(@Body(new ZodValidationPipe(createSubscriptionPlanSchema)) dto: CreateSubscriptionPlan) {
    return serializeSubscriptionPlan(await this.subscriptions.createPlan(dto));
  }

  @Patch(':id')
  @CheckAbility('manage', 'Subscription')
  async update(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateSubscriptionPlanSchema)) dto: UpdateSubscriptionPlan,
  ) {
    return serializeSubscriptionPlan(await this.subscriptions.updatePlan(id, dto));
  }
}

@Controller('subscriptions')
export class CustomerSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('by-customer/:customerId')
  @CheckAbility('read', 'Subscription')
  async forCustomer(@Param('customerId', new ZodValidationPipe(objectIdSchema)) customerId: string) {
    const rows = await this.subscriptions.listForCustomer(customerId);
    return rows.map(({ doc, billingState }) => ({
      ...serializeCustomerSubscription(doc),
      billingState,
    }));
  }

  @Post()
  @CheckAbility('manage', 'Subscription')
  async subscribe(@Body(new ZodValidationPipe(subscribeCustomerSchema)) dto: SubscribeCustomer) {
    return serializeCustomerSubscription(await this.subscriptions.subscribe(dto.customerId, dto.planId));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @CheckAbility('manage', 'Subscription')
  async cancel(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return serializeCustomerSubscription(await this.subscriptions.cancel(id));
  }

  // Manual renew — see docs/phase-5.md (no auto-charge exists in this system).
  @Post(':id/renew')
  @UseInterceptors(IdempotencyInterceptor)
  @CheckAbility('manage', 'Subscription')
  async renew(
    @Param('id', new ZodValidationPipe(objectIdSchema)) id: string,
    @Body(new ZodValidationPipe(renewSubscriptionSchema)) dto: RenewSubscription,
    @Headers('idempotency-key') key?: string,
  ) {
    const { subscription, sale } = await this.subscriptions.renew(id, dto.payments, key ?? null);
    return { subscription: serializeCustomerSubscription(subscription), sale: serializeSale(sale) };
  }
}
