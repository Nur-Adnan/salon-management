// POS domain events. Inventory (Phase 7) will consume SaleCompleted for stock
// movements/reorder alerts; commission (Phase 6) for CommissionEntry; analytics
// (Phase 11) for revenue rollups. Stock is decremented IN the checkout transaction
// (atomic per the acceptance), so these events are for downstream, not for the
// primary decrement.
export class SaleCompleted {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly saleId: string,
  ) {}
}

export class SaleVoided {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string,
    public readonly saleId: string,
  ) {}
}
