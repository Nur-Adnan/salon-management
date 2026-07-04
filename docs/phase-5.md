# Phase 5 — CRM

Customer relationships and retention: loyalty, gift cards, coupons, referrals,
memberships, and treatment records — all wired into the Phase 4 POS.

## What was built

**Ledger-derived balances, structurally non-negative.** Every balance (loyalty
points, gift-card value, a coupon's redemption count) is mutated by exactly one
kind of operation: a single atomic `findOneAndUpdate` filtered on
`balance: { $gte: amount }` (see `apps/api/src/crm/ledger.util.ts`). Two
concurrent debits against the same balance can never both succeed past zero —
MongoDB only applies the second once the first's effect is visible, and if the
filter no longer matches, the second gets nothing. This is the same pattern
Phase 3 used for slot-reservation uniqueness and Phase 4 used for stock
decrement, applied here to money balances. **Verified by three separate
concurrency races** (10-way loyalty, 10-way gift-card, 6-way single-use coupon)
in the live e2e — in every case exactly one contender wins and the balance
lands at exactly zero, never negative.

**LoyaltyAccount** — per-spend earn (1 point per ৳20 / 2,000 poisha of net
spend, i.e. subtotal − discount, excluding tax/tip), 1 point = ৳1 redemption.
Earn happens via a `SaleCompleted` event subscriber (best-effort, same
tradeoff the audit log already made in Phase 0/1 — the money itself is
transactional, earning bonus points is not load-bearing enough to justify
blocking checkout on it). Redemption is a POS payment method (`loyalty`,
whole-taka amounts only) and — unlike earning — happens **synchronously inside
the checkout transaction**, because an insufficient-balance redemption must
abort the sale, not silently under-collect.

**GiftCard** — code + balance, same atomic-debit guarantee, redeemed as a POS
payment method (`gift_card`, the card code carried in `providerRef`). Checking
`status: 'active'` and `expiresAt` in the same atomic filter means an expired
or cancelled card fails redemption in one operation, no separate validation
step to race against.

**Coupon** — `percent` (basis points) or `fixed` (minor units), optional
`minSpend`/`maxDiscount`/`maxRedemptions`/active window. The discount is
computed by `applyCoupon` (`packages/shared/src/crm.ts`): it distributes the
coupon's discount **pro-rata across lines by each line's current net amount,
capped at that line's own net headroom** (so a thin-headroom line can never be
asked to absorb more than it has), on top of (not replacing) any manual
per-line discount, so tax is recomputed correctly per line on the reduced
base — no separate "coupon discount" field, it's already inside each line's
`discount`/`tax`. Redemption-count is claimed with the same atomic guard,
inside the checkout transaction, and only when the coupon actually changed
something — so a single-use coupon is single-use under concurrency and can't
be burned for zero benefit on an already-fully-discounted cart.

