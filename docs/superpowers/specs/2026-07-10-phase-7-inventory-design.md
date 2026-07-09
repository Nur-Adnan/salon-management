# Phase 7 — Inventory & Suppliers (design spec)

Status: approved design, pre-implementation.
Supersedes the minimal `StockLevel` seam introduced in Phase 4.

## Goal

Turn the placeholder per-branch stock counter into a real, auditable inventory
module: know *why* every stock number is what it is, replenish it from suppliers
via purchase orders, correct it with reasoned manual adjustments, and surface
what needs reordering — without loosening any guarantee POS already relies on.

## Non-goals (explicit deferrals)

- **Batches / lots + expiry / FEFO** consumption. `Product.expiryTracked`
  already exists (unused); wiring it is a later phase.
- **Inter-branch stock transfers.**
- **Weighted-average cost / COGS valuation.** Receiving records `unitCost` but
  does not mutate `Product.cost`.
- **Partial / multi-shipment PO receipts.** v1 receives a PO in one shot.
- **Supplier price lists / catalogs.**

Each is additive later, not a rebuild.

## Core principle: `qtyOnHand` is a cache over an append-only `StockMovement` ledger

Identical to how `LoyaltyAccount.balance` is a cache over `LoyaltyLedgerEntry`
(see `crm/ledger.util.ts`). Every stock change — PO receipt, manual adjustment,
**and the existing POS sale/void** — goes through ONE helper that, inside a
single transaction:

1. atomically `findOneAndUpdate`s the `StockLevel` (`$inc qtyOnHand`; decrements
   are guarded `qtyOnHand: { $gte: qty }` in the filter — never negative), and
2. appends one immutable `StockMovement`.

`qtyOnHand` and the movement ledger therefore can never diverge, and the ledger
fully reconciles to the cache: `qtyOnHand == Σ qtyDelta` for a (branch, product).

### Consequence: POS retrofit (additive to the hardening pass)

`SalesService.checkout` (decrement) and `voidSale` (restore) must call the same
helper so their stock changes appear in the ledger with reason `sale` / `void`.
This is additive — the guarded decrement already exists from the phase-0..6
hardening pass — and is re-verified by the live harness (ledger reconciliation +
the existing 8-way stock/void concurrency checks).

## Data model

New collections (all `{ tenantId }`-scoped, soft-deletable where mutable):

### `Supplier` (`suppliers`)
`{ tenantId, name, contact: { phone?, email? }, address?, note?, active, deletedAt }`
- Unique `{ tenantId, name }` partial on `deletedAt: null` (soft-deleted names reusable), same pattern as catalog SKU.

### `StockMovement` (`stock_movements`) — append-only, never updated/deleted
`{ tenantId, branchId, productId, qtyDelta (signed int), reason, refType, refId, note?, createdAt }`
- `reason ∈ { 'sale', 'void', 'purchase', 'adjustment' }`.
- `refType ∈ { 'sale', 'purchase_order', 'adjustment' }` + `refId` links to the originating doc.
- Indexes: `{ tenantId, branchId, productId, createdAt: -1 }` (per-product history);
  `{ tenantId, refType, refId }` (trace all movements from one PO/sale).
- Idempotency: unique `{ tenantId, refType, refId, productId, reason }` partial
  index (defense-in-depth against a duplicate movement; a caught duplicate-key
  no-op, same technique as the HR reversal entries). **This requires exactly one
  movement per (operation, product)** — so any operation whose source has the
  same product more than once (a PO with two lines of the same product, a sale
  with two lines of the same product) MUST aggregate its delta by product before
  emitting movements. Checkout already does this (`productQtys` map); PO receipt
  does the same (see below).

### `PurchaseOrder` (`purchase_orders`)
`{ tenantId, branchId, supplierId, status, lines: [{ productId, quantity, unitCost: MoneyEmbed }], totalCost: MoneyEmbed, note?, createdByUserId, receivedAt, deletedAt }`
- `status ∈ { 'draft', 'received', 'cancelled' }`. Immutable once `received`
  (no update path; mirrors `Payslip`).
- `totalCost` = Σ(unitCost × quantity), integer minor units, computed server-side.
- Per-tenant sequential PO number (reuse the `Counter` pattern from invoices),
  key `${tenantId}:po`, format `PO-000001`.

