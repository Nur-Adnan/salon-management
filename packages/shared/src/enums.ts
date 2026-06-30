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
