# Phase 7 — Inventory & Suppliers

Turns the placeholder per-branch stock counter from Phase 4 into an auditable
inventory module: suppliers, purchase orders, manual adjustments, reorder
points, and — underneath all of it — a movement ledger that `qtyOnHand` is now
a cache over.

## What was built

**`qtyOnHand` is a cache over an append-only `StockMovement` ledger** — the same
cache+ledger pattern Phase 5 uses for `LoyaltyAccount.balance` over
`LoyaltyLedgerEntry`. Every stock change now flows through **one** helper,
`applyStockDelta` (`inventory/stock.util.ts`), which in a single transaction
does the guarded `$inc` on `StockLevel.qtyOnHand` **and** appends one immutable
`StockMovement`. The two can never diverge, and the ledger reconciles exactly:
`qtyOnHand == Σ StockMovement.qtyDelta` for a `(branch, product)` — proven live.

A plain function, not a provider, so POS / Inventory / PurchaseOrders each call
it against their own injected models with no circular import — the same
convention as `crm/ledger.util.ts` and `hr/ledger.util.ts`.

**POS retrofit.** `checkout` (decrement, reason `sale`) and `voidSale` (restore,
reason `void`) were moved onto `applyStockDelta`, so POS stock changes appear in
the ledger too. The guarded-decrement / oversell-block behavior from the phase-0..6
hardening pass is unchanged — it now lives inside the helper. The void restore
aggregates by product (one movement each) and uses `createIfMissing:false` so a
product that was untracked at sale time is not resurrected into inventory by a
void. The hardening harness still passes 17/17 after the retrofit.

**Suppliers** — `Supplier` (name, contact, address, note), per-tenant unique name
(partial on `deletedAt:null`, soft-deletable), standard CRUD.

**Purchase orders** — `PurchaseOrder` (draft → received → cancelled). Create
validates the supplier + every product against the tenant catalog, computes
`totalCost` server-side (`purchaseOrderTotal`, integer minor units), and assigns
a per-tenant `PO-000001` number via the same `Counter` the invoice sequence uses.
**Receive** is one transaction: an atomic `draft → received` flip (one-time
guarded, so concurrent or duplicated receives can never double-stock — proven by
a concurrent double-receive race) then a per-product stock-in via `applyStockDelta`
(lines aggregated by product, one movement each). A received PO is **immutable**
(no update path, like `Payslip`). Only a draft can be cancelled.

**Manual adjustments** — `StockAdjustment` (signed `qtyDelta` + reason:
recount/wastage/damage/correction). Creating one performs the atomic stock change
+ movement in one transaction; a negative adjustment is still guarded (can't
drive stock negative).

**Reorder / low-stock** — `StockLevel` gained `reorderPoint`; a
`/inventory/low-stock` report returns rows where `reorderPoint > 0 && qtyOnHand
<= reorderPoint` (evaluated in Mongo via `$expr`, mirroring the shared
`isLowStock` predicate).

**Authorization** — two new CASL subjects, `Inventory` and `Supplier`. Manager
manages both; receptionist + stylist read `Inventory` (see on-hand stock while
ringing up / checking a product); accountant + read_only read via `read('all')`;
`read('all')` never grants write. The minimal `/inventory/stock` surface moved
off the `Catalog` subject onto `Inventory`.

**Admin UI** — `/inventory` (stock + low-stock badges, set on-hand, set reorder,
adjust), `/suppliers` (list/add/delete), `/purchase-orders` (list + status, create
draft with up to three lines, receive/cancel).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Movement ledger as source of truth | `qtyOnHand` is a cache; `StockMovement` (append-only) is authoritative; both written by `applyStockDelta` in one txn | Same proven pattern as the loyalty balance/ledger. Makes "why is stock this number" answerable and lets the cache be reconciled to the ledger. The alternative (a parallel log only Phase-7 features write) can't reconcile — POS changes would be invisible. |
| One movement per (op, product) | `applyStockDelta` is called once per product; callers aggregate lines first (checkout `productQtys`, PO receipt, void restore) | Keeps the `{tenantId,refType,refId,productId,reason}` movement idempotency index valid (a transaction retry's re-insert is a caught no-op) and avoids fragmenting one operation across many rows. |
| Oversell blocks, untracked sells | Decrement guarded `qtyOnHand >= qty`; a tracked-but-insufficient row throws 409; a product with no stock row is untracked and still sells | Never-negative is non-negotiable (invariant #2), but forcing every product to be stocked before it can be sold would break existing behavior. A per-branch "allow backorder" toggle is a later additive extension. |
| Full-PO receipt only | A PO is received in one shot; no partial/multi-shipment receiving | Partial receiving is real added state (a received-quantity per line, a PO that's partially open) nothing here needs yet; immutable-on-receive is simpler and correct for v1. Additive later. |
| No COGS / valuation | Receiving records `unitCost` on the PO + movement but does NOT mutate `Product.cost` | Weighted-average / FIFO valuation is a distinct concern (accounting), not stock control. Deferred rather than half-built. |
| Clawback-consistent void | Void restore uses `createIfMissing:false` | A void must not create a stock row for a product that was never inventory-managed at sale time — that would be a surprising side effect, not a restoration. |

## Deferred (explicit)

- **Batches / lots + expiry / FEFO** consumption (the unused `Product.expiryTracked`
  flag). Additive: a batch sub-collection + earliest-expiry-first pick in the
  decrement path.
- **Inter-branch stock transfers.**
- **Weighted-average cost / COGS valuation.**
- **Partial / multi-shipment PO receipts.**
- **Supplier price lists / catalogs.**

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared **70**, incl. 6 new
  inventory helper tests; api **20**, incl. the new Inventory/Supplier CASL case) ·
  `pnpm build` 4/4 (new admin routes `/inventory`, `/suppliers`, `/purchase-orders`).
- **Live harness — 15/15** against a single-node replica set + Redis:
  - **PO receive**: draft with server-computed total → received once (`qtyOnHand
    += Σqty`, one `purchase` movement per product); a second receive is rejected
    (immutable) and stock is untouched.
  - **Concurrent double-receive** of one draft PO → exactly one wins; stock added
    exactly once.
  - **Adjustments**: positive adds; an over-decrement is blocked (never negative)
    with stock untouched; a valid negative applies.
  - **Ledger reconciliation**: after receive + concurrent-receive + adjust×3 +
    sale + void, `qtyOnHand (15) === Σ StockMovement.qtyDelta (15)`.
  - **Low-stock**: a product at/below a positive reorder point appears in the
    report; setting the point to 0 removes it.
- **POS retrofit regression**: the phase-0..6 hardening harness still passes 17/17
  (checkout decrements, void restores, clawbacks intact) with movements now written.
- Frontend verified by `next build`; a full authenticated click-through needs a
  real Supabase project (same documented limitation as Phases 3–6).

## Follow-ups

- Batches/expiry (FEFO), inter-branch transfers, COGS valuation, partial PO
  receipts, supplier price lists — all additive (see Deferred).
- The admin PO builder creates up to three lines per order (a server-form limit);
  the API accepts any number — a client-side line-adder is a UI-only follow-up.
