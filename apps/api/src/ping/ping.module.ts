import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { PingController } from './ping.controller';

@Module({
  imports: [CqrsModule],
  controllers: [PingController],
  providers: [IdempotencyInterceptor],
})
export class PingModule {}
