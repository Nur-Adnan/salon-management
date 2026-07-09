import { describe, expect, it } from 'vitest';
import { abilityForRole } from './ability.factory.js';

describe('abilityForRole', () => {
  it('owner can manage everything in the tenant', () => {
    const a = abilityForRole('owner', true);
    expect(a.can('create', 'Resource')).toBe(true);
    expect(a.can('delete', 'Branch')).toBe(true);
    expect(a.can('manage', 'Membership')).toBe(true);
  });

  it('stylist can read but not create resources/catalog, cannot read memberships', () => {
    const a = abilityForRole('stylist', true);
    expect(a.can('read', 'Resource')).toBe(true);
    expect(a.can('create', 'Resource')).toBe(false);
    expect(a.can('read', 'Catalog')).toBe(true);
    expect(a.can('create', 'Catalog')).toBe(false);
    expect(a.can('read', 'Membership')).toBe(false);
  });

  it('manager manages resources + catalog + invites, reads but cannot mutate the org', () => {
    const a = abilityForRole('manager', true);
    expect(a.can('create', 'Resource')).toBe(true);
    expect(a.can('manage', 'Catalog')).toBe(true);
    expect(a.can('create', 'Membership')).toBe(true);
    expect(a.can('read', 'Organization')).toBe(true);
    expect(a.can('update', 'Organization')).toBe(false);
  });

  it('read_only can read but not write', () => {
    const a = abilityForRole('read_only', true);
    expect(a.can('read', 'Resource')).toBe(true);
    expect(a.can('create', 'Resource')).toBe(false);
  });

  it('Phase 7: manager manages Inventory + Supplier; stylist/receptionist read Inventory but not Supplier', () => {
    const manager = abilityForRole('manager', true);
    expect(manager.can('manage', 'Inventory')).toBe(true);
    expect(manager.can('manage', 'Supplier')).toBe(true);

    const stylist = abilityForRole('stylist', true);
    expect(stylist.can('read', 'Inventory')).toBe(true);
    expect(stylist.can('update', 'Inventory')).toBe(false);
    expect(stylist.can('read', 'Supplier')).toBe(false);

    const receptionist = abilityForRole('receptionist', true);
    expect(receptionist.can('read', 'Inventory')).toBe(true);
    expect(receptionist.can('update', 'Inventory')).toBe(false);
    expect(receptionist.can('read', 'Supplier')).toBe(false);

    // accountant reads everything (incl. Supplier/PO for cost) but cannot mutate stock
    const accountant = abilityForRole('accountant', true);
    expect(accountant.can('read', 'Supplier')).toBe(true);
    expect(accountant.can('read', 'Inventory')).toBe(true);
    expect(accountant.can('update', 'Inventory')).toBe(false);
  });

  it('no role or no active tenant => no abilities', () => {
    expect(abilityForRole(undefined, false).can('read', 'Resource')).toBe(false);
    expect(abilityForRole('owner', false).can('read', 'Resource')).toBe(false);
  });
});
