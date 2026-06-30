import { z } from 'zod';
import { LOCALES, RESOURCE_TYPES, ROLES } from './enums.js';

export const localeSchema = z.enum(LOCALES);

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'invalid id');
export const roleSchema = z.enum(ROLES);

// --- Phase 1: Identity, Access, Tenancy ---

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, 'lowercase letters, digits, hyphens'),
  timezone: z.string().trim().min(1).default('Asia/Dhaka'),
});
export type CreateOrganization = z.infer<typeof createOrganizationSchema>;

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).default('Asia/Dhaka'),
  address: z.string().trim().max(240).optional(),
});
export type CreateBranch = z.infer<typeof createBranchSchema>;

export const inviteMemberSchema = z.object({
  email: z.email(),
  role: roleSchema,
  // omit -> org-wide membership (all branches of the tenant)
  branchId: objectIdSchema.optional(),
});
export type InviteMember = z.infer<typeof inviteMemberSchema>;

export const createResourceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(RESOURCE_TYPES),
  capacity: z.number().int().positive().max(100).default(1),
  bookable: z.boolean().default(true),
});
export type CreateResource = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = createResourceSchema.partial();
export type UpdateResource = z.infer<typeof updateResourceSchema>;

// Sample contract used by the Phase-0 end-to-end ping (admin form -> api).
// Replaced by real domain schemas from Phase 1 onward.
export const pingRequestSchema = z.object({
  name: z.string().trim().min(1, 'required').max(80),
  note: z.string().trim().max(280).optional(),
});
export type PingRequest = z.infer<typeof pingRequestSchema>;

export const pingResponseSchema = z.object({
  pong: z.literal(true),
  correlationId: z.string(),
  greeting: z.string(),
  receivedAt: z.string(),
});
export type PingResponse = z.infer<typeof pingResponseSchema>;
