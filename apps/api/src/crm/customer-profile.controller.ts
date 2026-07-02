import { Controller, Get, Param } from '@nestjs/common';
import { objectIdSchema } from '@salon/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { CustomerProfileService } from './customer-profile.service.js';

// Customer 360: timeline (appointments + sales), treatments, loyalty/gift-card
// balances, subscriptions, due balance, referrals made. Lives in CrmModule
// (not CustomersModule) since it aggregates across every Phase 3/4/5 collection.
@Controller('customers')
export class CustomerProfileController {
  constructor(private readonly profiles: CustomerProfileService) {}

  @Get(':id/profile')
  @CheckAbility('read', 'Customer')
  async profile(@Param('id', new ZodValidationPipe(objectIdSchema)) id: string) {
    return this.profiles.profile(id);
  }
}
