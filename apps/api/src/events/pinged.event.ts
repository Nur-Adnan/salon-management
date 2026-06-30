// Sample domain event. Real modules (Phase 1+) emit their own; audit/notifications
// subscribe to events instead of being called directly (keeps modules decoupled).
export class PingedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly name: string,
    public readonly correlationId: string,
  ) {}
}
