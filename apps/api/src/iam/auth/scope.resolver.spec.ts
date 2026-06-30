import type { Role } from '@salon/shared';
import { describe, expect, it } from 'vitest';
import type { MembershipView } from '../../common/context/request-context.service.js';
import { resolveScope } from './scope.resolver.js';

const m = (tenantId: string, branchId: string | null, role: Role): MembershipView => ({
  tenantId,
  branchId,
  role,
});

describe('resolveScope', () => {
  it('no tenant header => empty scope (bootstrap routes only)', () => {
    expect(resolveScope([], undefined, undefined)).toEqual({});
  });

  it('branch without tenant => forbidden', () => {
    expect(() => resolveScope([], undefined, 'B')).toThrow();
  });

  it('not a member of the requested tenant => forbidden', () => {
    expect(() => resolveScope([m('t1', null, 'owner')], 't2')).toThrow();
  });

  it('cross-branch blocked: a member of branch A cannot select branch B', () => {
    expect(() => resolveScope([m('t1', 'A', 'stylist')], 't1', 'B')).toThrow();
  });

  it('member of branch A can act in A with their role', () => {
    expect(resolveScope([m('t1', 'A', 'stylist')], 't1', 'A')).toEqual({
      tenantId: 't1',
      branchId: 'A',
      role: 'stylist',
    });
  });

  it('org-wide membership grants any branch of the tenant', () => {
    expect(resolveScope([m('t1', null, 'owner')], 't1', 'B')).toEqual({
      tenantId: 't1',
      branchId: 'B',
      role: 'owner',
    });
  });

  it('tenant header without branch picks the org-wide membership', () => {
    expect(resolveScope([m('t1', null, 'owner')], 't1')).toEqual({
      tenantId: 't1',
      branchId: undefined,
      role: 'owner',
    });
  });
});
