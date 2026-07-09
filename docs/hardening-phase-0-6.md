# Hardening pass — phases 0–6 audit & fixes

Before starting Phase 7, the whole codebase (phases 0–6) was re-audited with a
multi-agent adversarial review: one deep reader per module (IAM, Catalog,
Scheduling, POS, CRM, HR, shared math) plus a reviewer on the two most recent
commits, then an **independent** verifier tried to refute every candidate
finding. **14 defects were raised and all 14 survived independent
re-verification** (0 refuted). This pass fixes all 14. The static toolchain and
the money/ledger/concurrency invariants were otherwise confirmed intact.

The unifying theme of the serious findings: the **"earn" side of every reward is
created asynchronously** (post-commit, best-effort via `SaleCompleted`), and the
matching clawback on **void** was either missing or racy. Invariant #7 of this
codebase is that any reversal with overpayment risk must be **synchronous inside
the originating transaction** — the fixes make that true for every reward type.

## Findings & fixes

| # | Sev | Area | Finding | Fix |
|---|-----|------|---------|-----|
| 1 | High | POS/CRM | Loyalty points **earned** for a sale were never reversed on void. `SaleVoided` is published but has **no handler**; `voidSale` reversed only loyalty *redemptions*. A full-refund void left ~5% of net spend as redeemable points. | `reverseLoyaltyEarnForSale` ([crm/ledger.util.ts](../apps/api/src/crm/ledger.util.ts)) called **synchronously** inside `voidSale`'s transaction. Unconditional debit (may go negative if already redeemed — the honest position; the `balance >= n` redemption guard still prevents overdraw). |
| 2 | High | Scheduling | `AppointmentsService.transition()` was read-then-write with no atomic guard and no transaction. Two legal-from-the-same-source transitions (e.g. `checked_in→in_service` racing `checked_in→cancelled`) could both commit last-write-wins, leaving an **active appointment with its slot reservations deleted** — defeating the headline no-double-book guarantee. | Wrapped in a transaction; the status flip is an atomic `findOneAndUpdate` filtered on the **exact source status** validated against, and the releasing `deleteMany` runs in the same txn. Only one transition off a given status can win. ([appointments.service.ts](../apps/api/src/scheduling/appointments.service.ts)) |
| 3 | High | HR | Commission/tip **void-before-earn** race. Phase-6's review claimed finding #1a was closed by making the reversal synchronous, but a synchronous reversal cannot negate entries that don't exist yet: a void that beats the async earn handler reverses nothing, then the handler lands positive entries on the voided sale → next payroll overpays. | The earn handler now returns early when `sale.status !== 'completed'`. Combined with the (already synchronous) `reverseStaffEarningsForSale`, both orderings are closed. ([hr/events/sale-completed.handler.ts](../apps/api/src/hr/events/sale-completed.handler.ts)) |
| 4 | Medium | CRM | Referral reward not reversed on void, **and** the referral was permanently stuck `rewarded` (its pending→rewarded flip is the only idempotency guard), so a later genuine sale by the same customer could never re-reward. Dual harm. | Referral now records the triggering `rewardedSaleId`. `reverseReferralRewardForSale` ([crm/ledger.util.ts](../apps/api/src/crm/ledger.util.ts)) runs synchronously in `voidSale`: resets the referral to `pending` (re-earnable) and debits the referrer. |
| 5 | Medium | Scheduling | `reschedule()` checked terminal status only **before** its transaction; a concurrent cancel/complete could leave a terminal appointment holding the freshly-inserted reservations (a permanently blocked slot). | The lines-write is now an atomic `findOneAndUpdate` guarded on `status ∉ TERMINAL_STATUSES` **inside** the txn; a no-match aborts the reschedule. ([booking.service.ts](../apps/api/src/scheduling/booking.service.ts)) |
| 6 | Medium | POS | Checkout stock decrement was an unconditional `$inc`, allowing **negative stock** (invariant #2). | Guarded `qtyOnHand >= qty` in the filter, like the loyalty/gift-card debits. A tracked row with insufficient stock blocks the sale (409); an **untracked** product (no stock row) stays sellable, preserving prior behavior. ([sales.service.ts](../apps/api/src/pos/sales.service.ts)) |
| 7 | Low | CRM | Concurrent subscription renews with **distinct** idempotency keys double-charged but advanced the period only once (lost update on `nextBillingDate`). | Period advance is now an atomic `findOneAndUpdate` guarded on the unchanged `nextBillingDate`. ([subscriptions.service.ts](../apps/api/src/crm/subscriptions.service.ts)) |
| 8 | Low | Catalog | Package `componentTotal`/`savings` silently dropped soft-deleted components, understating the figures. | Surface a `missingComponents` count so a partial total is visible rather than silent. ([packages.service.ts](../apps/api/src/catalog/packages.service.ts)) |
| 9 | Low | IAM | Supabase JWT verified without audience/issuer pinning. | Pin `aud='authenticated'` and `iss=<project>/auth/v1` on the JWKS (prod) path; local HS256 dev tokens unaffected. ([supabase-jwt.strategy.ts](../apps/api/src/iam/auth/supabase-jwt.strategy.ts)) |
| 10 | Low | IAM | `User.status='disabled'` was never enforced (latent — nothing sets it yet, but the flag read as an inert control). | Auth guard rejects a disabled account. ([jwt-auth.guard.ts](../apps/api/src/iam/auth/jwt-auth.guard.ts)) |
| 11 | Low | POS | `addPayments` scoped by `tenantId` only, not `branchId` (inconsistent with checkout/get/list/void). | Added `branchId` to the scope. |
| 12 | Low | Common | Redis idempotency cache key omitted the route, so one key reused across endpoints could replay a stale body. | Key now includes `controller.handler`. ([idempotency.interceptor.ts](../apps/api/src/common/idempotency/idempotency.interceptor.ts)) |

## Residual (documented, not a regression)

The async-earn / synchronous-reversal boundary still has a **sub-millisecond
interleave** (earn handler reads `status:completed` a moment before the void
commits, then the void reverses nothing, then the earn writes). It requires a
void within the event-dispatch latency of checkout — unreachable in normal
operation (voids are a human decision seconds-to-hours later). Fully closing it
would require making the earn part of the checkout transaction, an architecture
this codebase deliberately rejected. The status guard reduces the exposure from
"reliably reproducible with a fast void" to this theoretical window.

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared 64 + api 19) · `pnpm build` 4/4.
- **Live harness — 17/17** against a single-node replica set + Redis (same rig
  the phases were verified on; harness not committed, consistent with prior
  phases' ephemeral e2e):
  - **Clawback on void (earn-first):** loyalty earn, referral reward, commission,
    tip all reverse to net zero; referral resets to `pending`; stock restored.
  - **Void-before-earn (void-first):** both async earn handlers skip a voided
    sale — no commission/tip, no loyalty earn, no referral reward.
  - **Stock:** oversell of a tracked product is blocked (no sale, stock
    unchanged); an untracked product still sells.
  - **Scheduling:** 8× concurrent `in_service`-vs-`cancelled` races — never an
    active appointment with freed slots, never a terminal appointment holding
    live reservations, always exactly one winner.

## Next: Phase 7 — Inventory & Suppliers.
