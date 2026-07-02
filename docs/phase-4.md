# Phase 4 — POS & Billing

Take money for services + products in one transaction. Completes the MVP (0–4):
a salon can now authenticate, define its catalog, book appointments, **and bill**.

## What was built

**Server-authoritative pricing engine** (`packages/shared/src/pos.ts`, pure + unit
tested). The frontend never computes money — it previews with the same functions,
but the API recomputes every total from the catalog. All integer poisha:

```
line:  gross = unitPrice × qty ;  net = gross − discount (clamped ≥ 0)
       tax  = taxable ? round(net × vatRateBps / 10000) : 0
sale:  total = subtotal − discount + tax + tip        (the invoice identity)
```

**Sale aggregate** — mixed `service | product | package` lines, each snapshotting
the catalog item (name + unit price + taxable + tax rate) at sale time so a receipt
stays historically accurate. Per-line discount + staff attribution (drives Phase 6
commission), sale-level tip, computed `subtotal/discount/tax/tip/total`.

**Idempotent checkout — two guarantees.** A replayed `Idempotency-Key`:
1. **Redis fast path** — the `IdempotencyInterceptor` replays the cached response.
2. **DB unique index** `{tenantId, idempotencyKey}` — the *hard* guarantee: even if
   Redis is down or two identical requests race, only one sale can be inserted; the
   loser reads back the winner. Verified by an 8-way concurrent same-key load test →
   one sale, one stock decrement.

**Atomic stock decrement.** Checkout writes the sale **and** decrements each tracked
product's `StockLevel` inside one Mongo transaction (replica set) — all-or-nothing.
Untracked products (no stock row yet) are skipped, so inventory is opt-in. Void
re-increments in the same atomic way.

**Tax/VAT engine** — a single branch VAT rate (`vatRateBps`, e.g. 1500 = 15%,
default 0 = not registered) applied per taxable line, captured onto the line so a
later rate change never rewrites history. Prices are tax-exclusive (VAT added on top).

**Payments** — `PaymentProvider` interface + a `PaymentGateway` registry with
adapters for `cash, card, bkash, nagad, sslcommerz` (sandbox, auto-approve) and
`gift_card, due` (recorded but not captured — redemption is Phase 5). Split payments
supported; `paymentStatus` is derived (`unpaid | partial | paid`) from captured
amount vs total. `POST /sales/:id/payments` tops up a partial/due sale.

**Void** — `POST /sales/:id/void` reverses stock + marks captured payments
`reversed`, transactionally. Partial refunds are deferred.

**Barcode scan-to-add** — `GET /catalog/products/barcode/:code` resolves a scan to a
product; the POS screen adds it to the cart.

**Minimal inventory** — `GET/PUT /inventory/stock` seeds per-branch qty-on-hand.
Full Inventory (batches, movements, reorder, purchase orders) is Phase 7.

**Frontend** — POS screen (catalog picker + barcode scan, cart with qty/discount/
staff, live totals, customer link, tip, split payment, receipt) and a daily Sales
view (per-day summary with per-method breakdown; void action).

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Money authority | Prices/tax computed **server-side** from the catalog; client sends only kind/ref/qty/discount/tip | The client is never trusted with money. Discount + tip are cashier inputs, so those come from the client. |
| Idempotency | Redis replay **+** unique index `{tenantId, idempotencyKey}` | Redis is the fast path but best-effort; the DB index is the correctness guarantee (survives a Redis outage and races). |
| Tax model | **Single** branch VAT rate, per-line application, rate captured on the line | Covers the common BD case now; the per-line field leaves room for multi-rate later without a migration. |
| Rounding | **Half-up per line** (`round(net × bps / 10000)`) | Standard for itemized invoices; line-level rounding keeps each line's tax self-consistent. Unit tested. |
| Stock decrement | **In the checkout transaction** (not via event), tracked products only | Acceptance says "atomically"; an event is eventually-consistent. `SaleCompleted` still fires for downstream (inventory movements/reorder → Phase 7, commission → Phase 6, analytics → Phase 11). |
| Refund/void | **Whole-sale void** now (atomic reversal); partial refunds later | Void is the table-stakes money-integrity op and exercises the reversal path; partial refunds add scope without MVP value. |
| Customer | Optional — anonymous walk-in or link an existing customer | POS shouldn't create CRM records (dup-by-phone); customer creation is the calendar/CRM's job (Phase 5). |
| Invoice PDF | Structured receipt data on the sale (bilingual item names, `INV-000001`); **no PDF** | No object-storage seam exists yet; the frontend prints from the sale. PDF-to-storage is deferred. |
| Providers | Interface + sandbox adapters (auto-approve) | Real bKash/Nagad/SSLCommerz SDK + webhook capture need credentials/network; the seam is real, the network call is the Phase-14 swap. |

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared **29** incl. 13 POS
  math tests + api 19) · `pnpm build` 4/4 (`/pos`, `/sales` compiled).
- **Live e2e (38/38)** against a single-node replica set + Redis:
  - **Invoice math** — mixed svc/product/package + discount + tip, exact
    `subtotal/discount/tax/total`, and the identity `total = subtotal − discount +
    tax + tip`.
  - **Idempotency** — replayed key → same invoice, **no** second stock decrement,
    exactly one sale.
  - **Concurrency** — 8 simultaneous same-key checkouts → one invoice, one sale.
  - **Atomic stock** — 10 → 8 on sale of 2, unchanged on replay, → 10 on void.
  - **Split payments** reconcile to total (paid); partial → add payment → paid;
    bKash captured with a provider ref.
  - **Tax** — taxable @15% with half-up rounding; non-taxable line → zero tax.
  - **Void** reverses stock + payments; re-void → 400.
  - Barcode lookup (hit + 404); daily summary excludes voided; unknown ref → 400;
    auth 401; stylist create → 403, read → 200.

## Follow-ups
- Real payment-provider integration + webhook capture; partial refunds (Phase 14 / later).
- Invoice PDF to object storage; bilingual (en/bn) printed receipt template.
- `SaleCompleted` consumers: stock movements + reorder (Phase 7), commission (Phase 6), revenue analytics (Phase 11).
- Gift-card / coupon redemption wired into the payment + discount hooks (Phase 5).

## Next: Phase 5 — CRM (loyalty, memberships, gift cards, customer 360).
