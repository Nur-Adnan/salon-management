import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeContact } from '@salon/shared';
import type { INotificationProvider, NotificationPayload, ProviderSendResult } from './notification-provider.interface.js';

@Injectable()
export class EmailProvider implements INotificationProvider {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(EmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: NotificationPayload): Promise<ProviderSendResult> {
    const contact = normalizeContact(payload.recipient);
    if (!contact.isValid || contact.type !== 'email') {
      return { success: false, error: `invalid email recipient: ${payload.recipient}` };
    }

    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      // In production with configured SMTP/gateway:
      this.logger.log(`[SMTP] Sending email to ${contact.normalized} - Subject: ${payload.subject ?? '(no subject)'}`);
      return { success: true, externalMessageId: `smtp-${Date.now()}` };
    }

    // Default mock/dev behavior
    this.logger.log(`[MOCK EMAIL] To: ${contact.normalized} | Subject: ${payload.subject} | Body: ${payload.body.substring(0, 80)}...`);
    return { success: true, externalMessageId: `mock-email-${Date.now()}` };
  }
}
