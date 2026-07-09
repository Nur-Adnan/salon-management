# Phase 8 — Reporting & Analytics (design spec)

Status: approved design, pre-implementation.

## Goal

Make the data the platform already captures (sales, appointments, staff earnings,
attendance, inventory, loyalty/gift-cards/subscriptions) legible to an owner or
manager: revenue trends, staff performance, inventory value, appointment health,
and outstanding liabilities — as read-only reports and an admin dashboard.

## Approach

- **Read-only, on-demand Mongo aggregation pipelines.** No new writes, no mutation
  risk, always fresh. All money stays integer minor units, aggregated server-side.
- **Branch-scoped** like every other read (the branch switcher lets an owner move
  between branches), with ONE documented exception: CRM liabilities are
  **tenant-wide**, because loyalty/gift-card/subscription balances are not
  partitioned by branch.
- **Timezone-correct**: date-bucketing and day boundaries use the branch timezone
  (`$dateToString` with `timezone`, and the existing `dayRangeUtc`).

**Non-goals (deferred):** materialized daily rollups, org-wide cross-branch
consolidation, CSV/PDF export, cohort/retention/forecasting, a custom report
builder. All additive later.

## Module

New `ReportsModule` (read-only). `ReportsService` with one method per report;
`ReportsController` with each route gated `@CheckAbility('read', 'Report')`. It
registers the models it reads directly (`Sale`, `Appointment`, `StaffEarningEntry`,
`AttendanceRecord`, `StockLevel`, `Product`, `PurchaseOrder`, `LoyaltyAccount`,
`GiftCard`, `CustomerSubscription`) — a reporting module is inherently
cross-cutting; it only reads, never writes, so there is no ownership conflict.

## Authorization — new `Report` CASL subject

Add `'Report'` to `SUBJECTS`. Grants: `manager` `read('Report')`; `owner`
(`manage('all')`) and `accountant` / `read_only` (`read('all')`) already covered;
`receptionist` and `stylist` get no report access in v1.

## Reports

Date range params `from` / `to` are `YYYY-MM-DD` (inclusive), resolved to UTC
instants at branch-timezone day boundaries. Money fields are minor units.

### 1. Sales — `GET /reports/sales?from&to&groupBy=day|week|month`
Completed sales only (`status: 'completed'`), active branch, `createdAt` in range.
- `buckets`: `[{ key, gross, discounts, net, tax, tips, total, count }]` grouped by
  a `$dateToString` key in branch tz (day `%Y-%m-%d`, week `%G-W%V`, month `%Y-%m`).
  - `gross = Σ subtotal`, `discounts = Σ discountTotal`, `net = Σ (subtotal − discountTotal)`,
    `tax = Σ taxTotal`, `tips = Σ tip`, `total = Σ total`, `count = Σ 1`.
- `byPaymentMethod`: `[{ method, amount }]` — unwind `payments`, filter
  `status: 'captured'`, group by `method`.
- `byLineKind`: `[{ kind, net }]` — unwind `lines`, group by `kind`, `net = Σ (lineTotal − tax)`.
- `totals`: the range-wide roll-up of the bucket fields.

### 2. Staff performance — `GET /reports/staff-performance?from&to`
Active branch, range on the relevant timestamp. Returns `[{ staffId, netAttributed,
commission, tips, hoursWorked, saleCount }]`, assembled in JS from three pipelines:
- **Earnings** (`StaffEarningEntry`, `createdAt` in range): group by `staffId` +
  `kind`, `Σ amountMinor` → `commission` / `tips`. Reversal-aware (reversal entries
  are negative `amountMinor`, so the sum is net).
- **Attributed net + saleCount** (`Sale`, completed, `createdAt` in range): unwind
  `lines` where `staffId != null`, group by `staffId`: `netAttributed = Σ (lineTotal − tax)`,
  `saleCount = count of distinct saleId`.
- **Hours** (`AttendanceRecord`, closed shifts `clockOut != null`, `clockIn` in
  range): group by `staffId`, `hoursWorked = Σ (clockOut − clockIn)` in ms → hours
  (rounded to 2 dp).

