import { AbilityBuilder, type MongoAbility, createMongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import type { Action, Role, Subject } from '@salon/shared';
import { RequestContextService } from '../../common/context/request-context.service.js';

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
        can('manage', 'Catalog');
        can('manage', 'Customer');
        can('manage', 'Appointment');
        can('manage', 'Sale'); // POS + void
        can('manage', 'Treatment');
        can('manage', 'Loyalty');
        can('manage', 'GiftCard');
        can('manage', 'Coupon');
        can('manage', 'Subscription');
        can('manage', 'Membership'); // invite/manage staff
        can('read', 'User');
        can('manage', 'Staff'); // set compensation profiles
        can('manage', 'Attendance');
        can('manage', 'Payroll');
        can('manage', 'Inventory'); // stock, adjustments, reorder
        can('manage', 'Supplier'); // suppliers + purchase orders (procurement)
        can('read', 'Report'); // dashboards / analytics
        can('manage', 'Notification');
        can('manage', 'Campaign');
        break;
      case 'accountant':
        can('read', 'all');
        can('manage', 'Payroll'); // processes payroll runs, but doesn't set pay rates (Staff stays read-only via read('all'))
        break;
      case 'receptionist':
        can('read', 'Organization');
        can('read', 'Branch');
        can('read', 'Resource');
        can('read', 'Catalog');
        can('read', 'User');
        can('manage', 'Customer'); // front desk owns customers + the calendar
        can('manage', 'Appointment');
        can('manage', 'Sale'); // front desk rings up sales + takes payment
        can('manage', 'GiftCard'); // selling/issuing gift cards is a front-desk task
        can('manage', 'Subscription'); // signing customers up for memberships
        can('read', 'Loyalty');
        can('read', 'Coupon');
        can('read', 'Treatment');
        can('manage', 'Attendance'); // front-desk clock terminal for everyone
        can('read', 'Inventory'); // see on-hand stock while ringing up
        break;
      case 'stylist':
        can('read', 'Branch');
        can('read', 'Resource');
        can('read', 'Catalog');
        can('read', 'Customer');
        can('read', 'Appointment');
        can('update', 'Appointment'); // check-in / start / complete their own work
        can('read', 'Sale'); // see their attributed sales
        can('manage', 'Treatment'); // they log color formulas, notes, photos
        can('read', 'Loyalty'); // check a customer's points balance during service
        can('read', 'Staff'); // their own compensation profile (service layer scopes to self)
        can('create', 'Attendance'); // self clock-in
        can('update', 'Attendance'); // self clock-out
        can('read', 'Attendance'); // their own attendance history (service layer scopes to self)
        can('read', 'Payroll'); // their own earnings/payslips (service layer scopes to self)
        can('read', 'Inventory'); // check whether a retail product is in stock
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
