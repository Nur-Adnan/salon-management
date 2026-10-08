import { describe, expect, it } from 'vitest';
import {
  calculateReminderDelays,
  normalizeContact,
  renderNotificationTemplate,
} from './notifications.js';

describe('notifications pure helpers', () => {
  describe('normalizeContact', () => {
    it('normalizes valid emails to lowercase', () => {
      const res = normalizeContact('  John.Doe@Example.COM  ');
      expect(res.isValid).toBe(true);
      expect(res.type).toBe('email');
      expect(res.normalized).toBe('john.doe@example.com');
    });

    it('rejects invalid emails', () => {
      const res = normalizeContact('not-an-email@');
      expect(res.isValid).toBe(false);
      expect(res.type).toBe('email');
    });

    it('normalizes BD 11-digit local mobile numbers', () => {
      const res = normalizeContact('01712345678');
      expect(res.isValid).toBe(true);
      expect(res.type).toBe('phone');
      expect(res.normalized).toBe('+8801712345678');
    });

    it('normalizes international BD format numbers', () => {
      const res = normalizeContact('+880 181 999 0000');
      expect(res.isValid).toBe(true);
      expect(res.type).toBe('phone');
      expect(res.normalized).toBe('+8801819990000');
    });
  });

  describe('calculateReminderDelays', () => {
    it('calculates 24h and 2h delays for future appointment', () => {
      const now = new Date('2026-10-10T10:00:00Z');
      const start = new Date('2026-10-12T10:00:00Z'); // 48h in future

      const { send24hDelayMs, send2hDelayMs } = calculateReminderDelays(start, now);
      expect(send24hDelayMs).toBe(24 * 60 * 60 * 1000);
      expect(send2hDelayMs).toBe(46 * 60 * 60 * 1000);
    });

    it('skips 24h reminder if appointment is less than 24h away but schedules 2h', () => {
      const now = new Date('2026-10-10T10:00:00Z');
      const start = new Date('2026-10-10T20:00:00Z'); // 10h in future

      const { send24hDelayMs, send2hDelayMs } = calculateReminderDelays(start, now);
      expect(send24hDelayMs).toBeNull();
      expect(send2hDelayMs).toBe(8 * 60 * 60 * 1000);
    });

    it('skips both if appointment is less than 2h away', () => {
      const now = new Date('2026-10-10T10:00:00Z');
      const start = new Date('2026-10-10T11:00:00Z'); // 1h in future

      const { send24hDelayMs, send2hDelayMs } = calculateReminderDelays(start, now);
      expect(send24hDelayMs).toBeNull();
      expect(send2hDelayMs).toBeNull();
    });
  });

  describe('renderNotificationTemplate', () => {
    it('renders 24h appointment reminder for SMS and Email', () => {
      const sms = renderNotificationTemplate('appointment_reminder_24h', 'sms', {
        customerName: 'Samira',
        serviceNames: ['Haircut', 'Blowdry'],
        startTimeFormatted: 'Tomorrow at 3:00 PM',
        branchName: 'Dhanmondi Branch',
      });
      expect(sms.body).toContain('Hi Samira');
      expect(sms.body).toContain('Haircut, Blowdry');

      const email = renderNotificationTemplate('appointment_reminder_24h', 'email', {
        customerName: 'Samira',
        serviceNames: ['Haircut'],
        startTimeFormatted: 'Tomorrow at 3:00 PM',
        branchName: 'Dhanmondi Branch',
        cancelUrl: 'https://salon.test/cancel/123',
      });
      expect(email.subject).toContain('Reminder: Your appointment tomorrow');
      expect(email.body).toContain('https://salon.test/cancel/123');
    });

    it('renders subscription upcoming renewal notification', () => {
      const res = renderNotificationTemplate('subscription_renewal_upcoming', 'email', {
        customerName: 'Rahim',
        planName: 'VIP Monthly',
        renewalDateFormatted: 'Nov 1, 2026',
        amountFormatted: '৳2,500',
      });
      expect(res.subject).toContain('Upcoming Subscription Renewal');
      expect(res.body).toContain('৳2,500');
    });

    it('renders gift card expiry warning', () => {
      const res = renderNotificationTemplate('gift_card_expiry_warning', 'sms', {
        customerName: 'Karim',
        code: 'GIFT-2026',
        balanceFormatted: '৳1,000',
        expiryDateFormatted: 'Oct 31, 2026',
      });
      expect(res.body).toContain('GIFT-2026');
      expect(res.body).toContain('৳1,000');
    });
  });
});
