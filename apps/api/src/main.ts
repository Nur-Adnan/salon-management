import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());

  const config = app.get(ConfigService<Env, true>);
  const origins = config
    .get('WEB_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.enableShutdownHooks();

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`API listening on http://localhost:${port}`);
}

void bootstrap();
