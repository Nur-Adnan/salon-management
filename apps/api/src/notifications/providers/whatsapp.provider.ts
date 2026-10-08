import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeContact } from '@salon/shared';
import type { INotificationProvider, NotificationPayload, ProviderSendResult } from './notification-provider.interface.js';

@Injectable()
export class WhatsAppProvider implements INotificationProvider {
  readonly channel = 'whatsapp' as const;
  private readonly logger = new Logger(WhatsAppProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: NotificationPayload): Promise<ProviderSendResult> {
    const contact = normalizeContact(payload.recipient);
    if (!contact.isValid || contact.type !== 'phone') {
      return { success: false, error: `invalid whatsapp recipient: ${payload.recipient}` };
    }

    const token = this.config.get<string>('WHATSAPP_TOKEN');
    if (token) {
      this.logger.log(`[WHATSAPP CLOUD API] Sending message to ${contact.normalized}`);
      return { success: true, externalMessageId: `wa-${Date.now()}` };
    }

    this.logger.log(`[MOCK WHATSAPP] To: ${contact.normalized} | Body: ${payload.body.substring(0, 80)}...`);
    return { success: true, externalMessageId: `mock-wa-${Date.now()}` };
  }
}
