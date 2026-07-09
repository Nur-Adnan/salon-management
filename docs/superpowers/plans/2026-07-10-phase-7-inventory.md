# Phase 7 — Inventory & Suppliers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder per-branch `StockLevel` counter into an auditable inventory module — suppliers, purchase orders (draft → receive → atomic stock-in), manual adjustments, reorder points/low-stock — with `qtyOnHand` as a cache over an append-only `StockMovement` ledger.

**Architecture:** Every stock change flows through one `applyStockDelta` helper that, in a single Mongo transaction, does a guarded `$inc` on `StockLevel.qtyOnHand` and appends an immutable `StockMovement` — the same cache+ledger pattern as `crm/ledger.util.ts` (loyalty). New `InventoryModule` and `SuppliersModule`; POS `checkout`/`voidSale` are retrofitted to write movements through the same helper.

**Tech Stack:** NestJS 11 (modular monolith), Mongoose 9 (replica-set transactions), `@nestjs/cqrs`, Zod 4 (`@salon/shared` contract), CASL, Next.js 16 admin, Vitest.

## Global Constraints (verbatim from spec + repo)

- Money is integer minor units (poisha); computed server-side; never floats.
- Every DB query filtered by `tenantId`; branch-scoped collections also by `branchId`.
- Every stock mutation is an atomic guarded `findOneAndUpdate` (guard in the filter); decrements filtered `qtyOnHand: { $gte: qty }`; never read-then-write; never negative.
- Records immutable once committed to a terminal state (received PO, like `Payslip`).
- `read('all')` never grants write; write routes gated by create/update/manage at the guard.
- Relative imports carry `.js` extensions (nodenext, CJS). Plain functions (not providers) for cross-module helpers to avoid circular imports.
- Verification per stage: `pnpm --filter @salon/shared test` (vitest, for pure logic) and/or the live harness + `pnpm typecheck && pnpm lint && pnpm build`. Live infra: local `mongod --replSet rs0` (27017) + `redis-server` (6379).

---

## File structure

```
packages/shared/src/
  enums.ts                      (modify: STOCK_MOVEMENT_REASONS, PURCHASE_ORDER_STATUS,
                                 STOCK_ADJUSTMENT_REASONS, SUBJECTS += Inventory,Supplier)
  inventory.ts                  (new: purchaseOrderTotal, isLowStock)
  inventory.test.ts             (new: unit tests)
  schemas.ts                    (modify: supplier/PO/adjustment/reorder Zod DTOs)
  index.ts                      (modify: export inventory.ts)
apps/api/src/
  inventory/
    schemas/stock-movement.schema.ts     (new)
    schemas/stock-adjustment.schema.ts   (new)
    stock.util.ts                        (new: applyStockDelta)
    inventory.service.ts                 (new)
    inventory.controller.ts              (new)
    inventory.mappers.ts                 (new)
    inventory.module.ts                  (new)
  suppliers/
    schemas/supplier.schema.ts           (new)
    schemas/purchase-order.schema.ts     (new)
    suppliers.service.ts                 (new)
    suppliers.controller.ts              (new)
    purchase-orders.service.ts           (new)
    purchase-orders.controller.ts        (new)
    suppliers.mappers.ts                 (new)
    suppliers.module.ts                  (new)
  pos/schemas/stock-level.schema.ts      (modify: + reorderPoint)
  pos/inventory.controller.ts            (DELETE — moves to inventory/ with Inventory subject)
  pos/inventory.service.ts               (DELETE — moves to inventory/)
  pos/sales.service.ts                   (modify: use applyStockDelta in checkout+void)
  pos/pos.module.ts                      (modify: register StockMovement; drop old inventory)
  iam/casl/ability.factory.ts            (modify: Inventory/Supplier grants)
  app.module.ts                          (modify: import InventoryModule, SuppliersModule)
apps/admin/                              (new minimal pages: suppliers, purchase-orders, inventory)
docs/phase-7.md                          (new: phase doc)
```

---

