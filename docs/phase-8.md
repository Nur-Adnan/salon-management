# Phase 8 — Reporting & Analytics

Makes the data the platform already captures legible: revenue trends, staff
performance, inventory value, appointment health, and outstanding liabilities —
as read-only reports and an admin dashboard.

## What was built

**A read-only `ReportsModule`** — five on-demand Mongo aggregation pipelines over
the existing collections. No writes, no schema changes, no materialized rollups.
All money stays integer minor units; every figure is computed server-side. Reports
are **branch-scoped** like every other read (the branch switcher moves between
branches), with one documented exception: **CRM liabilities are tenant-wide**,
because loyalty/gift-card/subscription balances aren't partitioned by branch.
Date-bucketing and range boundaries are branch-timezone-correct (`$dateToString`
with `timezone`, and the existing `dayRangeUtc`).

- **`GET /reports/sales?from&to&groupBy=day|week|month`** — per-bucket
  `{gross, discounts, net, tax, tips, total, count}` plus breakdowns by payment
  method (captured only) and by line kind (`net = lineTotal − tax`), and range
  totals. Completed sales only.
- **`GET /reports/staff-performance?from&to`** — per staff `{netAttributed,
  commission, tips, hoursWorked, saleCount}`, assembled from three pipelines
  (earnings by kind — reversal-aware since reversals are negative; attributed
  net + distinct sale count from sale lines; hours from closed attendance shifts).
- **`GET /reports/inventory-value?from&to`** — `Σ(qtyOnHand × product.cost)` per
  product + total (via `$lookup`), low-stock count, and purchase spend by supplier
  over the range (received POs).
- **`GET /reports/appointments?from&to`** — status counts + `noShowRate` /
  `cancelRate` (safe divide-by-zero via the shared `safeRate`).
- **`GET /reports/crm-liabilities`** (tenant-wide) — outstanding loyalty points +
  monetary value, active gift-card balance, active subscription count, and total
  customer due balance (`Σ max(0, total − Σ captured payments)`, computed with a
  `$reduce` in the pipeline).

**Authorization** — a new `Report` CASL subject. Manager `read('Report')`; owner
(`manage('all')`) and accountant / read_only (`read('all')`) already covered;
receptionist and stylist get no report access. `read('all')` never grants write.

**Admin UI** — `/reports/{sales,staff,inventory,appointments}` (date-range forms +
tables), and KPI tiles on the home dashboard (net sales, sale count, stock value,
low-stock, outstanding due, gift-card liability) shown only to report-access
roles (a 403 hides them). A `Reports` nav link.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| On-demand aggregation, no rollups | Every report is a live pipeline; no `DailyMetric` materialization | Always fresh, zero write path, no cache-invalidation surface. Rollups are the additive optimization once data volume demands it — not needed at this scale. |
| Branch-scoped (CRM liabilities tenant-wide) | Reports use the active branch, matching every other read; the branch switcher covers "see another branch" | Consistent scoping model; org-wide cross-branch consolidation is a real added authz surface (which branches may a user aggregate?) deferred as a follow-up. Loyalty/gift-card/subscription balances are genuinely tenant-level, so CRM liabilities are the one honest exception. |
| Timezone-correct bucketing | `$dateToString` + `dayRangeUtc` in branch tz | A "day" must be the branch's day, not UTC's — the same discipline Phases 3–4 already apply to slot boundaries and daily sales. |
| `net = subtotal − discountTotal` | The sales "net" excludes tax, post-discount | Matches the loyalty-earn base (Phase 5) and the commission base (Phase 6), so "net revenue" means the same thing everywhere. |
| Staff shown by id | The report returns `staffId`, not a joined name | Avoids a cross-collection name join on a hot read; the admin cross-references the Team page. A name join is a cheap follow-up if wanted. |

## Deferred (explicit)

- Materialized daily rollups; org-wide (cross-branch) consolidated reporting;
  CSV/PDF export; cohort / retention / forecasting; a custom report builder.

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared **75**, incl. 5 new
  `safeRate`/`inventoryValue` tests; api **21**, incl. the new `Report` CASL case) ·
  `pnpm build` 4/4 (new admin routes `/reports/{sales,staff,inventory,appointments}`).
- **Live harness — 17/17** against a single-node replica set + Redis: a
  deterministic fixture (sales across days with known subtotals/discounts/tax/tips/
  payment methods + staff-attributed lines; matching earning entries; a closed
  8-hour shift; stock rows with costs; a received PO; appointments across statuses;
  loyalty/gift-card balances; an active + a cancelled subscription; a
  partially-paid sale) → each report method asserted against hand-computed values:
  - sales buckets + totals + by-payment-method + by-line-kind;
  - staff commission / tips / net / hours / saleCount;
  - inventory total value + low-stock count + PO spend;
  - appointment counts + no-show / cancel rate;
  - CRM liabilities (loyalty points + value, active-only gift-card balance,
    active subscriptions, due balance).
- Frontend verified by `next build`; full authenticated click-through needs a real
  Supabase project (same documented limitation as Phases 3–7).

## Follow-ups

- Org-wide (cross-branch) consolidated reports for owners.
- Materialized daily rollups when data volume makes live aggregation slow.
- Join staff/supplier names into their reports; CSV export; charting in the admin UI.
