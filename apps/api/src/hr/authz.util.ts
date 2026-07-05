import { ForbiddenException } from '@nestjs/common';
import type { Subject } from '@salon/shared';
import type { AppAbility } from '../iam/casl/ability.factory.js';

// Blanket-visibility roles (accountant, read_only) are granted `read('all')`
// but deliberately no `manage` on any one subject — they can see everyone's
// records but shouldn't gain write powers through this check. A caller who
// only reaches a write-context call site (clockIn, run payroll, ...) via
// read('all') is still blocked at the controller's @CheckAbility action gate
// before this ever runs, so recognizing read('all') here is safe even though
// it's shared by both read and write call sites.
export function canViewAll(ability: AppAbility, subject: Subject): boolean {
  return ability.can('manage', subject) || ability.can('read', 'all');
}

// CASL here only checks subject+action (see ability.factory.ts) — it has no
// concept of "your own record". A stylist's broad `read`/`create` grant on
// Staff/Attendance/Payroll is only safe because every route that uses it also
// calls this: acting on someone else's record requires broader visibility
// (owner/manager/receptionist's `manage`, or accountant/read_only's blanket
// `read all`), same convention as the existing `can('read', 'Sale')` comment
// on the stylist role anticipates.
export function assertSelfOrManage(
  ability: AppAbility,
  subject: Subject,
  callerUserId: string | null,
  targetUserId: string,
): void {
  if (callerUserId && callerUserId === targetUserId) return;
  if (!canViewAll(ability, subject)) {
    throw new ForbiddenException(`you can only act on your own ${subject.toLowerCase()} record`);
  }
}