## Stage 1 — Shared contract (Vitest TDD)

### Task 1.1: Inventory enums + pure helpers

**Files:**
- Modify: `packages/shared/src/enums.ts`
- Create: `packages/shared/src/inventory.ts`, `packages/shared/src/inventory.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces produced:**
- `STOCK_MOVEMENT_REASONS = ['sale','void','purchase','adjustment'] as const` + `StockMovementReason`
- `PURCHASE_ORDER_STATUS = ['draft','received','cancelled'] as const` + `PurchaseOrderStatus`
- `STOCK_ADJUSTMENT_REASONS = ['recount','wastage','damage','correction'] as const` + `StockAdjustmentReason`
- `SUBJECTS` gains `'Inventory'`, `'Supplier'`
- `purchaseOrderTotal(lines: { quantity: number; unitCost: Money }[]): Money` — integer Σ(unitCost×qty)
- `isLowStock(qtyOnHand: number, reorderPoint: number): boolean` — `reorderPoint > 0 && qtyOnHand <= reorderPoint`

- [ ] **Step 1: Write failing tests** in `inventory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isLowStock, purchaseOrderTotal } from './inventory.js';
import { money } from './money.js';

describe('purchaseOrderTotal', () => {
  it('sums unitCost*qty across lines in integer minor units', () => {
    expect(purchaseOrderTotal([
      { quantity: 3, unitCost: money(1500) },
      { quantity: 2, unitCost: money(999) },
    ])).toEqual(money(3 * 1500 + 2 * 999));
  });
  it('is zero for no lines', () => expect(purchaseOrderTotal([])).toEqual(money(0)));
});

