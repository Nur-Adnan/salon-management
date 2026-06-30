import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PingedAuditHandler } from './pinged-audit.handler';

@Module({
  imports: [CqrsModule],
  providers: [PingedAuditHandler],
})
export class AuditModule {}
