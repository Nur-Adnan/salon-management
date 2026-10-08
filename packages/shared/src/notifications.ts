import type { NotificationChannel, NotificationTemplate } from './enums.js';

export interface NormalizedContact {
  raw: string;
  normalized: string;
  isValid: boolean;
  type: 'phone' | 'email' | 'unknown';
}

/**
 * Normalizes phone numbers (handles BD prefix +880 or local 01XXXXXXXXX) and emails.
 */
export function normalizeContact(input: string): NormalizedContact {
  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    return {
      raw: trimmed,
      normalized: trimmed.toLowerCase(),
      isValid,
      type: 'email',
    };
  }

  // Strip spaces, dashes, parentheses
  const digitsOnly = trimmed.replace(/[\s\-()]/g, '');
  // Match Bangladeshi numbers or E.164
  let normalized = digitsOnly;
  if (digitsOnly.startsWith('+880')) {
    normalized = digitsOnly;
  } else if (digitsOnly.startsWith('880')) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith('01') && digitsOnly.length === 11) {
    normalized = `+88${digitsOnly}`;
  }

  const isValid = /^\+?[1-9]\d{7,14}$/.test(normalized);
  return {
    raw: trimmed,
    normalized,
    isValid,
    type: 'phone',
  };
}

/**
 * Calculates milliseconds of delay before sending reminders (24h before, 2h before).
 * Returns null if the target time has already elapsed.
 */
export function calculateReminderDelays(
  appointmentStart: Date,
  now: Date = new Date(),
): { send24hDelayMs: number | null; send2hDelayMs: number | null } {
  const startMs = appointmentStart.getTime();
  const nowMs = now.getTime();

  const ms24h = 24 * 60 * 60 * 1000;
  const ms2h = 2 * 60 * 60 * 1000;

  const target24h = startMs - ms24h;
  const target2h = startMs - ms2h;

  const send24hDelayMs = target24h > nowMs ? target24h - nowMs : null;
  const send2hDelayMs = target2h > nowMs ? target2h - nowMs : null;

  return { send24hDelayMs, send2hDelayMs };
}

export interface AppointmentNotificationData {
  customerName: string;
  serviceNames: string[];
  startTimeFormatted: string;
  branchName: string;
  address?: string;
  cancelUrl?: string;
}

export interface SubscriptionNotificationData {
  customerName: string;
  planName: string;
  renewalDateFormatted: string;
  amountFormatted: string;
}

export interface GiftCardNotificationData {
  customerName: string;
  code: string;
  balanceFormatted: string;
  expiryDateFormatted: string;
}

export interface CampaignBroadcastData {
  subject?: string;
  message?: string;
  body?: string;
  [key: string]: unknown;
}

export type NotificationPayloadData =
  | AppointmentNotificationData
  | SubscriptionNotificationData
  | GiftCardNotificationData
  | CampaignBroadcastData
  | Record<string, unknown>;

/**
 * Pure template renderers for standard notifications across channels.
 */
