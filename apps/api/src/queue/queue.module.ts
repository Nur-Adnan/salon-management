import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Global, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { SAMPLE_QUEUE, redisConnectionFromUrl } from './queue.constants.js';
import { SampleProcessor } from './sample.processor.js';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionFromUrl(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        ),
      }),
    }),
    BullModule.registerQueue({ name: SAMPLE_QUEUE }),
  ],
  providers: [SampleProcessor],
  exports: [BullModule],
})
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger('Queue');

  constructor(@InjectQueue(SAMPLE_QUEUE) private readonly queue: Queue) {}

  onModuleInit(): void {
    // Same reason as the worker: keep a Redis outage from crashing the producer.
    this.queue.on('error', (err) => this.logger.warn(`queue redis error: ${err.message}`));
  }
}