describe('isLowStock', () => {
  it('true at or below a positive reorder point', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(4, 5)).toBe(true);
  });
  it('false above the point', () => expect(isLowStock(6, 5)).toBe(false));
  it('reorderPoint 0 is never low (feature off)', () => expect(isLowStock(0, 0)).toBe(false));
});
```

- [ ] **Step 2:** `pnpm --filter @salon/shared test` → FAIL (module not found).
- [ ] **Step 3: Implement** `inventory.ts` using `money`, `mulInt`, `add` from `money.js` (check exact names in `money.ts` first). `purchaseOrderTotal` reduces with `add(acc, mulInt(unitCost, quantity))`. `isLowStock` is the one-line predicate.
- [ ] **Step 4:** Add the three enum arrays + `SUBJECTS` entries to `enums.ts`; export `./inventory.js` from `index.ts`.
- [ ] **Step 5:** `pnpm --filter @salon/shared test` → PASS; `pnpm --filter @salon/shared typecheck`.
- [ ] **Step 6: Commit** `feat(shared): inventory enums, PO total + low-stock helpers`.

### Task 1.2: Zod DTOs

**Files:** Modify `packages/shared/src/schemas.ts` (+ `index.ts` exports if needed).

**Interfaces produced:**
- `createSupplierSchema` / `CreateSupplier`, `updateSupplierSchema` / `UpdateSupplier`
  (`name` required trimmed 1..120; `contact` optional `{ phone?, email? (z.string().email()) }`; `address?`, `note?`, `active` default true)
- `createPurchaseOrderSchema` / `CreatePurchaseOrder`
  (`supplierId` objectId; `lines` min(1) of `{ productId objectId, quantity int positive max 100000, unitCost int nonnegative }`; `note?`)
- `createStockAdjustmentSchema` / `CreateStockAdjustment`
  (`productId` objectId; `qtyDelta` int, `.refine(v => v !== 0)`; `reason` enum(STOCK_ADJUSTMENT_REASONS); `note?`)
- `setReorderPointSchema` / `SetReorderPoint` (`productId` objectId; `reorderPoint` int nonnegative)

- [ ] **Step 1:** Add the schemas mirroring existing ones (`setStockSchema`, `createSaleSchema`) for style (`objectIdSchema`, `.strict()` if used elsewhere — check).
- [ ] **Step 2:** `pnpm --filter @salon/shared typecheck && pnpm --filter @salon/shared build`.
- [ ] **Step 3: Commit** `feat(shared): inventory/supplier/PO Zod DTOs`.

---

## Stage 2 — Schemas (api)

### Task 2.1: New Mongoose schemas + StockLevel.reorderPoint

**Files:**
- Create: `apps/api/src/inventory/schemas/stock-movement.schema.ts`, `apps/api/src/inventory/schemas/stock-adjustment.schema.ts`
- Create: `apps/api/src/suppliers/schemas/supplier.schema.ts`, `apps/api/src/suppliers/schemas/purchase-order.schema.ts`
- Modify: `apps/api/src/pos/schemas/stock-level.schema.ts` (add `reorderPoint`)

**Interfaces produced:** `StockMovement`/`StockMovementDocument`, `StockAdjustment`/..., `Supplier`/..., `PurchaseOrder`/... (+ `PurchaseOrderLine` sub-schema).

- [ ] **Step 1:** Write `stock-movement.schema.ts` (append-only; `@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'stock_movements' })`):

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { STOCK_MOVEMENT_REASONS, type StockMovementReason } from '@salon/shared';
import { type HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'stock_movements' })
export class StockMovement {
  @Prop({ type: Types.ObjectId, required: true, index: true }) tenantId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) branchId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) productId!: Types.ObjectId;
  @Prop({ type: Number, required: true }) qtyDelta!: number; // signed
  @Prop({ type: String, required: true, enum: [...STOCK_MOVEMENT_REASONS] }) reason!: StockMovementReason;
  @Prop({ type: String, required: true }) refType!: string; // 'sale' | 'purchase_order' | 'adjustment'
  @Prop({ type: Types.ObjectId, required: true }) refId!: Types.ObjectId;
  @Prop({ type: String, trim: true, default: null }) note!: string | null;
}
export type StockMovementDocument = HydratedDocument<StockMovement>;
export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
StockMovementSchema.index({ tenantId: 1, branchId: 1, productId: 1, createdAt: -1 });
StockMovementSchema.index({ tenantId: 1, refType: 1, refId: 1 });
// Idempotency: at most one movement per (op, product, reason) — requires callers
// to aggregate deltas by product (checkout productQtys; PO receipt aggregation).
StockMovementSchema.index({ tenantId: 1, refType: 1, refId: 1, productId: 1, reason: 1 }, { unique: true });
```

- [ ] **Step 2:** `stock-adjustment.schema.ts` — `{ tenantId(index), branchId, productId, qtyDelta, reason(enum STOCK_ADJUSTMENT_REASONS), note, createdByUserId }`, timestamps createdAt only, collection `stock_adjustments`.
- [ ] **Step 3:** `supplier.schema.ts` — `{ tenantId(index), name, contact: { phone, email } (sub-schema _id:false), address, note, active(default true), deletedAt }`, timestamps, collection `suppliers`; partial unique `{ tenantId, name }` on `deletedAt: null`.
- [ ] **Step 4:** `purchase-order.schema.ts` — `PurchaseOrderLine` (`_id:false`): `{ productId, quantity, unitCost: MoneyEmbed }` (import `MoneyEmbed, MoneyEmbedSchema` from `../../common/embeds.js`). `PurchaseOrder`: `{ tenantId(index), branchId(index), supplierId, poNumber, status(enum PURCHASE_ORDER_STATUS, default 'draft'), lines: [PurchaseOrderLineSchema], totalCost: MoneyEmbed, note, createdByUserId, receivedAt(default null), deletedAt }`, collection `purchase_orders`; unique `{ tenantId, poNumber }`.
- [ ] **Step 5:** In `stock-level.schema.ts` add `@Prop({ type: Number, required: true, default: 0 }) reorderPoint!: number;`.
- [ ] **Step 6:** `pnpm --filter @salon/api typecheck` (schemas compile). No commit yet (services follow).

---

## Stage 3 — Stock mutation helper

