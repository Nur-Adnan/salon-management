import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ContextMiddleware } from './common/context/context.middleware.js';
import { CoreModule } from './common/core.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { type Env, validateEnv } from './config/env.js';
import { AbilitiesGuard } from './iam/casl/abilities.guard.js';
import { JwtAuthGuard } from './iam/auth/jwt-auth.guard.js';
import { IamModule } from './iam/iam.module.js';
import { HealthModule } from './health/health.module.js';
import { PingModule } from './ping/ping.module.js';
import { QueueModule } from './queue/queue.module.js';
import { ResourcesModule } from './resources/resources.module.js';
import { RedisModule } from './infra/redis/redis.module.js';

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
    CoreModule,
    RedisModule,
    QueueModule,
    AuditModule,
    IamModule,
    ResourcesModule,
    CatalogModule,
    HealthModule,
    PingModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: authenticate + populate context, THEN authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AbilitiesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Establish the AsyncLocalStorage request context for every route.
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