export function renderNotificationTemplate(
  template: NotificationTemplate,
  channel: NotificationChannel,
  data: NotificationPayloadData,
): { subject?: string; body: string } {
  switch (template) {
    case 'appointment_reminder_24h': {
      const d = data as AppointmentNotificationData;
      const services = d.serviceNames.join(', ');
      if (channel === 'email') {
        return {
          subject: `Reminder: Your appointment tomorrow at ${d.branchName}`,
          body: `Hello ${d.customerName},\n\nThis is a friendly reminder for your upcoming appointment tomorrow at ${d.startTimeFormatted} for ${services} at ${d.branchName}.\n\nIf you need to reschedule or cancel, please visit: ${d.cancelUrl ?? '#'}\n\nSee you soon!`,
        };
      }
      return {
        body: `Reminder: Hi ${d.customerName}, your salon appointment is tomorrow at ${d.startTimeFormatted} (${services}) at ${d.branchName}. ${d.cancelUrl ? `Manage: ${d.cancelUrl}` : ''}`.trim(),
      };
    }

    case 'appointment_reminder_2h': {
      const d = data as AppointmentNotificationData;
      const services = d.serviceNames.join(', ');
      if (channel === 'email') {
        return {
          subject: `Reminder: Your appointment in 2 hours at ${d.branchName}`,
          body: `Hello ${d.customerName},\n\nYour appointment is coming up in 2 hours at ${d.startTimeFormatted} for ${services} at ${d.branchName}.\n\nAddress: ${d.address ?? 'Our salon'}\n\nSee you shortly!`,
        };
      }
      return {
        body: `Reminder: Hi ${d.customerName}, your appointment at ${d.branchName} starts in 2 hours at ${d.startTimeFormatted}. We look forward to seeing you!`,
      };
    }

    case 'appointment_confirmation': {
      const d = data as AppointmentNotificationData;
      const services = d.serviceNames.join(', ');
      return {
        subject: `Appointment Confirmed: ${d.branchName}`,
        body: `Hi ${d.customerName}, your appointment for ${services} is confirmed for ${d.startTimeFormatted} at ${d.branchName}.`,
      };
    }

    case 'appointment_rescheduled': {
      const d = data as AppointmentNotificationData;
      const services = d.serviceNames.join(', ');
      return {
        subject: `Appointment Rescheduled: ${d.branchName}`,
        body: `Hi ${d.customerName}, your appointment for ${services} has been rescheduled to ${d.startTimeFormatted} at ${d.branchName}.`,
      };
    }

    case 'appointment_cancelled': {
      const d = data as AppointmentNotificationData;
      return {
        subject: `Appointment Cancelled: ${d.branchName}`,
        body: `Hi ${d.customerName}, your appointment at ${d.branchName} has been cancelled. If this was a mistake, you can book again anytime.`,
      };
    }

    case 'subscription_renewal_upcoming': {
      const d = data as SubscriptionNotificationData;
      return {
        subject: `Upcoming Subscription Renewal: ${d.planName}`,
        body: `Hi ${d.customerName}, your ${d.planName} subscription will renew on ${d.renewalDateFormatted} for ${d.amountFormatted}.`,
      };
    }

    case 'subscription_renewed': {
      const d = data as SubscriptionNotificationData;
      return {
        subject: `Subscription Renewed: ${d.planName}`,
        body: `Hi ${d.customerName}, your ${d.planName} subscription renewal succeeded on ${d.renewalDateFormatted || 'today'}.`,
      };
    }

    case 'subscription_renewal_failed': {
      const d = data as SubscriptionNotificationData;
      return {
        subject: `Action Required: Subscription Renewal Failed`,
        body: `Hi ${d.customerName}, we could not process the renewal for your ${d.planName} plan (${d.amountFormatted}). Please update your billing details to maintain your benefits.`,
      };
    }

    case 'subscription_payment_failed': {
      const d = data as SubscriptionNotificationData;
      return {
        subject: `Action Required: Subscription Payment Failed`,
        body: `Hi ${d.customerName}, we could not process the payment for your ${d.planName} plan. Please update your billing details.`,
      };
    }

    case 'subscription_expired':
    case 'subscription_cancelled_payment_failure': {
      const d = data as SubscriptionNotificationData;
      return {
        subject: `Subscription Expired: ${d.planName}`,
        body: `Hi ${d.customerName}, your subscription for ${d.planName} has ended. Reactivate anytime to continue enjoying your perks.`,
      };
    }

    case 'gift_card_expiry_warning': {
      const d = data as GiftCardNotificationData;
      return {
        subject: `Your Gift Card Expires Soon`,
        body: `Hi ${d.customerName}, your gift card (${d.code}) with remaining balance ${d.balanceFormatted} will expire on ${d.expiryDateFormatted}. Don't forget to treat yourself!`,
      };
    }

    case 'campaign_broadcast':
    default: {
      const d = data as CampaignBroadcastData;
      return {
        subject: String(d.subject ?? 'Special Offer from Salon'),
        body: String(d.message ?? d.body ?? ''),
      };
    }
  }
}
