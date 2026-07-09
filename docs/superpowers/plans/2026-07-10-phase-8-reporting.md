# Phase 8 — Reporting & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Read-only owner/manager reports (sales, staff performance, inventory value, appointments, CRM liabilities) via on-demand Mongo aggregations + an admin dashboard.

**Architecture:** A new read-only `ReportsModule`; `ReportsService` runs one aggregation pipeline per report against the existing collections. Branch-scoped (CRM liabilities tenant-wide); timezone-correct bucketing. No writes, no schema changes.

**Tech Stack:** NestJS 11, Mongoose 9 aggregation, Zod 4 (`@salon/shared`), CASL, Next.js 16 admin, Vitest.

## Global Constraints (verbatim)

- Money integer minor units; aggregated server-side.
- Every query filtered by `tenantId`; branch reports also by `branchId` (CRM liabilities = tenant-wide, the one documented exception).
- Read-only: `@CheckAbility('read','Report')` on every route; no mutations.
- Date ranges are `YYYY-MM-DD`; resolve to UTC via `dayRangeUtc(date, branchTz)` (start of `from`, end of `to`); bucket via `$dateToString` with `timezone: branchTz`.
- Relative imports carry `.js` (nodenext, CJS).
- Verify: `pnpm --filter @salon/shared test` (pure logic) + live report harness + `pnpm typecheck && pnpm lint && pnpm build`. Infra: local `mongod --replSet rs0` + `redis-server`.

## File structure

```
packages/shared/src/
  enums.ts          (modify: REPORT_GROUP_BY; SUBJECTS += 'Report')
  reporting.ts      (new: safeRate, inventoryValue)
  reporting.test.ts (new)
  schemas.ts        (modify: reportSalesQuerySchema, reportRangeQuerySchema)
  index.ts          (modify: export reporting.js)
apps/api/src/
  reports/
    reports.service.ts     (new: 5 aggregation methods)
    reports.controller.ts  (new)
    reports.module.ts      (new)
  iam/casl/ability.factory.ts        (modify: manager read('Report'))
  iam/casl/ability.factory.spec.ts   (modify: assert grants)
  app.module.ts                      (modify: import ReportsModule)
apps/admin/app/(app)/
  reports/sales/page.tsx        (new)
  reports/staff/page.tsx        (new)
  reports/inventory/page.tsx    (new)
  reports/appointments/page.tsx (new)
  reports/actions.ts            (new: date-range form helper if needed)
  page.tsx                      (modify: KPI tiles)
  layout.tsx                    (modify: Reports nav link)
docs/phase-8.md   (new)
```

---

## Stage 1 — Shared contract (Vitest TDD)

### Task 1.1: enums + helpers + DTOs

**Files:** modify `enums.ts`, `schemas.ts`, `index.ts`; create `reporting.ts`, `reporting.test.ts`.

**Interfaces produced:**
- `REPORT_GROUP_BY = ['day','week','month'] as const` + `ReportGroupBy`; `SUBJECTS += 'Report'`.
- `safeRate(numerator: number, denominator: number): number` — `denominator <= 0 ? 0 : numerator / denominator`.
- `inventoryValue(rows: { qtyOnHand: number; unitCost: number }[]): number` — `Σ qtyOnHand*unitCost` (integer).
- `reportSalesQuerySchema` (`from?: dateStr, to?: dateStr, groupBy: enum default 'day'`), `reportRangeQuerySchema` (`from?`, `to?`). Date string = `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.

- [ ] **Step 1: failing tests** in `reporting.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { inventoryValue, safeRate } from './reporting.js';

