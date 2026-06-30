import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './context/request-context.service.js';

// Cross-cutting singletons available everywhere (tenant context).
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class CoreModule {}