### `StockAdjustment` (`stock_adjustments`)
`{ tenantId, branchId, productId, qtyDelta (signed int), reason, note?, createdByUserId, createdAt }`
- `reason ∈ { 'recount', 'wastage', 'damage', 'correction' }`.
- Writing an adjustment performs the atomic stock change + movement (reason `adjustment`).
- A negative adjustment is still guarded `qtyOnHand >= |qtyDelta|` (can't drive stock negative).

### `StockLevel` (existing) — add one field
`reorderPoint: number` (default 0). Low-stock predicate: `reorderPoint > 0 && qtyOnHand <= reorderPoint`.

## The stock-mutation helper (single source of truth)

A plain function (not a Nest provider), in `pos/stock.util.ts` (or
`inventory/stock.util.ts`), callable from POS, Inventory, and PO services
without a circular import — the same convention as `crm/ledger.util.ts` and
`hr/ledger.util.ts`:

```
applyStockDelta(models, { tenantId, branchId, productId, qtyDelta, reason, refType, refId, note }, session)
  // qtyDelta < 0: findOneAndUpdate({..., qtyOnHand: { $gte: -qtyDelta }}, { $inc: { qtyOnHand: qtyDelta } })
  //   -> if no match AND a row exists -> throw insufficient-stock (409)
  //   -> if no match AND no row       -> untracked product, no-op (preserves POS behavior)
  // qtyDelta > 0: findOneAndUpdate(key, { $inc: { qtyOnHand: qtyDelta } }, { upsert: true })
  // then append StockMovement (guarded by the idempotency unique index for POS refs)
```

The existing checkout/void inline decrement is replaced by calls to this helper,
generalizing the guard the hardening pass added.

## Workflows

### Purchase order
- **Create draft** (`POST /purchase-orders`): supplier + lines (each `productId`,
  `quantity`, `unitCost`); products validated against the tenant catalog; totals
  computed server-side; status `draft`.
- **Receive** (`POST /purchase-orders/:id/receive`): one transaction —
  `findOneAndUpdate({ _id, tenantId, status: 'draft' } -> { status: 'received', receivedAt })`
  (one-time guarded flip, so concurrent/duplicate receives → exactly one wins,
  like the void/payroll claim); then, **aggregating lines by product**, one
  `applyStockDelta(+Σqty, reason 'purchase', refType 'purchase_order', refId=poId)`
  per distinct product (one movement per product, keeping the movement
  idempotency index valid).
- **Cancel** (`POST /purchase-orders/:id/cancel`): only a `draft` → `cancelled`
  (guarded flip). A received PO cannot be cancelled (stock already moved).

### Manual adjustment
- `POST /inventory/adjustments`: create the adjustment doc + `applyStockDelta`
  (reason `adjustment`) in one transaction.

### Reorder / low-stock
- `PUT /inventory/reorder`: set `reorderPoint` for a (branch, product).
- `GET /inventory/low-stock`: rows where `reorderPoint > 0 && qtyOnHand <= reorderPoint`.

## Authorization — 2 new CASL subjects

Add `'Inventory'` and `'Supplier'` to `SUBJECTS`.

| Role | Inventory | Supplier (incl. PurchaseOrder) |
|------|-----------|--------------------------------|
| owner | manage (via `manage('all')`) | manage |
| manager | manage | manage |
| receptionist | read | — |
| stylist | read | — |
| accountant | read (via `read('all')`) | read |
| read_only | read (via `read('all')`) | read |

- Purchase-order routes are gated by the `Supplier` subject (procurement domain).
- Migrate the existing `/inventory/stock` endpoints from `Catalog` to `Inventory`.
- `read('all')` never grants write (write routes require create/update/manage),
  consistent with the Phase 6 authz rule.

## Module boundaries

- New `InventoryModule` (stock levels, movements, adjustments, reorder) and
  `SuppliersModule` (suppliers + purchase orders). PO receiving needs the stock
  helper + `StockLevel`/`StockMovement` models, registered directly (schema-level
  sharing, no service cross-import), same one-directional convention as CRM/HR.
- `PosModule` re-registers `StockMovement` (for the sale/void movements) exactly
  as it already re-registers CRM/HR schemas for its synchronous reversals.

## API surface

```
/suppliers            GET list, POST create, PATCH :id, DELETE :id      (Supplier)
/purchase-orders      GET list, POST create(draft),
                      POST :id/receive, POST :id/cancel, GET :id        (Supplier)
/inventory/stock      GET list, PUT set (existing, re-subject Inventory) (Inventory)
/inventory/adjustments POST create, GET list                           (Inventory)
/inventory/movements  GET list (audit, filter by product)               (Inventory)
/inventory/reorder    PUT set reorderPoint                              (Inventory)
/inventory/low-stock  GET report                                        (Inventory)
```

Admin UI (minimal, matching existing pages): Suppliers, Purchase Orders (draft +
receive), Inventory (stock + adjust + reorder + low-stock). Booking app
unaffected. Frontend verified by `next build` (full authenticated click-through
needs a real Supabase project — same documented limitation as Phases 3–6).

## Shared contract (`packages/shared`)

- Enums: `STOCK_MOVEMENT_REASONS`, `PURCHASE_ORDER_STATUS`, `STOCK_ADJUSTMENT_REASONS`.
- Zod DTOs: `createSupplierSchema`, `updateSupplierSchema`, `createPurchaseOrderSchema`
  (lines with positive int qty + nonnegative int unitCost), `createStockAdjustmentSchema`
  (signed nonzero int qtyDelta + reason), `setReorderPointSchema`.
- Pure helpers (unit-tested): `purchaseOrderTotal(lines)` (integer minor units),
  `isLowStock(qtyOnHand, reorderPoint)`.

## Testing / verification

- **Shared unit tests:** `purchaseOrderTotal` (integer, multi-line), `isLowStock`
  (boundary: `==`, `>`, `reorderPoint === 0` never low).
- **Live harness (extends the hardening harness):**
  - PO receive: draft→received once, `qtyOnHand += Σqty`, one movement per line, immutable after.
  - Concurrent double-receive of one draft PO → exactly one succeeds; stock added once.
  - Adjustment: positive adds; negative guarded (can't go below 0); movement written.
  - **Ledger reconciliation:** after a mixed sequence (receive, sale, void, adjust),
    `qtyOnHand == Σ StockMovement.qtyDelta` for the product.
  - POS retrofit regression: checkout writes a `sale` movement; void writes a `void` movement; the 8-way stock concurrency still holds.
  - Low-stock report returns exactly the rows at/below a positive reorder point.
- Full `pnpm typecheck / lint / test / build`.

## Rollout

Purely additive: new collections + one new `StockLevel` field (defaulted) + POS
writing an extra ledger row. No migration of existing data required (existing
`StockLevel` rows get `reorderPoint: 0` by default; historical movements simply
start from Phase 7 — the ledger is authoritative going forward).
