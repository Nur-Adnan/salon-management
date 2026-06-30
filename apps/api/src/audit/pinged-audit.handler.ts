import { Logger } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { PingedEvent } from '../events/pinged.event';

// Demonstrates the audit pattern: every state-changing command emits an event,
// the audit module consumes it. Phase 1 replaces the log with an immutable Mongo write.
@EventsHandler(PingedEvent)
export class PingedAuditHandler implements IEventHandler<PingedEvent> {
  private readonly logger = new Logger('Audit');

  handle(event: PingedEvent): void {
    this.logger.log(
      `AUDIT tenant=${event.tenantId} action=ping name=${event.name} cid=${event.correlationId}`,
    );
  }
}
