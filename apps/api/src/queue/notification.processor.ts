import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NOTIFICATION_QUEUE } from './queue.constants.js';

@Injectable()
@Processor(NOTIFICATION_QUEUE, {
  concurrency: 5,
})
export class NotificationProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.on('error', (err) => {
      this.logger.warn(`Notification worker redis error: ${err.message}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Job ${job?.id} (${job?.name}) failed after ${job?.attemptsMade} attempts: ${err.message}`,
        err.stack,
      );
    });

    this.worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} (${job.name}) completed successfully.`);
    });
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'send_notification') {
      const { notificationLogId } = job.data as { notificationLogId: string; tenantId: string };
      this.logger.log(`Dispatching notification for log ${notificationLogId} (job #${job.id})`);
      await this.notificationsService.dispatch(notificationLogId);
    } else {
      this.logger.warn(`Unknown job name on notification queue: ${job.name}`);
    }
  }
}
