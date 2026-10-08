import {
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { NotificationChannel } from '@salon/shared';
import { CheckAbility } from '../iam/casl/check-ability.decorator.js';
import { LifecycleScannerService } from './lifecycle-scanner.service.js';
import { NotificationsService } from './notifications.service.js';
import type { NotificationLogDocument } from './schemas/notification-log.schema.js';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly scanner: LifecycleScannerService,
  ) {}

  @Get('logs')
  @CheckAbility('read', 'Notification')
  async listLogs(
    @Query('channel') channel?: NotificationChannel,
    @Query('status') status?: string,
    @Query('recipient') recipient?: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationLogDocument[]> {
    return this.notifications.list({
      channel,
      status,
      recipient,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('logs/:id/resend')
  @CheckAbility('update', 'Notification')
  async resend(@Param('id') id: string): Promise<NotificationLogDocument> {
    return this.notifications.resend(id);
  }

  @Post('scan')
  @CheckAbility('manage', 'Notification')
  async runLifecycleScan(): Promise<{
    subscriptionsQueued: number;
    giftCardsWarned: number;
    giftCardsExpired: number;
  }> {
    const subscriptionsQueued = await this.scanner.scanSubscriptionRenewals();
    const { warned, expired } = await this.scanner.scanGiftCardExpirations();
    return {
      subscriptionsQueued,
      giftCardsWarned: warned,
      giftCardsExpired: expired,
    };
  }
}
