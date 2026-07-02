import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { type LoyaltyAdjust, loyaltyAdjustSchema, objectIdSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { LoyaltyService } from './loyalty.service.js';
import { serializeLoyaltyLedgerEntry } from './mappers.js';

@Controller('customers/:customerId/loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get()
  @CheckAbility('read', 'Loyalty')
  async get(@Param('customerId', new ZodValidationPipe(objectIdSchema)) customerId: string) {
    const [balance, ledger] = await Promise.all([
      this.loyalty.balance(customerId),
      this.loyalty.ledgerFor(customerId),
    ]);
    return { balance, ledger: ledger.map(serializeLoyaltyLedgerEntry) };
  }

  @Post('adjust')
  @HttpCode(200)
  @CheckAbility('manage', 'Loyalty')
  async adjust(
    @Param('customerId', new ZodValidationPipe(objectIdSchema)) customerId: string,
    @Body(new ZodValidationPipe(loyaltyAdjustSchema)) dto: LoyaltyAdjust,
  ) {
    const acct = await this.loyalty.adjust(customerId, dto.points, dto.note);
    return { balance: acct.balance };
  }
}
