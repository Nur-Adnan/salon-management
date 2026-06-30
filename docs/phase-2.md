# Phase 2 — Service & Product Catalog

What the salon sells: services, products, categories, and packages.

## What was built

**Shared contract.** `LocalizedName {en, bn?}`, a `moneySchema` (integer poisha,
tax-exclusive), and Zod schemas for service/product categories, services, products,
and packages (+ partial update variants). Pricing value objects `componentsTotal` /
`packageSavings` with a self-check test.

**Catalog domain (api).** Five tenant-scoped collections — `ServiceCategory`,
`Service` (duration, before/after buffers, price, taxable, eligible resource types),
`ProductCategory`, `Product` (sku, barcode, retail/cost, taxable, expiry flag), and
`Package` (items, price, validity). Reusable embedded value objects `MoneyEmbed` and
`LocalizedName`. Each entity uses the Phase-1 `TenantScopedRepository`, so the catalog
is automatically tenant-isolated.

**Endpoints.** Full CRUD under `/catalog/*` for service-categories, services,
product-categories, products, and packages. Packages return a computed
`componentTotal` + `savings` (resolved from the referenced services/products) and
reject references to unknown items (400).

**Authorization.** New CASL subject `Catalog`: owner/manager **manage**;
receptionist/stylist/accountant/read_only **read**.

**Admin UI.** Services, Products, and Packages pages (bilingual EN/BN names,
price/duration editors, category select + inline category create, multi-select
package builder), wired through the Phase-1 server-action + authenticated API client.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Catalog scope | **Tenant-level** (not branch-scoped) | One catalog shared by all branches. Per-branch price overrides deferred to Phase 8 (blueprint says revisit there). |
| Tax model | Prices are **tax-exclusive** + a `taxable` flag | The POS tax engine (Phase 4) adds tax; keeps catalog prices clean. |
| Names | `LocalizedName {en (required), bn?}` | Bilingual catalog without per-field locale tables. |
| Uniqueness | sku + barcode unique **per tenant**, only among non-deleted docs (partial index) | A soft-deleted sku/barcode can be reused; barcode optional via `$type:'string'`. |
| Package items | reference services/products by id; prices resolved at read time | Single source of truth for prices; the package stores only its own discounted price. |
| Eligible staff | deferred to Phase 3 | Staff-service eligibility belongs with scheduling, not "what the salon sells". |

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared 12 + api 15 = 27) ·
  `pnpm build` 4/4 — all green.
- **Live catalog e2e (16/16)** against local Mongo + Redis: service/product/package
  CRUD, **duplicate barcode → 409**, **duplicate sku → 409**, **package componentTotal
  = 170000 / savings = 20000** (500+1200 BDT components vs a 1500 BDT package),
  unknown-item package → 400, **stylist reads catalog but cannot create (CASL 403)**,
  outsider blocked from another tenant's catalog (403), and a new tenant's catalog is
  empty (isolation).
- The admin catalog pages build (`next build`); live Supabase login still needs a real
  project to exercise them end-to-end in a browser.

## Follow-ups

- Image upload for services/products needs the Phase-0 storage service (signed URLs) —
  deferred.
- Per-branch price overrides (Phase 8).

## Next: Phase 3 — Scheduling & Calendar.
