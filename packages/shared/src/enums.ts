// Const-object "enums" (tree-shakeable, no TS enum runtime quirks).

export const LOCALES = ['en', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const ROLES = [
  'owner',
  'manager',
  'receptionist',
  'stylist',
  'accountant',
  'read_only',
] as const;
export type Role = (typeof ROLES)[number];

// Appointment status machine (Phase 3 enforces transitions; defined here as the contract).
export const APPOINTMENT_STATUS = [
  'booked',
  'confirmed',
  'checked_in',
  'in_service',
  'completed',
  'no_show',
  'cancelled',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export const RESOURCE_TYPES = ['chair', 'room', 'station'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const MEMBERSHIP_STATUS = ['invited', 'active', 'disabled'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[number];

export const PACKAGE_ITEM_KINDS = ['service', 'product'] as const;
export type PackageItemKind = (typeof PACKAGE_ITEM_KINDS)[number];

export const APPOINTMENT_SOURCES = ['online', 'walk_in', 'phone'] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export const WAITLIST_STATUS = ['waiting', 'booked', 'cancelled'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUS)[number];

// --- Phase 4: POS & Billing ---

// A sale line references a service, a product, a package, or (Phase 5) a
// subscription-plan renewal fee from the catalog.
export const SALE_LINE_KINDS = ['service', 'product', 'package', 'subscription'] as const;
export type SaleLineKind = (typeof SALE_LINE_KINDS)[number];

// 'due' = pay-later (an accounts-receivable placeholder). gift_card and loyalty
// are redeemed against a real ledger balance (Phase 5) — see pos/loyalty + gift-card.
export const PAYMENT_METHODS = [
  'cash',
  'card',
  'bkash',
  'nagad',
  'sslcommerz',
  'gift_card',
  'loyalty',
  'due',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Payment lifecycle. Sandbox adapters capture synchronously; a real redirect
// flow (Phase 14) would leave a payment 'pending' until its callback.
export const PAYMENT_STATUS = ['pending', 'captured', 'failed', 'reversed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

// Sale lifecycle. A checkout produces a 'completed' sale; 'voided' reverses it.
export const SALE_STATUS = ['completed', 'voided'] as const;
export type SaleStatus = (typeof SALE_STATUS)[number];

// --- Phase 5: CRM ---

// Every balance-affecting ledger entry is one of these. Balances are always the
// sum of their ledger (or a cache kept in lockstep in the same transaction) —
// never a value mutated directly.
export const LEDGER_ENTRY_TYPES = ['earn', 'redeem', 'issue', 'adjust', 'expire'] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const GIFT_CARD_STATUS = ['active', 'depleted', 'expired', 'cancelled'] as const;
export type GiftCardStatus = (typeof GIFT_CARD_STATUS)[number];

export const COUPON_TYPE = ['percent', 'fixed'] as const;
export type CouponType = (typeof COUPON_TYPE)[number];

export const REFERRAL_STATUS = ['pending', 'rewarded'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUS)[number];

// Staff-controlled lifecycle only. There is no auto-charge in this system (no
// payment method supports stored-card/tokenized billing yet — Phase 4's adapters
// are sandbox, call-time-only), so a subscription is never silently auto-expired
// by a job. Whether it's actually current/overdue is a DERIVED read (see
// subscriptionBillingState in pos.ts) — never a stored, job-flipped status.
export const SUBSCRIPTION_STATUS = ['active', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

// A subscription's derived billing state (computed from nextBillingDate vs now;
// never stored). grace = past due but not yet cut off; lapsed = benefits paused.
export const SUBSCRIPTION_BILLING_STATES = ['current', 'due', 'grace', 'lapsed'] as const;
export type SubscriptionBillingState = (typeof SUBSCRIPTION_BILLING_STATES)[number];

// --- Phase 5: TreatmentRecord photo consent ---

export const PHOTO_TYPES = ['before', 'after'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

// A photo is born 'pending' and NEVER created already-granted (the API enforces
// this — see createTreatmentPhotoSchema, which has no consent field at all).
export const PHOTO_CONSENT_STATUS = ['pending', 'granted', 'declined', 'revoked'] as const;
export type PhotoConsentStatus = (typeof PHOTO_CONSENT_STATUS)[number];

// What the client actually agreed the photo may be used for. 'clinical_record'
// (keep it in the treatment chart) and 'marketing' (use it in promotion) are
// deliberately separate — consenting to one never implies the other.
export const PHOTO_CONSENT_SCOPES = ['clinical_record', 'marketing'] as const;
export type PhotoConsentScope = (typeof PHOTO_CONSENT_SCOPES)[number];

export const PHOTO_CONSENT_METHODS = [
  'verbal',
  'written_form',
  'digital_signature',
  'client_portal',
] as const;
export type PhotoConsentMethod = (typeof PHOTO_CONSENT_METHODS)[number];

// CASL vocabulary, shared so the frontend can reason about permissions too.
export const ACTIONS = ['manage', 'create', 'read', 'update', 'delete', 'invite'] as const;
export type Action = (typeof ACTIONS)[number];

export const SUBJECTS = [
  'Organization',
  'Branch',
  'User',
  'Membership',
  'Resource',
  'Catalog',
  'Customer',
  'Appointment',
  'Sale',
  'Treatment',
  'Loyalty',
  'GiftCard',
  'Coupon',
  'Subscription',
  'all',
] as const;
export type Subject = (typeof SUBJECTS)[number];
