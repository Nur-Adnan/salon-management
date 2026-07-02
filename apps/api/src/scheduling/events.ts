// Domain events (reminders in Phase 10 and analytics in Phase 11 subscribe to these).
export class AppointmentCreated {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly appointmentId: string,
  ) {}
}

export class AppointmentCancelled {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly appointmentId: string,
    public readonly reason: 'cancelled' | 'no_show',
  ) {}
}

export class AppointmentCompleted {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly appointmentId: string,
  ) {}
}
