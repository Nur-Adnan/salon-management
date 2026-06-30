import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { type Env, validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { PingModule } from './ping/ping.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './infra/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Root .env (monorepo) overrides the localhost defaults baked into the schema.
      envFilePath: ['../../.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Correlation id: honor an inbound x-correlation-id, else mint one; echo it back.
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const id = (req.headers['x-correlation-id'] as string) || randomUUID();
          res.setHeader('x-correlation-id', id);
          return id;
        },
        // Tenant on every log line (real tenant resolution lands in Phase 1).
        customProps: (req: IncomingMessage) => ({
          tenantId: (req.headers['x-tenant-id'] as string) ?? 'public',
        }),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    CqrsModule,
    RedisModule,
    QueueModule,
    AuditModule,
    HealthModule,
    PingModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