### Task 3.1: `applyStockDelta`

**Files:** Create `apps/api/src/inventory/stock.util.ts`.

**Interfaces produced:**
```ts
export interface StockModels {
  stock: Model<StockLevelDocument>;
  movements: Model<StockMovementDocument>;
}
export async function applyStockDelta(
  m: StockModels,
  p: { tenantId; branchId; productId: Types.ObjectId; qtyDelta: number;
       reason: StockMovementReason; refType: string; refId: Types.ObjectId; note?: string | null },
  session: ClientSession,
): Promise<void>;
```

**Logic (matches the hardened checkout guard, generalized):**
- `qtyDelta === 0` → return.
- `qtyDelta < 0`: `updateOne({ tenantId, branchId, productId, qtyOnHand: { $gte: -qtyDelta } }, { $inc: { qtyOnHand: qtyDelta } }, { session })`. If `matchedCount === 0`: `findOne` the row; if it exists → `throw new ConflictException('insufficient stock for product '+productId)`; if not → **untracked, return** (no movement — nothing was tracked).
- `qtyDelta > 0`: `updateOne(key, { $inc: { qtyOnHand: qtyDelta } }, { upsert: true, session })`.
- Then append the movement; wrap the `movements.create([...], { session })` in a `try/catch` that swallows `isDuplicateKeyError` (retry-safe, like `reverseStaffEarningsForSale`).

- [ ] **Step 1:** Implement per above. Import `ConflictException` from `@nestjs/common`, `isDuplicateKeyError` from `../common/mongo.util.js`.
- [ ] **Step 2:** `pnpm --filter @salon/api typecheck`.
- [ ] **Step 3:** No standalone test here (exercised live in Stage 9). Commit with Stage 4.

---

## Stage 4 — Inventory module

### Task 4.1: InventoryService + controller + mappers + module

**Files:** Create `inventory.service.ts`, `inventory.controller.ts`, `inventory.mappers.ts`, `inventory.module.ts`. Delete `pos/inventory.service.ts`, `pos/inventory.controller.ts`.

**Service methods** (all tenant+branch scoped via a `scope()` helper copied from the old `pos/inventory.service.ts`):
- `setStock(dto: SetStock)` — moved from old service (upsert qtyOnHand).
- `setReorderPoint(dto: SetReorderPoint)` — `findOneAndUpdate(key, { $set: { reorderPoint } }, { upsert: true, new: true })`.
- `adjust(dto: CreateStockAdjustment)` — one transaction: create `StockAdjustment` doc, then `applyStockDelta(qtyDelta, 'adjustment', 'adjustment', adjustmentId)`.
- `listStock()`, `listMovements(productId?)`, `listAdjustments()`, `lowStock()` (filter `reorderPoint > 0` then `isLowStock`; do the compare in a Mongo `$expr` `{ $and: [{ $gt: ['$reorderPoint', 0] }, { $lte: ['$qtyOnHand', '$reorderPoint'] }] }`).

**Controller** `@Controller('inventory')` — routes per spec §API, each `@CheckAbility(action, 'Inventory')`; DTOs via `ZodValidationPipe`.

**Module** registers `StockLevel`, `StockMovement`, `StockAdjustment`; `InjectConnection` for the txn.

- [ ] **Step 1:** Implement service (copy scope()/setStock from old pos/inventory.service.ts).
- [ ] **Step 2:** Controller + mappers (`serializeStockLevel` moves here; add `serializeMovement`, `serializeAdjustment`).
- [ ] **Step 3:** `inventory.module.ts`; register in `app.module.ts`.
- [ ] **Step 4:** Delete old `pos/inventory.*`; remove them from `pos.module.ts` controllers/providers.
- [ ] **Step 5:** `pnpm --filter @salon/api typecheck`.
- [ ] **Step 6: Commit** `feat(api): Inventory module (stock, movements, adjustments, reorder, low-stock)` (includes Stage 2/3 files).

---

## Stage 5 — Suppliers + Purchase Orders module

