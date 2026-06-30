import { InjectQueue } from '@nestjs/bullmq';
import { Body, Controller, Post, Req, UseInterceptors } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { type PingRequest, type PingResponse, pingRequestSchema } from '@salon/shared';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PingedEvent } from '../events/pinged.event.js';
import { Public } from '../iam/auth/public.decorator.js';
import { SAMPLE_QUEUE } from '../queue/queue.constants.js';

// Phase-0 end-to-end probe: validates (shared Zod) -> emits a domain event
// (audit subscribes) -> best-effort enqueue -> returns the correlation id.
@Public()
@Controller('ping')
export class PingController {
  constructor(
    private readonly eventBus: EventBus,
    @InjectQueue(SAMPLE_QUEUE) private readonly queue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext('Ping');
  }

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  async ping(
    @Body(new ZodValidationPipe(pingRequestSchema)) body: PingRequest,
    @Req() req: Request & { id?: string },
  ): Promise<PingResponse> {
    const correlationId = String(req.id ?? '');
    const tenantId = (req.headers['x-tenant-id'] as string) ?? 'public';

    this.logger.info({ tenantId, name: body.name }, 'ping received');
    this.eventBus.publish(new PingedEvent(tenantId, body.name, correlationId));

    // Ping must succeed even if Redis/queue is down; the job is best-effort.
    try {
      await this.queue.add('greet', { name: body.name, tenantId });
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'enqueue failed (redis down?)');
    }

    return {
      pong: true,
      correlationId,
      greeting: `স্বাগতম, ${body.name}! Welcome.`,
      receivedAt: new Date().toISOString(),
    };
  }
}
