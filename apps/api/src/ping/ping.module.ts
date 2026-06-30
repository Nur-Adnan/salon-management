import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor.js';
import { PingController } from './ping.controller.js';

@Module({
  imports: [CqrsModule],
  controllers: [PingController],
  providers: [IdempotencyInterceptor],
})
export class PingModule {}
