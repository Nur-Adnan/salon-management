import { AbilityBuilder, type MongoAbility, createMongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import type { Action, Role, Subject } from '@salon/shared';
import { RequestContextService } from '../../common/context/request-context.service';

export type AppAbility = MongoAbility<[Action, Subject]>;

// Role -> abilities WITHIN the active tenant (the repository already scopes
// queries to tenantId/branchId; CASL adds the per-action authorization).
export function abilityForRole(role: Role | undefined, hasTenant: boolean): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (role && hasTenant) {
    switch (role) {
      case 'owner':
        can('manage', 'all');
        break;
      case 'manager':
        can('read', 'Organization');
        can('manage', 'Branch');
        can('manage', 'Resource');
        can('manage', 'Membership'); // invite/manage staff
        can('read', 'User');
        break;
      case 'accountant':
        can('read', 'all');
        break;
      case 'receptionist':
        can('read', 'Organization');
        can('read', 'Branch');
        can('read', 'Resource');
        can('read', 'User');
        break;
      case 'stylist':
        can('read', 'Branch');
        can('read', 'Resource');
        break;
      case 'read_only':
        can('read', 'all');
        break;
    }
  }

  return build();
}

@Injectable()
export class AbilityFactory {
  constructor(private readonly ctx: RequestContextService) {}

  forCurrentContext(): AppAbility {
    const c = this.ctx.get();
    return abilityForRole(c?.role, Boolean(c?.tenantId));
  }
}
