import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory } from './ability.factory.js';
import { CHECK_ABILITY, type RequiredRule } from './check-ability.decorator.js';

// Global authz guard. Runs after JwtAuthGuard (which populates the context), so
// the ability reflects the user's role in the active tenant/branch.
@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<RequiredRule>(CHECK_ABILITY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) return true; // no @CheckAbility -> not authz-gated here

    const ability = this.abilityFactory.forCurrentContext();
    if (!ability.can(rule.action, rule.subject)) {
      throw new ForbiddenException(`Cannot ${rule.action} ${rule.subject}`);
    }
    return true;
  }
}
