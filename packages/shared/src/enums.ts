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
  'all',
] as const;
export type Subject = (typeof SUBJECTS)[number];
