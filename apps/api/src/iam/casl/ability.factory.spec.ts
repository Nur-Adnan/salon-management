import { describe, expect, it } from 'vitest';
import { abilityForRole } from './ability.factory';

describe('abilityForRole', () => {
  it('owner can manage everything in the tenant', () => {
    const a = abilityForRole('owner', true);
    expect(a.can('create', 'Resource')).toBe(true);
    expect(a.can('delete', 'Branch')).toBe(true);
    expect(a.can('manage', 'Membership')).toBe(true);
  });

  it('stylist can read but not create resources, cannot read memberships', () => {
    const a = abilityForRole('stylist', true);
    expect(a.can('read', 'Resource')).toBe(true);
    expect(a.can('create', 'Resource')).toBe(false);
    expect(a.can('read', 'Membership')).toBe(false);
  });

  it('manager manages resources + invites, reads but cannot mutate the org', () => {
    const a = abilityForRole('manager', true);
    expect(a.can('create', 'Resource')).toBe(true);
    expect(a.can('create', 'Membership')).toBe(true);
    expect(a.can('read', 'Organization')).toBe(true);
    expect(a.can('update', 'Organization')).toBe(false);
  });

  it('read_only can read but not write', () => {
    const a = abilityForRole('read_only', true);
    expect(a.can('read', 'Resource')).toBe(true);
    expect(a.can('create', 'Resource')).toBe(false);
  });

  it('no role or no active tenant => no abilities', () => {
    expect(abilityForRole(undefined, false).can('read', 'Resource')).toBe(false);
    expect(abilityForRole('owner', false).can('read', 'Resource')).toBe(false);
  });
});
