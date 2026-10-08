import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CampaignsService } from '../marketing/campaigns.service.js';
import { CAMPAIGN_QUEUE } from './queue.constants.js';

@Injectable()
@Processor(CAMPAIGN_QUEUE, {
  concurrency: 2,
})
export class CampaignProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(private readonly campaignsService: CampaignsService) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.on('error', (err) => {
      this.logger.warn(`Campaign worker redis error: ${err.message}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Campaign job ${job?.id} failed: ${err.message}`, err.stack);
    });
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'execute_campaign') {
      const { campaignId, tenantId } = job.data as { campaignId: string; tenantId: string };
      this.logger.log(`Executing campaign ${campaignId} (job #${job.id})`);
      await this.campaignsService.execute(campaignId, tenantId);
    } else {
      this.logger.warn(`Unknown job name on campaign queue: ${job.name}`);
    }
  }
}
