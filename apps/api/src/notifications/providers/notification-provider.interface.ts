import type { NotificationChannel } from '@salon/shared';

export interface NotificationPayload {
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderSendResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface INotificationProvider {
  readonly channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<ProviderSendResult>;
}
