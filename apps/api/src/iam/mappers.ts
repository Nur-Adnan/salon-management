import type { BranchDocument } from './schemas/branch.schema.js';
import type { MembershipDocument } from './schemas/membership.schema.js';

export const serializeBranch = (b: BranchDocument) => ({
  id: String(b._id),
  name: b.name,
  timezone: b.timezone,
  address: b.address ?? null,
  status: b.status,
  slotMinutes: b.slotMinutes ?? 15,
  vatRateBps: b.vatRateBps ?? 0,
  workingHours: (b.workingHours ?? []).map((d) => ({
    closed: d.closed,
    open: d.open,
    close: d.close,
  })),
});

export const serializeMembership = (m: MembershipDocument) => ({
  id: String(m._id),
  tenantId: String(m.tenantId),
  userId: m.userId ? String(m.userId) : null,
  invitedEmail: m.invitedEmail ?? null,
  branchId: m.branchId ? String(m.branchId) : null,
  role: m.role,
  status: m.status,
});
