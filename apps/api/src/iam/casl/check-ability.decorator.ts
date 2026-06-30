import { SetMetadata } from '@nestjs/common';
import type { Action, Subject } from '@salon/shared';

export interface RequiredRule {
  action: Action;
  subject: Subject;
}

export const CHECK_ABILITY = 'check_ability';

export const CheckAbility = (action: Action, subject: Subject) =>
  SetMetadata<string, RequiredRule>(CHECK_ABILITY, { action, subject });