### Task 5.1: SuppliersService + PurchaseOrdersService + controllers + module

**Files:** Create the 7 `suppliers/` files.

**SuppliersService:** CRUD, tenant-scoped, soft-delete, duplicate-name → `ConflictException` (catch `isDuplicateKeyError`), same shape as catalog services.

**PurchaseOrdersService:**
- `create(dto)` — validate supplier + each product exist in tenant; compute `totalCost = purchaseOrderTotal(lines)`; assign `poNumber` via `Counter` (`${tenantId}:po`, `PO-` + padStart(6)); status `draft`.
- `receive(id)` — `InjectConnection` txn: `findOneAndUpdate({ _id, tenantId, status: 'draft' }, { $set: { status: 'received', receivedAt: new Date() } }, { new: false, session })`; if null → NotFound or `BadRequestException('not a draft PO')`; **aggregate lines by product** (Map productId→Σqty) then one `applyStockDelta(+Σqty, 'purchase', 'purchase_order', poId)` per product in the same session.
- `cancel(id)` — guarded flip `draft → cancelled`.
- `list()`, `get(id)`.

**Controllers:** `@Controller('suppliers')` and `@Controller('purchase-orders')`, each `@CheckAbility(action, 'Supplier')`.

**Module** registers `Supplier`, `PurchaseOrder`, `StockLevel`, `StockMovement`, `Counter`, `Product` (validation); `InjectConnection`. Imports the `applyStockDelta` util (plain function; register `StockLevel`+`StockMovement` models directly — no `InventoryModule` import, matching the no-circular convention).

- [ ] **Step 1:** SuppliersService + controller.
- [ ] **Step 2:** PurchaseOrdersService (create/receive/cancel/list/get) + controller.
- [ ] **Step 3:** mappers, module; register in `app.module.ts`.
- [ ] **Step 4:** `pnpm --filter @salon/api typecheck`.
- [ ] **Step 5: Commit** `feat(api): Suppliers + Purchase Orders (draft->receive->atomic stock-in)`.

---

## Stage 6 — Authorization

### Task 6.1: CASL grants

**Files:** Modify `apps/api/src/iam/casl/ability.factory.ts` (SUBJECTS already extended in Task 1.1).

- [ ] **Step 1:** Add grants per spec §Authorization: manager `can('manage','Inventory')` + `can('manage','Supplier')`; receptionist + stylist `can('read','Inventory')`. (owner=manage all; accountant/read_only=read all already.)
- [ ] **Step 2:** Existing `/inventory/stock` now lives under `Inventory` subject (done in Task 4.1 controller).
- [ ] **Step 3:** Add a case to `ability.factory.spec.ts`: manager can manage Inventory+Supplier; stylist can read but not manage Inventory; stylist cannot read Supplier. Run `pnpm --filter @salon/api test` → PASS.
- [ ] **Step 4: Commit** `feat(api): Inventory + Supplier CASL subjects and grants`.

---

## Stage 7 — POS retrofit (write movements)

### Task 7.1: checkout + voidSale emit StockMovements

**Files:** Modify `apps/api/src/pos/sales.service.ts`, `apps/api/src/pos/pos.module.ts`.

- [ ] **Step 1:** Register `StockMovement` in `pos.module.ts`; inject `Model<StockMovementDocument>` into `SalesService`.
- [ ] **Step 2:** In `checkout`, replace the current guarded decrement loop body with `applyStockDelta({ stock: this.stock, movements: this.movements }, { ...key, qtyDelta: -qty, reason: 'sale', refType: 'sale', refId: saleId }, session)`. (Behavior identical — the guard + insufficient-stock throw now live in the helper.)
- [ ] **Step 3:** In `voidSale`, replace the stock-restore loop with `applyStockDelta(..., { qtyDelta: +l.quantity, reason: 'void', refType: 'sale', refId: before._id }, session)` per product — **aggregate product lines first** (a sale can list a product twice) so one `void` movement per product keeps the idempotency index valid.
- [ ] **Step 4:** `pnpm --filter @salon/api typecheck && pnpm --filter @salon/api build`.
- [ ] **Step 5:** Run the **hardening harness** (`scratchpad/verify-hardening.ts`) → still 17/17 (sale still decrements, void still restores). Commit `refactor(api): POS stock changes flow through applyStockDelta (movement ledger)`.