**Referral** — a lazily-generated shareable code per customer
(`POST /customers/:id/referral-code`, most customers never need one so it
isn't generated at creation). Reward (100 loyalty points) is granted on the
referred customer's **first completed sale**, via the same `SaleCompleted`
handler — implemented as an atomic `status: 'pending' → 'rewarded'` transition,
which is itself the idempotency guard (a second sale, or an accidental event
replay, finds no `'pending'` referral left to reward).

**Subscription** — `SubscriptionPlan` (price, billing period, an *advertised*
`discountBps` perk — see Decisions) + `CustomerSubscription`. **Renewal is
manual only** and reuses Phase 4's checkout path exactly (`SalesService.
checkout()` with a new `subscription` sale-line kind) — same idempotency key,
same transaction, same invoice numbering, zero new payment-capture code. A
subscription's `current/due/grace/lapsed` billing state is **computed on
read** from `nextBillingDate` (`subscriptionBillingState` in
`packages/shared`), never stored or job-flipped.

**TreatmentRecord** — color formula, notes, allergies, per-visit history.
Before/after photos carry a **real consent state machine**
(`pending → granted/declined`, `granted → revoked`, either → re-`granted`),
not a boolean: a photo is born `pending` (the create schema has no consent
field at all — the API cannot create an already-granted photo), consent has a
`scope` (`clinical_record` vs `marketing` — consenting to one never implies
the other), and revoking preserves the original grant's audit trail
(`grantedAt`/`method`/`recordedBy` untouched; only `revokedAt`/`revokedBy` set).
Every transition is validated server-side against the state machine — never a
free-form PATCH.

**Customer 360** (`GET /customers/:id/profile`) — aggregates appointments,
sales, treatments, loyalty balance, gift cards, subscriptions (with computed
billing state), and a **ledger-derived due balance**
(`Σ (sale.total − captured payments)` across non-voided sales) in one call.

**Customer profile extensions** — `preferredStaffId`, `preferenceNotes`,
persistent `allergies` (distinct from a single treatment visit's notes),
lazily-generated `referralCode`.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Loyalty earn/redeem rate | 1 pt / ৳20 net spend; 1 pt = ৳1 | A flat "5% back", no conversion table to explain at the counter; net spend (not tax/tip) is what the business actually wants to reward. |
| Payment capture ordering | gift-card/loyalty debits happen **inside** the checkout transaction, not before it | If the sale never commits, a balance must never have been touched. Mirrors the existing stock-decrement pattern. |
| Coupon discount application | Pro-rata across lines, computed in `applyCoupon`, feeding the *existing* `lineTotals`/`saleTotals` engine unchanged | Tax must be computed on the post-coupon net per line; a sale-level-only discount field would get tax wrong on mixed-tax-rate carts. |
| Subscription billing trigger | **Manual renew only** (reuses checkout); billing state is **computed, never a scheduled job** | No payment method in this system supports stored-card/tokenized auto-charge (Phase 4's adapters are sandbox, call-time-only, and auto-approve *anything* — a scheduled auto-bill job would silently write fake `captured` payments). A real reminder/auto-charge job is a clean Phase 10/14 follow-up once tokenized billing exists; building the scheduling infra now for a status enum I can just compute would be premature. |
| Photo consent | State machine + `scope`, not a boolean; default-deny on creation; one transition endpoint | "Consent to keep this in the chart" and "consent to use this in marketing" are different permissions in practice; a photo must never be born usable. |
| Referral reward timing | On the referred customer's first **completed sale**, not at referral creation | Prevents "refer a burner customer" abuse; ties the reward to real revenue, consistent with the loyalty program's own philosophy. |
| Subscription perk (`discountBps`) | Advertised plan metadata only, **not** auto-applied at checkout | Stacking a membership discount with coupon logic (order of application, interaction with `maxDiscount`) is real design surface the acceptance criteria doesn't require; wire it in deliberately later rather than half-build the stacking rules now. |
| Module boundary | `PosModule` re-registers CRM schemas directly (matching how it already re-registers Service/Product/Branch/Customer) and exports `SalesService`; `CrmModule` imports `PosModule` for the one thing it needs (subscription renew) | One-directional dependency, no circular module import, consistent with every prior phase's cross-module model-sharing convention. |

## Adversarial review

Before calling this phase done, a 4-dimension adversarial review (money/ledger
correctness, concurrency/transaction correctness, tenant security, POS-wiring
edge cases) was run against the diff, then every finding was independently
re-verified against the actual code (not just re-asserted) before being
trusted. **18 findings were raised; all 18 survived verification.** All were
fixed and are covered by new regression tests:

| # | Finding | Fix |
|---|---------|-----|
| 1 (critical) | `voidSale()` checked `sale.status` via a plain read *before* the transaction, then reversed balances with unconditional `$inc` — two concurrent (or duplicated) void requests could both pass the check and both reverse stock/gift-card/loyalty balances. | The status transition itself is now the atomic guard: `findOneAndUpdate({status:'completed'}, {$set:{status:'voided'}}, {new:false})` as the *first* operation inside the transaction. Only one call can ever match; a second returns `null` and cleanly 400s instead of double-reversing. |
| 2 (critical) | That same guard was gated on `p.status`, an in-memory field the callback itself mutates — if MongoDB auto-retried the transaction (a real, driver-documented behavior on a transient conflict), the retry would see its own prior attempt's mutation and skip the reversal, while still committing `status:'voided'`. | The pre-update snapshot (`new:false`) is read fresh from the DB on every attempt, never from a JS object carried across a retry. |
| 3 (critical) | `addPayments()` had **no idempotency protection at all** — no interceptor, no key — while capturing real money (gift-card/loyalty debits, gateway charges). A retried request captured twice. | Added `Idempotency-Key` header + `IdempotencyInterceptor` (Redis fast path) **and** a DB-durable guard: the key is stamped on the `Payment` subdocument itself, so a replay is detected and no-oped even without Redis. |
| 4 (critical) | `addPayments()` also fetched `sale` *before* its transaction and pushed onto that same in-memory array inside the retryable callback — a driver retry would push a second time even though only one attempt's writes actually commit. | `sale` is now fetched fresh *inside* the transaction callback on every attempt. |
| 5 (high) | The `{tenantId, saleId, type}` unique index meant to make loyalty **earn** idempotent also (accidentally) capped **redeem** at one-per-sale-ever — a legitimate second redemption (checkout, then more via `addPayments` to clear a due balance) hit an uncaught duplicate-key 500. | Scoped the partial-unique index to `type:'earn'` only; `redeem`/`adjust` are no longer constrained to one-per-sale. |
| 6 (high) | `LoyaltyService.adjust()`, `GiftCardsService.issue()`, `ReferralsService.rewardIfPending()` wrote a balance and its ledger entry as two independent, non-transactional calls — contradicting the schema's own "written in lockstep" comment. | All three now wrap both writes in `session.withTransaction()`, matching the pattern `SalesService` already used. |
| 7 (high) | A retried `subscriptions.renew()` (same idempotency key) correctly got the *same* sale back from `checkout()`, but unconditionally advanced the billing period again — a free extra period per replay. | `checkout()` now returns `{ sale, wasReplayed }`; `renew()` only advances the period when `wasReplayed` is false. |
| 8 (medium) | `applyCoupon()` could hand the last-eligible line more of the flooring remainder than that line's own net headroom, silently shaved off by `lineTotals`' gross-clamp — the coupon under-delivered a poisha or two with no error. | Rewrote the distribution as floor-then-headroom-capped-remainder; a regression test reproduces the exact adversarial scenario. |
| 9 (medium) | A coupon applied to an already-fully-discounted (zero-net) cart was correctly a no-op discount-wise, but `checkout()` still claimed a redemption slot — a shared single-use code could be burned for zero benefit. | The redemption is only claimed when `applyCoupon` actually changed the pricing lines (checked by reference identity). |
| 10 (medium) | `voidSale()` recomputed loyalty points *per payment*, but `capturePayments()` only guarantees the *sum* of loyalty lines is a whole-taka amount — a legitimately captured multi-line loyalty payment could make `void()` throw and the sale become permanently un-voidable. | The reversal now sums all captured loyalty payments first, then converts once — mirroring how the forward path already worked. |
| 11 (medium) | `subscriptions.subscribe()` created a `CustomerSubscription` for any syntactically-valid `customerId` with no check it belongs to the tenant. | Validated via `CustomerRepository.findById` (tenant-scoped), same pattern `SalesService.resolveCustomer` already used. |
| 12 (medium) | `TreatmentRecordsService.create()` had the same gap — clinical/consent data attached to an unverified customer id. | Same fix. |
| 13 (medium) | A `'subscription'` sale line could be rung up via a bare `POST /sales` (taking payment with no entitlement created), and symmetrically `subscribe()` granted entitlement with no payment — two independent, uncoordinated paths. | `checkout()` now takes `opts.allowSubscriptionLines`, set only by `SubscriptionsService.renew()`; a direct client request with `kind:'subscription'` is rejected. |
| 14 (low) | `nextInvoiceNumber()` incremented the counter *before* the transaction started; an aborted transaction (insufficient balance, exhausted coupon, lost idempotency race) permanently burned that number, leaving a gap. | The counter increment now happens inside the transaction, rolling back with everything else on abort. |
| 15–16 (low) | `LoyaltyService`/`GiftCardsService.issue()` accepted an unvalidated `customerId` the same way (10/11 above, lower blast radius). | Same validation added for consistency. |
| — (medium, accepted) | `PaymentGateway.charge()` runs inside the retryable transaction callback; today's sandbox providers are stateless so a retry is harmless, but a *future* real SDK call (Phase 14) would double-charge on a driver retry unless called with a provider-side idempotency key. | No code change — today's providers have no side effects to duplicate. Documented as a Phase 14 constraint at the call site and in Follow-ups below. |

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared **50**, incl. 21
  CRM math/state-machine tests + 13 POS tests; api 19) · `pnpm build` 4/4
  (new routes: `/customers`, `/customers/[id]`, `/gift-cards`, `/coupons`,
  `/subscription-plans` all compiled).
- **Live e2e — 101/101** against a single-node replica set + Redis (73
  feature-coverage checks + 28 regression checks targeting each fix above —
  double-void race, addPayments replay/concurrency, the loosened loyalty
  index, subscription-renew replay, the zero-effect-coupon burn, and every
  newly-validated `customerId` path):
  - **Loyalty**: earn on sale completion, manual adjust (credit/debit, debit
    beyond balance rejected), whole-taka-only redemption, insufficient balance
    rejected, anonymous (no-customer) redemption rejected, **10-way concurrent
    redemption race → exactly one wins, balance lands at exactly zero**.
  - **Gift card**: issue, redeem, overdraw/unknown-code/cancelled-card
    rejected, **10-way concurrent redemption race → exactly one wins, balance
    exactly zero**.
  - **Coupon**: fixed + percent, min-spend rejection, exact pro-rata discount
    + tax recomputation verified to the poisha, case-insensitive code,
    **6-way concurrent race for a single-use coupon → exactly one claims it,
    `redeemedCount` exactly 1**.
  - **Referral**: self-referral rejected, duplicate referral rejected, reward
    fires on the referred customer's first sale only (second sale is a no-op —
    verified idempotent), referral status flips to `rewarded`.
  - **Subscription**: subscribe → `current` billing state, manual renew
    produces a real invoice via the checkout path, period advances, cancelled
    subscriptions can't be renewed.
  - **Treatment/consent**: photo born `pending`, illegal transitions rejected
    (`pending→revoked`, `declined→revoked`, grant-without-scope), legal
    transitions succeed and preserve the grant audit trail through a revoke.
  - **Void** reverses a sale's gift-card debit back to the exact original
    balance.
  - **Customer 360**: aggregates real sales/appointments/treatments; due
    balance is exactly `total − captured` for an unpaid `due`-method sale and
    exactly zero otherwise.
  - Auth/authz: unauthenticated → 401; a stylist can log treatments and read
    loyalty but cannot manage coupons or adjust loyalty (403).
- Frontend verified by `next build`; a full authenticated browser click-through
  needs a real Supabase project (same documented limitation as Phases 3–4).

## Follow-ups
- Real reminder/notification dispatch for subscriptions (Phase 10) once
  tokenized/recurring billing exists (Phase 14) to make auto-charge honest.
- Phase 14's real payment SDKs (bKash/card/SSLCommerz) must be called with a
  provider-side idempotency key — `capturePayments()` runs inside a retryable
  Mongo transaction, and today's stateless sandbox providers hide that a
  driver-level retry would otherwise re-issue a real charge.
- Subscription `discountBps` perk auto-applied at POS checkout, with an
  explicit stacking order against coupons.
- Photo storage/upload (currently a URL string only, matching Phase 4's
  invoice-PDF deferral for the same reason — no object-storage seam yet).
- Gift-card/coupon send campaigns, audience segmentation (`Campaign` in the
  blueprint's domain model) — out of scope for this phase's CRM core.
- Partial refunds (`voidSale` is still whole-sale-only, matching the same
  scoping decision Phase 4 made).

## Next: Phase 6 — Staff & HR (attendance, commission, payroll, tips).