### 3. Inventory value — `GET /reports/inventory-value` (+ optional `?from&to` for PO spend)
Active branch.
- `items`: `$lookup` `StockLevel` → `Product` on `productId`; `value = qtyOnHand ×
  cost.amount`; `[{ productId, qtyOnHand, unitCost, value }]`.
- `totalValue = Σ value`.
- `lowStockCount`: rows where `reorderPoint > 0 && qtyOnHand <= reorderPoint`.
- `poSpendBySupplier`: `PurchaseOrder` `status: 'received'`, `receivedAt` in range
  (defaults to all-time if no range), group by `supplierId`, `Σ totalCost.amount`.

### 4. Appointments — `GET /reports/appointments?from&to`
Active branch, appointments with any `lines.start` in range (same match the
appointments list uses), excluding soft-deleted.
- `byStatus`: counts per status.
- `total`, `completed`, `cancelled`, `noShow`.
- `noShowRate = safeRate(noShow, total)`, `cancelRate = safeRate(cancelled, total)`
  (safe divide: 0 when total is 0).

### 5. CRM liabilities — `GET /reports/crm-liabilities` (TENANT-WIDE)
- `loyaltyPointsOutstanding = Σ LoyaltyAccount.balance`; `loyaltyValueMinor =
  loyaltyPointsValue(points)` (shared helper).
- `giftCardOutstandingMinor = Σ GiftCard.balance.amount` where `status: 'active'`.
- `activeSubscriptions = count CustomerSubscription status 'active'`.
- `dueBalanceMinor`: over completed sales (tenant-wide), `Σ (total.amount −
  capturedAmount)` where `capturedAmount = Σ payments[status='captured'].amount`,
  clamped `>= 0` per sale (computed with `$reduce` in the pipeline).

## Shared contract (`packages/shared`)

- `REPORT_GROUP_BY = ['day','week','month'] as const` + type; `reportSalesQuerySchema`
  (`from`,`to` date strings, `groupBy` enum default `day`), `reportRangeQuerySchema`.
- Pure helpers (unit-tested): `safeRate(numerator, denominator): number` (0 when
  denom 0), `inventoryValue(rows: {qtyOnHand:number; unitCost:number}[]): number`.
- Reuse existing `loyaltyPointsValue` (crm.ts) for loyalty valuation.

## Admin UI

- `/reports/sales`, `/reports/staff`, `/reports/inventory`, `/reports/appointments`
  — server components fetching the endpoints, simple tables + totals (HeroUI,
  same pattern as existing pages). A date-range form (two `<input type="date">`).
- Home dashboard (`app/(app)/page.tsx`): KPI tiles (today's/this-period net sales,
  count, low-stock count, outstanding liabilities) from the report endpoints.
- Nav: a `Reports` link.
- `next build`-verified; full authenticated click-through needs a real Supabase
  project (same documented limitation as Phases 3–7).

## Testing / verification

- **Shared unit tests:** `safeRate` (normal, zero-denominator), `inventoryValue`
  (integer, multi-row, empty).
- **Live harness:** seed a known fixture (2–3 completed sales across days with
  known subtotals/tax/tips/discounts/payment methods + staff-attributed lines,
  staff earning entries, closed attendance shifts, stock rows with costs, a
  received PO, appointments across statuses, loyalty/gift-card balances), then
  assert each report method returns hand-computed values:
  - sales buckets + totals + byPaymentMethod + byLineKind match.
  - staff-performance commission/tips/netAttributed/hours match.
  - inventory-value totalValue = Σ qty×cost; lowStockCount correct; PO spend correct.
  - appointment counts + noShowRate match.
  - CRM liabilities loyalty/gift-card/subscriptions/dueBalance match.
- Full `pnpm typecheck / lint / test / build`.

## Rollout

Purely additive: one new read-only module + shared DTOs/helpers + admin screens.
No schema changes, no data migration.
