import { z } from 'zod';
import {
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUS,
  COUPON_TYPE,
  LOCALES,
  PACKAGE_ITEM_KINDS,
  PAYMENT_METHODS,
  PHOTO_CONSENT_METHODS,
  PHOTO_CONSENT_SCOPES,
  PHOTO_TYPES,
  RESOURCE_TYPES,
  ROLES,
  SALE_LINE_KINDS,
} from './enums.js';

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

// --- Phase 3: Scheduling & Calendar ---

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(32),
  email: z.email().optional(),
  locale: localeSchema.optional(),
});
export type CreateCustomer = z.infer<typeof createCustomerSchema>;
export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomer = z.infer<typeof updateCustomerSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
export const workingDaySchema = z.object({
  closed: z.boolean().default(false),
  open: timeOfDay.default('09:00'),
  close: timeOfDay.default('21:00'),
});
export type WorkingDay = z.infer<typeof workingDaySchema>;

// Set a branch's booking grid + weekly hours. workingHours[0] = Sunday.
export const updateBranchScheduleSchema = z.object({
  slotMinutes: z.number().int().min(5).max(120).optional(),
  workingHours: z.array(workingDaySchema).length(7).optional(),
});
export type UpdateBranchSchedule = z.infer<typeof updateBranchScheduleSchema>;

// ISO 8601 instant (parsed to a UTC Date server-side).
const isoInstant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid datetime');
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const appointmentLineSchema = z.object({
  serviceId: objectIdSchema,
  staffId: objectIdSchema,
  resourceId: objectIdSchema.optional(),
  start: isoInstant,
});
export type AppointmentLineInput = z.infer<typeof appointmentLineSchema>;

export const createAppointmentSchema = z
  .object({
    customerId: objectIdSchema.optional(),
    customer: createCustomerSchema.optional(),
    source: z.enum(APPOINTMENT_SOURCES).default('walk_in'),
    lines: z.array(appointmentLineSchema).min(1),
    depositAmount: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((a) => Boolean(a.customerId) || Boolean(a.customer), {
    message: 'customerId or customer is required',
  });
export type CreateAppointment = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  lines: z.array(appointmentLineSchema).min(1),
});
export type RescheduleAppointment = z.infer<typeof rescheduleAppointmentSchema>;

export const appointmentTransitionSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS),
});
export type AppointmentTransition = z.infer<typeof appointmentTransitionSchema>;

