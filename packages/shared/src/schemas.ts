import { z } from 'zod';
import { LOCALES, PACKAGE_ITEM_KINDS, RESOURCE_TYPES, ROLES } from './enums.js';

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

// --- Phase 2: Service & Product Catalog ---

// Bilingual display name (English required, Bangla optional).
export const localizedNameSchema = z.object({
  en: z.string().trim().min(1).max(120),
  bn: z.string().trim().max(120).optional(),
});
export type LocalizedName = z.infer<typeof localizedNameSchema>;

// Money as integer minor units (poisha). Catalog prices are tax-EXCLUSIVE.
export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal('BDT').default('BDT'),
});
export type MoneyInput = z.infer<typeof moneySchema>;

export const createServiceCategorySchema = z.object({
  name: localizedNameSchema,
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateServiceCategory = z.infer<typeof createServiceCategorySchema>;
export const updateServiceCategorySchema = createServiceCategorySchema.partial();
export type UpdateServiceCategory = z.infer<typeof updateServiceCategorySchema>;

export const createServiceSchema = z.object({
  categoryId: objectIdSchema.optional(),
  name: localizedNameSchema,
  durationMin: z.number().int().positive().max(1440),
  bufferBeforeMin: z.number().int().min(0).max(240).default(0),
  bufferAfterMin: z.number().int().min(0).max(240).default(0),
  price: moneySchema,
  taxable: z.boolean().default(true),
  eligibleResourceTypes: z.array(z.enum(RESOURCE_TYPES)).default([]),
  active: z.boolean().default(true),
});
export type CreateService = z.infer<typeof createServiceSchema>;
export const updateServiceSchema = createServiceSchema.partial();
export type UpdateService = z.infer<typeof updateServiceSchema>;

export const createProductCategorySchema = z.object({
  name: localizedNameSchema,
});
export type CreateProductCategory = z.infer<typeof createProductCategorySchema>;
export const updateProductCategorySchema = createProductCategorySchema.partial();
export type UpdateProductCategory = z.infer<typeof updateProductCategorySchema>;

export const createProductSchema = z.object({
  categoryId: objectIdSchema.optional(),
  name: localizedNameSchema,
  sku: z.string().trim().min(1).max(60),
  barcode: z.string().trim().min(1).max(60).optional(),
  retailPrice: moneySchema,
  cost: moneySchema,
  taxable: z.boolean().default(true),
  expiryTracked: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type CreateProduct = z.infer<typeof createProductSchema>;
export const updateProductSchema = createProductSchema.partial();
export type UpdateProduct = z.infer<typeof updateProductSchema>;

export const packageItemSchema = z.object({
  kind: z.enum(PACKAGE_ITEM_KINDS),
  refId: objectIdSchema,
  quantity: z.number().int().positive().max(100).default(1),
});
export type PackageItem = z.infer<typeof packageItemSchema>;

export const createPackageSchema = z.object({
  name: localizedNameSchema,
  items: z.array(packageItemSchema).min(1),
  price: moneySchema,
  validityDays: z.number().int().positive().max(3650).default(90),
  active: z.boolean().default(true),
});
export type CreatePackage = z.infer<typeof createPackageSchema>;
export const updatePackageSchema = createPackageSchema.partial();
export type UpdatePackage = z.infer<typeof updatePackageSchema>;

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
