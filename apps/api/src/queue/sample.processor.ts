import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SAMPLE_QUEUE } from './queue.constants';

// Proves the BullMQ wiring end-to-end. Real processors (reminders, campaigns,
// reports, image processing) arrive in later phases.
@Processor(SAMPLE_QUEUE)
export class SampleProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(SampleProcessor.name);

  // @nestjs/bullmq creates the worker AFTER onModuleInit, so attach here. Without
  // a listener a post-boot Redis blip emits an unhandled 'error' and crashes the process.
  onApplicationBootstrap(): void {
    this.worker.on('error', (err) => this.logger.warn(`worker redis error: ${err.message}`));
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`processed job "${job.name}" #${job.id}`);
  }
}