export const availabilityQuerySchema = z.object({
  staffId: objectIdSchema,
  serviceId: objectIdSchema,
  date: ymd,
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const createWaitlistSchema = z
  .object({
    customerId: objectIdSchema.optional(),
    customer: createCustomerSchema.optional(),
    serviceId: objectIdSchema.optional(),
    staffId: objectIdSchema.optional(),
    desiredDate: ymd.optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((w) => Boolean(w.customerId) || Boolean(w.customer), {
    message: 'customerId or customer is required',
  });
export type CreateWaitlist = z.infer<typeof createWaitlistSchema>;

// --- Phase 4: POS & Billing ---

// A branch's VAT rate in basis points (1500 = 15%). Default 0 = not VAT-registered.
export const updateBranchTaxSchema = z.object({
  vatRateBps: z.number().int().min(0).max(10000),
});
export type UpdateBranchTax = z.infer<typeof updateBranchTaxSchema>;

// Cashier enters kind/ref/qty + optional per-line discount and staff attribution.
// unitPrice, taxable and taxRate are resolved SERVER-SIDE from the catalog — the
// client is never trusted with money.
export const saleLineInputSchema = z.object({
  kind: z.enum(SALE_LINE_KINDS),
  refId: objectIdSchema,
  quantity: z.number().int().positive().max(1000).default(1),
  discount: z.number().int().nonnegative().default(0), // minor units
  staffId: objectIdSchema.optional(),
});
export type SaleLineInputDto = z.infer<typeof saleLineInputSchema>;

export const paymentInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().int().positive(), // minor units
  providerRef: z.string().trim().max(120).optional(),
});
export type PaymentInputDto = z.infer<typeof paymentInputSchema>;

export const createSaleSchema = z.object({
  customerId: objectIdSchema.optional(), // optional: anonymous walk-in cash sale
  appointmentId: objectIdSchema.optional(),
  lines: z.array(saleLineInputSchema).min(1),
  tip: z.number().int().nonnegative().default(0),
  payments: z.array(paymentInputSchema).default([]),
  couponCode: z.string().trim().min(1).max(40).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CreateSale = z.infer<typeof createSaleSchema>;

// Add payment(s) to an existing (partially paid / due) sale.
export const addPaymentsSchema = z.object({
  payments: z.array(paymentInputSchema).min(1),
});
export type AddPayments = z.infer<typeof addPaymentsSchema>;

export const voidSaleSchema = z.object({
  reason: z.string().trim().max(240).optional(),
});
export type VoidSale = z.infer<typeof voidSaleSchema>;

// Minimal stock seed/adjust (full Inventory is Phase 7): set qty on hand for a
// product at the active branch.
export const setStockSchema = z.object({
  productId: objectIdSchema,
  qtyOnHand: z.number().int(),
});
export type SetStock = z.infer<typeof setStockSchema>;

// --- Phase 5: CRM ---

// Customer 360 additions: preferences + a persistent allergy list (distinct from
// a per-visit TreatmentRecord's notes, which are point-in-time).
export const updateCustomerProfileSchema = z.object({
  preferredStaffId: objectIdSchema.nullable().optional(),
  preferenceNotes: z.string().trim().max(500).optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
});
export type UpdateCustomerProfile = z.infer<typeof updateCustomerProfileSchema>;

export const createTreatmentRecordSchema = z.object({
  customerId: objectIdSchema,
  appointmentId: objectIdSchema.optional(),
  staffId: objectIdSchema.optional(),
  colorFormula: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional(),
  allergies: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
});
export type CreateTreatmentRecord = z.infer<typeof createTreatmentRecordSchema>;

// A photo is always born with 'pending' consent — this schema deliberately has
// no consent field, so the client can never create an already-granted photo.
export const addTreatmentPhotoSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  type: z.enum(PHOTO_TYPES),
});
export type AddTreatmentPhoto = z.infer<typeof addTreatmentPhotoSchema>;

export const treatmentPhotoConsentActionSchema = z
  .object({
    action: z.enum(['grant', 'decline', 'revoke']),
    scope: z.array(z.enum(PHOTO_CONSENT_SCOPES)).max(2).optional(),
    method: z.enum(PHOTO_CONSENT_METHODS).optional(),
  })
  .refine((v) => v.action !== 'grant' || Boolean(v.scope && v.scope.length > 0), {
    message: 'scope is required when granting consent',
  });
export type TreatmentPhotoConsentAction = z.infer<typeof treatmentPhotoConsentActionSchema>;

// Manual goodwill adjustment to a customer's loyalty points (owner/manager only).
// Positive credits, negative debits; the service still enforces balance >= 0.
export const loyaltyAdjustSchema = z.object({
  points: z.number().int().refine((n) => n !== 0, 'points must be non-zero'),
  note: z.string().trim().max(240).optional(),
});
export type LoyaltyAdjust = z.infer<typeof loyaltyAdjustSchema>;

export const issueGiftCardSchema = z.object({
  amount: z.number().int().positive(), // minor units
  customerId: objectIdSchema.optional(), // who it was issued/sold to, if known
  expiresAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date').optional(),
});
export type IssueGiftCard = z.infer<typeof issueGiftCardSchema>;

// Zod 4 disallows .partial() on a schema with .refine() attached, so the base
// object (partial-able) and the create schema (refined) are kept separate.
const couponFieldsSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, 'letters, digits, - and _ only'),
  type: z.enum(COUPON_TYPE),
  value: z.number().int().positive(), // percent: basis points (<=10000) ; fixed: minor units
  maxDiscount: z.number().int().positive().optional(), // percent-only cap, minor units
  minSpend: z.number().int().nonnegative().default(0), // minor units, pre-coupon net subtotal
  maxRedemptions: z.number().int().positive().optional(), // omit = unlimited
  activeFrom: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date').optional(),
  activeUntil: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date').optional(),
  active: z.boolean().default(true),
});
export const createCouponSchema = couponFieldsSchema.refine(
  (c) => c.type !== 'percent' || c.value <= 10000,
  { message: 'a percent coupon value is basis points and cannot exceed 10000', path: ['value'] },
);
export type CreateCoupon = z.infer<typeof createCouponSchema>;
export const updateCouponSchema = couponFieldsSchema.partial();
export type UpdateCoupon = z.infer<typeof updateCouponSchema>;

export const createReferralSchema = z
  .object({
    referrerCode: z.string().trim().min(1).max(40),
    referredCustomerId: objectIdSchema.optional(),
    referredCustomer: createCustomerSchema.optional(),
  })
  .refine((r) => Boolean(r.referredCustomerId) || Boolean(r.referredCustomer), {
    message: 'referredCustomerId or referredCustomer is required',
  });
export type CreateReferral = z.infer<typeof createReferralSchema>;

export const createSubscriptionPlanSchema = z.object({
  name: localizedNameSchema,
  price: moneySchema,
  billingPeriodDays: z.number().int().positive().max(3650),
  discountBps: z.number().int().min(0).max(10000).default(0), // perk: % off future POS purchases
  active: z.boolean().default(true),
});
export type CreateSubscriptionPlan = z.infer<typeof createSubscriptionPlanSchema>;
export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();
export type UpdateSubscriptionPlan = z.infer<typeof updateSubscriptionPlanSchema>;

export const subscribeCustomerSchema = z.object({
  customerId: objectIdSchema,
  planId: objectIdSchema,
});
export type SubscribeCustomer = z.infer<typeof subscribeCustomerSchema>;

export const renewSubscriptionSchema = z.object({
  payments: z.array(paymentInputSchema).default([]),
});
export type RenewSubscription = z.infer<typeof renewSubscriptionSchema>;

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