describe('safeRate', () => {
  it('divides normally', () => expect(safeRate(3, 12)).toBe(0.25));
  it('is 0 when denominator is 0', () => expect(safeRate(5, 0)).toBe(0));
  it('is 0 when denominator negative', () => expect(safeRate(5, -2)).toBe(0));
});
describe('inventoryValue', () => {
  it('sums qty*unitCost in minor units', () =>
    expect(inventoryValue([{ qtyOnHand: 3, unitCost: 20000 }, { qtyOnHand: 2, unitCost: 500 }])).toBe(61000));
  it('is 0 for empty', () => expect(inventoryValue([])).toBe(0));
});
```

- [ ] **Step 2:** `pnpm --filter @salon/shared test` → FAIL.
- [ ] **Step 3:** implement `reporting.ts`; add `REPORT_GROUP_BY` + `'Report'` to `enums.ts`; add the two query schemas to `schemas.ts` (import `REPORT_GROUP_BY`); export `./reporting.js` in `index.ts`.
- [ ] **Step 4:** `pnpm --filter @salon/shared test` → PASS; `typecheck`; `build`.
- [ ] **Step 5: Commit** `feat(shared): reporting contract (Report subject, groupBy, safeRate/inventoryValue, query DTOs)`.

---

## Stage 2 — Authorization

### Task 2.1: `Report` CASL grant + spec

**Files:** modify `ability.factory.ts`, `ability.factory.spec.ts`.

- [ ] **Step 1:** In `manager` case add `can('read', 'Report');` (owner=manage all, accountant/read_only=read all already cover it; receptionist/stylist get none).
- [ ] **Step 2:** Extend the Phase-7 spec case (or add one): `manager.can('read','Report')` true; `accountant.can('read','Report')` true; `stylist.can('read','Report')` false; `receptionist.can('read','Report')` false; `manager.can('update','Report')` false.
- [ ] **Step 3:** `pnpm --filter @salon/api test` → PASS.
- [ ] **Step 4: Commit** with Stage 3 (grant alone isn't independently useful).

---

## Stage 3 — Reports module (the aggregations)

### Task 3.1: ReportsService + Controller + Module

**Files:** create `reports/reports.service.ts`, `reports/reports.controller.ts`, `reports/reports.module.ts`; modify `app.module.ts`.

**Service shape.** Constructor injects (read-only) models: `Sale`, `Appointment`,
`StaffEarningEntry`, `AttendanceRecord`, `StockLevel`, `Product`, `PurchaseOrder`,
`LoyaltyAccount`, `GiftCard`, `CustomerSubscription`, `Branch`, plus
`RequestContextService`. Two scope helpers: `scope()` → `{tenantId, branchId}`
(throws if absent) and `private async branchTz(): Promise<string>` → the active
branch's `timezone` (default `'Asia/Dhaka'`). A `private async range(from?, to?)`
→ `{ start, end }` using `dayRangeUtc` (start of `from` or epoch 0; end of `to`
or `new Date()`), in branch tz.

- [ ] **Step 1: `sales(from?, to?, groupBy)`**

```ts
const { tenantId, branchId } = this.scope();
const tz = await this.branchTz();
const { start, end } = await this.range(from, to);
const fmt = groupBy === 'month' ? '%Y-%m' : groupBy === 'week' ? '%G-W%V' : '%Y-%m-%d';
const [res] = await this.sales.aggregate([
  { $match: { tenantId, branchId, status: 'completed', deletedAt: null, createdAt: { $gte: start, $lte: end } } },
  { $facet: {
    buckets: [
      { $group: { _id: { $dateToString: { date: '$createdAt', format: fmt, timezone: tz } },
        gross: { $sum: '$subtotal.amount' }, discounts: { $sum: '$discountTotal.amount' },
        tax: { $sum: '$taxTotal.amount' }, tips: { $sum: '$tip.amount' },
        total: { $sum: '$total.amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } } ],
    byPaymentMethod: [
      { $unwind: '$payments' }, { $match: { 'payments.status': 'captured' } },
      { $group: { _id: '$payments.method', amount: { $sum: '$payments.amount.amount' } } } ],
    byLineKind: [
      { $unwind: '$lines' },
      { $group: { _id: '$lines.kind', net: { $sum: { $subtract: ['$lines.lineTotal.amount', '$lines.tax.amount'] } } } } ],
  } },
]);
const buckets = (res?.buckets ?? []).map((b: any) => ({
  key: b._id, gross: b.gross, discounts: b.discounts, net: b.gross - b.discounts,
  tax: b.tax, tips: b.tips, total: b.total, count: b.count }));
const totals = buckets.reduce((a, b) => ({
  gross: a.gross + b.gross, discounts: a.discounts + b.discounts, net: a.net + b.net,
  tax: a.tax + b.tax, tips: a.tips + b.tips, total: a.total + b.total, count: a.count + b.count }),
  { gross: 0, discounts: 0, net: 0, tax: 0, tips: 0, total: 0, count: 0 });
return { groupBy, buckets,
  byPaymentMethod: (res?.byPaymentMethod ?? []).map((p: any) => ({ method: p._id, amount: p.amount })),
  byLineKind: (res?.byLineKind ?? []).map((l: any) => ({ kind: l._id, net: l.net })), totals };
```

- [ ] **Step 2: `staffPerformance(from?, to?)`** — three aggregations + JS merge keyed by staffId:

```ts
const { tenantId, branchId } = this.scope();
const { start, end } = await this.range(from, to);
const inRange = { $gte: start, $lte: end };
const earnings = await this.staffEarnings.aggregate([
  { $match: { tenantId, branchId, createdAt: inRange } },
  { $group: { _id: { staffId: '$staffId', kind: '$kind' }, amt: { $sum: '$amountMinor' } } } ]);
const attributed = await this.sales.aggregate([
  { $match: { tenantId, branchId, status: 'completed', deletedAt: null, createdAt: inRange } },
  { $unwind: '$lines' }, { $match: { 'lines.staffId': { $ne: null } } },
  { $group: { _id: '$lines.staffId', net: { $sum: { $subtract: ['$lines.lineTotal.amount', '$lines.tax.amount'] } }, sales: { $addToSet: '$_id' } } } ]);
const hours = await this.attendance.aggregate([
  { $match: { tenantId, branchId, clockOut: { $ne: null }, clockIn: inRange } },
  { $group: { _id: '$staffId', ms: { $sum: { $subtract: ['$clockOut', '$clockIn'] } } } } ]);
// merge into Map<staffId, row>; commission = earnings kind 'commission', tips = kind 'tip';
// netAttributed + saleCount from attributed (sales.length); hoursWorked = round(ms/3.6e6, 2).
// return Object.values(map).
```

- [ ] **Step 3: `inventoryValue(from?, to?)`**

```ts
const { tenantId, branchId } = this.scope();
const items = await this.stock.aggregate([
  { $match: { tenantId, branchId } },
  { $lookup: { from: 'products', let: { pid: '$productId' },
      pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$pid'] } } }, { $project: { cost: 1, name: 1 } }], as: 'product' } },
  { $unwind: '$product' },
  { $project: { _id: 0, productId: '$productId', name: '$product.name', qtyOnHand: 1,
      reorderPoint: 1, unitCost: '$product.cost.amount', value: { $multiply: ['$qtyOnHand', '$product.cost.amount'] } } } ]);
const totalValue = items.reduce((n: number, i: any) => n + i.value, 0);
const lowStockCount = items.filter((i: any) => i.reorderPoint > 0 && i.qtyOnHand <= i.reorderPoint).length;
const { start, end } = await this.range(from, to);
const poSpend = await this.purchaseOrders.aggregate([
  { $match: { tenantId, branchId, status: 'received', receivedAt: { $gte: start, $lte: end } } },
  { $group: { _id: '$supplierId', spend: { $sum: '$totalCost.amount' } } } ]);
return { items: items.map((i:any)=>({ ...i, productId:String(i.productId) })), totalValue, lowStockCount,
  poSpendBySupplier: poSpend.map((p:any)=>({ supplierId:String(p._id), spend:p.spend })) };
```

- [ ] **Step 4: `appointments(from?, to?)`**

```ts
const { tenantId, branchId } = this.scope();
const { start, end } = await this.range(from, to);
const rows = await this.appts.aggregate([
  { $match: { tenantId, branchId, deletedAt: null, 'lines.start': { $gte: start, $lte: end } } },
  { $group: { _id: '$status', count: { $sum: 1 } } } ]);
const byStatus: Record<string, number> = {}; let total = 0;
for (const r of rows) { byStatus[r._id] = r.count; total += r.count; }
const completed = byStatus.completed ?? 0, cancelled = byStatus.cancelled ?? 0, noShow = byStatus.no_show ?? 0;
return { byStatus, total, completed, cancelled, noShow,
  noShowRate: safeRate(noShow, total), cancelRate: safeRate(cancelled, total) };
```

- [ ] **Step 5: `crmLiabilities()`** (TENANT-WIDE — no branchId):

```ts
const { tenantId } = this.scope();
const [loy] = await this.loyaltyAccounts.aggregate([{ $match: { tenantId } }, { $group: { _id: null, pts: { $sum: '$balance' } } }]);
const [gc] = await this.giftCards.aggregate([{ $match: { tenantId, status: 'active' } }, { $group: { _id: null, bal: { $sum: '$balance.amount' } } }]);
const activeSubscriptions = await this.subscriptions.countDocuments({ tenantId, status: 'active' }).exec();
const [due] = await this.sales.aggregate([
  { $match: { tenantId, status: 'completed', deletedAt: null } },
  { $project: { owed: { $max: [0, { $subtract: ['$total.amount',
      { $reduce: { input: '$payments', initialValue: 0,
        in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.status', 'captured'] }, '$$this.amount.amount', 0] }] } } }] }] } } },
  { $group: { _id: null, dueBalance: { $sum: '$owed' } } } ]);
const pts = loy?.pts ?? 0;
return { loyaltyPointsOutstanding: pts, loyaltyValueMinor: loyaltyPointsValue(pts).amount,
  giftCardOutstandingMinor: gc?.bal ?? 0, activeSubscriptions, dueBalanceMinor: due?.dueBalance ?? 0 };
```

- [ ] **Step 6:** Controller — `@Controller('reports')`, routes `sales`, `staff-performance`, `inventory-value`, `appointments`, `crm-liabilities`, each `@CheckAbility('read','Report')`, query DTOs via `ZodValidationPipe` on a query object (see how other controllers validate `@Query`). Module registers the 11 models + provides the service; register `ReportsModule` in `app.module.ts`.
- [ ] **Step 7:** `pnpm --filter @salon/api typecheck`.
- [ ] **Step 8: Commit** `feat(api): Reports module — sales/staff/inventory/appointments/CRM-liability aggregations`.

---

## Stage 4 — Admin UI

### Task 4.1: report pages + dashboard KPIs + nav

**Files:** create `reports/{sales,staff,inventory,appointments}/page.tsx`; modify `(app)/page.tsx`, `(app)/layout.tsx`. Follow the coupons/sales page pattern (server component, `apiFetch`, HeroUI table, `bdt` helper). Date range via two `<input type="date" name="from|to">` in a GET `<form>` reading `searchParams`.

- [ ] **Step 1:** `/reports/sales` — date-range form; buckets table; totals row; payment-method + line-kind breakdowns.
- [ ] **Step 2:** `/reports/staff` — per-staff table (net, commission, tips, hours, saleCount).
- [ ] **Step 3:** `/reports/inventory` — items table (qty, unit cost, value), totalValue, lowStockCount, PO spend by supplier.
- [ ] **Step 4:** `/reports/appointments` — status counts + no-show/cancel rate.
- [ ] **Step 5:** Home `page.tsx`: KPI tiles (period net sales, sale count, low-stock count, outstanding liabilities) from the endpoints; `Reports` nav link in `layout.tsx`.
- [ ] **Step 6:** `pnpm --filter @salon/admin build` → PASS.
- [ ] **Step 7: Commit** `feat(admin): reports pages + dashboard KPIs`.

---

## Stage 5 — Verify + docs

### Task 5.1: live report harness + toolchain + phase doc

**Files:** create `scratchpad/verify-phase8.ts` (same bootstrap as prior harnesses). Create `docs/phase-8.md`; update `README.md`.

- [ ] **Step 1:** Seed a deterministic fixture (2 completed sales on different days with known subtotals/discounts/tax/tips/payment methods + staff-attributed lines; matching StaffEarningEntry rows; 1 closed AttendanceRecord of known duration; 2 stock rows with known costs; 1 received PO; appointments in each of booked/completed/no_show; loyalty + gift-card balances; 1 active subscription; 1 partially-paid sale for due balance). Drive each `ReportsService` method inside `ctx.run` and assert hand-computed values (sales totals + buckets + breakdowns; staff commission/tips/net/hours; inventory totalValue + lowStockCount + PO spend; appointment counts + noShowRate; CRM liabilities all four).
- [ ] **Step 2:** rebuild api `dist`; run harness → all pass.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → green.
- [ ] **Step 4:** `docs/phase-8.md` (What / Decisions / Verification / Follow-ups, phase-7 style); README phase list.
- [ ] **Step 5: Commit** `feat: Phase 8 — Reporting & Analytics` (+ docs).

---

## Self-review notes

- **Spec coverage:** sales ✓(3.1/1) · staff ✓(3.1/2) · inventory-value ✓(3.1/3) · appointments ✓(3.1/4) · crm-liabilities ✓(3.1/5) · Report subject/authz ✓(2.1) · DTOs/helpers ✓(1.1) · admin ✓(4.1) · testing ✓(1.1,2.1,5.1) · deferrals not built ✓.
- **Type consistency:** `safeRate`/`inventoryValue` names 1.1↔3.1↔5.1; `loyaltyPointsValue(pts).amount` matches crm.ts; group-by format strings consistent; branch-scoped everywhere except `crmLiabilities` (tenant-wide, per spec).
- **Placeholder scan:** none — each report method has concrete pipeline code; boilerplate (controller/module/admin) pattern-referenced to named existing files.
