import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { type Redis } from 'ioredis';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('Redis');
        const client = new IORedis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });
        // Swallow connection errors so a down Redis does not crash boot; /health reports it.
        client.on('error', (err) => logger.warn(`redis error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly client: Redis) {}

  // Close the socket so the process can exit cleanly (ioredis keeps the loop alive).
  async onApplicationShutdown(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
