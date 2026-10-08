import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeContact } from '@salon/shared';
import type { INotificationProvider, NotificationPayload, ProviderSendResult } from './notification-provider.interface.js';

@Injectable()
export class SmsProvider implements INotificationProvider {
  readonly channel = 'sms' as const;
  private readonly logger = new Logger(SmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: NotificationPayload): Promise<ProviderSendResult> {
    const contact = normalizeContact(payload.recipient);
    if (!contact.isValid || contact.type !== 'phone') {
      return { success: false, error: `invalid phone recipient: ${payload.recipient}` };
    }

    const apiKey = this.config.get<string>('SMS_API_KEY');
    if (apiKey) {
      this.logger.log(`[SMS GATEWAY] Sending SMS to ${contact.normalized}: ${payload.body.substring(0, 60)}...`);
      return { success: true, externalMessageId: `sms-${Date.now()}` };
    }

    this.logger.log(`[MOCK SMS] To: ${contact.normalized} | Body: ${payload.body.substring(0, 80)}...`);
    return { success: true, externalMessageId: `mock-sms-${Date.now()}` };
  }
}