---

## Stage 8 — Admin UI (minimal)

### Task 8.1: Suppliers, Purchase Orders, Inventory pages

**Files:** Create `apps/admin/app/suppliers/page.tsx`, `apps/admin/app/purchase-orders/page.tsx`, extend `apps/admin/app/inventory/…` (follow the exact pattern of an existing page, e.g. `coupons/page.tsx` or `team/page.tsx`: server component fetch via the shared API client, HeroUI table + a create form/dialog). Add nav links where the existing pages are linked.

- [ ] **Step 1:** Suppliers list + create.
- [ ] **Step 2:** Purchase orders list + create-draft + receive button.
- [ ] **Step 3:** Inventory: stock list + reorder + adjust + low-stock view.
- [ ] **Step 4:** `pnpm --filter @salon/admin build` (SSR/type check) → PASS.
- [ ] **Step 5: Commit** `feat(admin): inventory, suppliers, purchase-orders screens`.

---

## Stage 9 — Verification + docs

### Task 9.1: Extend live harness + full toolchain + phase doc

**Files:** Extend `scratchpad/verify-phase7.ts` (new harness, same bootstrap as the hardening harness). Create `docs/phase-7.md`.

- [ ] **Step 1:** Harness scenarios (assert against real Mongo+Redis):
  - PO create draft → receive → `qtyOnHand += Σqty`, one `purchase` movement per product, status `received`, immutable (second receive rejected).
  - Concurrent double-receive of one draft PO → exactly one succeeds; stock added once.
  - Adjustment: positive adds + movement; negative below zero rejected (guard); movement written for a valid negative.
  - **Ledger reconciliation:** after receive+sale+void+adjust, `qtyOnHand === Σ StockMovement.qtyDelta`.
  - Low-stock report returns exactly rows with `reorderPoint > 0 && qtyOnHand <= reorderPoint`.
  - Authz: stylist read Inventory ok; manager manage Supplier ok (assert via ability, mirroring existing spec tests) — covered in Task 6.1.
- [ ] **Step 2:** Rebuild api `dist` (`pnpm --filter @salon/api exec tsc -p tsconfig.build.json`); run harness → all pass.
- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → all green.
- [ ] **Step 4:** Write `docs/phase-7.md` (What was built / Decisions / Verification / Follow-ups), matching the phase-6 doc style; update `README.md` phase list.
- [ ] **Step 5: Commit** `feat: Phase 7 — Inventory & Suppliers` (+ docs).

---

## Self-review notes

- **Spec coverage:** Supplier ✓(5.1) · StockMovement ✓(2.1,3.1) · PurchaseOrder ✓(2.1,5.1) · StockAdjustment ✓(2.1,4.1) · reorderPoint ✓(2.1,4.1) · applyStockDelta ✓(3.1) · PO lifecycle ✓(5.1) · POS retrofit ✓(7.1) · authz ✓(6.1) · API ✓(4.1,5.1) · admin ✓(8.1) · shared helpers/DTOs ✓(1.1,1.2) · testing ✓(1.1,6.1,9.1) · deferrals not built ✓.
- **Type consistency:** `applyStockDelta(StockModels, params, session)` signature identical across Tasks 3.1/4.1/5.1/7.1; `purchaseOrderTotal`/`isLowStock` names consistent 1.1↔4.1/5.1; `refType` values `'sale'|'purchase_order'|'adjustment'` consistent across 2.1/3.1/5.1/7.1.
- **Placeholder scan:** none — each task names exact files, interfaces, and the non-obvious code; boilerplate (controllers/mappers/modules/admin pages) is pattern-referenced to a named existing file, per "follow established patterns."
