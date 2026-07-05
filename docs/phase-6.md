# Phase 6 — Staff & HR

Attendance, commission, tips, and payroll — all wired into the Phase 4 POS
sale lines' existing staff attribution and tip field, with no schema changes
to `Sale` required.

## What was built

**No `Staff` collection.** "Staff" is still just a `User` with an active
`Membership` (Phase 1), validated the same way `SaleLine.staffId` already was
in checkout. Compensation lives in a new, small **`StaffCompensation`**
collection (`tenantId, userId, commissionRateBps, baseSalaryMinor,
hourlyRateMinor`) rather than fields on `Membership`, because a user can hold
several `Membership` rows in one tenant (one per branch) — compensation
needs one-row-per-user cardinality, which `Membership` doesn't have.
Lazily upserted on first `PATCH /staff/:id/compensation`; unconfigured reads
as all-zero.

**Attendance** — `AttendanceRecord` (clock in/out). At most one open shift
per staff member is a **structural** invariant: a partial unique index on
`{tenantId, staffId}` where `clockOut: null`, not a read-then-write check —
the same non-negotiable pattern this codebase uses everywhere concurrency
matters. Self clock-in/out is available to any working role; clocking
*someone else* in (front-desk terminal) or correcting/removing a record
requires `manage` on `Attendance`. A manager's correction or removal is
blocked once the record has been claimed by a payroll run (`payslipId` set)
— from then on it's an immutable historical record, same as a completed
`Sale`.

**Commission + tips share one ledger.** `StaffEarningEntry` has a `kind`
(`'commission' | 'tip'`) discriminator instead of two collections, because —
unlike Loyalty/GiftCard in Phase 5, which are never consumed together —
every payroll run needs *both* summed for the same staff member in the same
pass. Entries are created by an `HrSaleCompletedHandler` subscribing to the
same `SaleCompleted` event Phase 5's loyalty-earn handler already uses:
best-effort, not inside the checkout transaction, because both amounts are
pure functions of the already-committed `Sale` document — a delayed handler
just means commission shows up a little late, never lost (the payroll claim
has no lower time bound; see Decisions). Commission is rated **once** on a
staff member's *summed* net (post-discount, pre-tax — the same base loyalty
already uses) across all their lines on one sale, not per line, so rounding
can't compound. Tips are split pro-rata by that same net, penny-exact
(`distributeTip` in `packages/shared/src/hr.ts`, the same floor-then-
remainder technique as Phase 5's `applyCoupon`, minus the headroom cap —
a tip share has no per-line ceiling to respect).

**Void reversal is synchronous, not event-driven — a deliberate asymmetry.**
Unlike the *earn* side, reversing commission/tip when a sale is voided runs
**inside `voidSale()`'s own transaction** (`hr/ledger.util.ts`,
`reverseStaffEarningsForSale`), the same way Phase 5 reverses loyalty/gift-
card balances there. A delayed *earn* is harmless (it's still correct
whenever it lands); a delayed or dropped *clawback* is a real overpayment
that nothing else corrects. The reversal is always a same-kind entry with
the **negated** amount, created unconditionally — it never branches on
whether the original was already paid out. If unclaimed, the next payroll
run sums `(+X) + (−X) = 0` for that sale (never paid, never will be); if
already paid, the unclaimed reversal surfaces as a deduction on the *next*
payslip (correctly clawing back the earlier overpayment). One code path,
no paid/unpaid special-casing.

**Payroll** — `POST /payroll/run` claims every unclaimed commission/tip entry
and every closed shift up to `periodEnd` for one staff member, sums them with
their compensation snapshot, and writes one **immutable** `Payslip`. The
claim is atomic: `updateMany` filtered on `payslipId: null` inside the same
transaction as the `Payslip` creation, so two concurrent (or accidentally
duplicated) runs can never both pay the same entry — proven by an 8-way
concurrency race in the live e2e, same rigor as Phase 5's ledger races.
Manual `adjustments` (signed — a bonus is positive, a deduction negative)
are entered at run time and become part of the snapshot. `netMinor` can be
negative (see Decisions). `POST /payroll/payslips/:id/mark-paid` records a
disbursement note; the actual transfer mechanism is out of scope, same as
POS never executes a real bank transfer either.

**Authorization** — three new CASL subjects (`Staff`, `Attendance`,
`Payroll`). CASL here only checks subject+action, not "whose record" — every
route also runs `assertSelfOrManage`/`canViewAll` (`hr/authz.util.ts`): a
caller can always act on their own record; acting on someone else's requires
either `manage` on the subject (owner/manager/receptionist, depending on the
subject) or a blanket `read('all')` grant (accountant, read_only) for *read*
paths only — `read('all')` can never grant write power, because the write
routes are gated by `create`/`update`/`manage` at the global ability guard,
which a blanket-read role never has.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Commission base | Net (post-discount, pre-tax), summed per staff member across a sale before rating | Same principle as loyalty earn: tax isn't the business's money to share, and a rate applied to tax would compute the wrong number. Rating once on the sum (not per line) avoids compounding rounding error. |
| Tip allocation | Pro-rata by each attributed staff member's net share of the sale, not pooled evenly and not 100%-to-one | A multi-service ticket should reward whoever did more of the work; pooling evenly would be wrong the moment a sale has an un-attributed retail line alongside a service line. Penny-exact via the same floor-then-remainder technique as `applyCoupon`. |
| Compensation rate model | Flat `commissionRateBps` + `baseSalaryMinor` + `hourlyRateMinor` per staff member, no tiered/per-service rule engine | The blueprint's domain model sketches a `CommissionRule` engine (flat/percent/tiered/per-service, with conditions) — real scope, not detailed enough to build correctly in one pass. The three flat numbers compose (commission-only, salary-only, hybrid, all simultaneously) without a redundant `payType` discriminator, and satisfy the acceptance bar ("commission recomputes deterministically, payroll totals reconcile") without speculating on a rule shape nobody has asked for yet. Tiered/per-service rates are a natural additive extension later, not a rebuild. |
| Void-time reversal | Synchronous, inside `voidSale()`'s transaction — not the async `SaleVoided` event | Caught in review: the original design put BOTH creation and reversal on the best-effort event bus. A delayed/dropped reversal is a real overpayment with no self-correction; a delayed/dropped earn is recoverable (the next payroll claim has no lower time bound). Matches Phase 5's own asymmetry exactly (loyalty/gift-card reversal is transactional; only the earn side is best-effort). |
| Payroll claim window | No lower bound — `createdAt < periodEnd` / `clockOut < periodEnd`, `payslipId: null` | `periodStart` is a reporting label only. A straggler entry from event-processing lag must always surface on the *next* run rather than being silently lost forever if strictly bounded to "its" period. The `payslipId` claim guard (not a date range) is what prevents double-payment across overlapping runs. |
| Payroll "locking" | Implicit — a `Payslip` has no update path once created; `paidAt` distinguishes issued vs. disbursed | The blueprint calls for an explicit lockable status. A separate draft-preview-then-lock workflow is real added surface (what does an unlocked, editable payroll run even mean once entries are claimed?) that nothing here requires; immutable-on-create already satisfies "locked periods are immutable" without a redundant status enum. |
| Incentives / deductions | One signed `adjustments` array on the payroll-run input, not separate incentive and deduction concepts | A label + a signed amount covers both; two parallel mechanisms for the same shape would be needless. |
| Attendance breaks | Handled implicitly — clock out, then clock back in later the same day | No break sub-schema was added. Paid hours are simply the sum of *closed* shifts; a lunch break is just a gap between two shifts that was never clocked. Matches "the ladder": no new structure for something the existing clock-in/out primitive already expresses. |
| Module boundary | `PosModule` re-registers `StaffEarningEntry` directly (for the synchronous void reversal); `HrModule` re-registers `Sale`/`Membership` directly and imports `IamModule` only for `AbilityFactory` | Same one-directional, no-circular-import convention as Phase 5 (`PosModule` re-registers CRM schemas; `CrmModule` imports `PosModule` only for `SalesService`). `HrModule` never imports `PosModule` or vice versa — only schema-level sharing. |
| Deferred from Phase 3 | "Staff-specific schedules + service→eligible-staff" (`docs/phase-3.md`'s own follow-up) is **not** part of this phase | It's staff-adjacent but a scheduling/booking-availability concern, not attendance/commission/payroll/tips — the four things this phase was actually scoped to (see `docs/phase-5.md`'s "Next"). Left as an explicit follow-up rather than silently dropped or silently absorbed. |

## Adversarial review

Before calling this phase done, a focused review (single independent
reviewer, not the multi-agent workflow Phase 5 used — that requires an
explicit opt-in this session didn't have) was run against the diff,
specifically targeting transaction-retry safety, claim atomicity, event-
consumer idempotency, the void-reversal design, and the new self-vs-manage
authorization helper. Two real issues were found and fixed before this phase
was reported done, plus one caught earlier through my own tracing while
writing the e2e assertions:

| # | Finding | Fix |
|---|---------|-----|
| 1 (medium) | Commission/tip void-reversal ran on the async `SaleVoided` event, same as creation. Two concrete failure modes: (a) if a sale were voided before the `SaleCompleted` handler finished creating entries, the reversal pass would find nothing to reverse, and the entries created moments later would never be clawed back; (b) if the reversal handler itself threw, the only handling was a `logger.warn` — permanently lost, no retry. | Moved the reversal into `voidSale()`'s own transaction (`hr/ledger.util.ts`), synchronous and atomic with the void itself — mirroring how Phase 5 already reverses loyalty/gift-card balances there. The async `SaleVoided` handler was deleted (redundant once the sync path is authoritative). |
| 2 (low) | The `stylist` role had `read('Payroll')` (their own earnings/payslips) but no `read('Attendance')` — asymmetric with the otherwise-parallel self-service grants, and left `AttendanceService.list()`'s self-scoping branch unreachable by any role. | Added `can('read', 'Attendance')` to the stylist role. |
| 3 (low) | `AttendanceService.update()` built `{ $set: {} }` for a no-op `PATCH` with an empty body — MongoDB rejects a literal empty `$set`. | Guarded: an empty patch now fetches and returns the current record instead of issuing the update. |
| — (defense-in-depth) | Payroll's two claim re-queries (`find({ payslipId })`) omitted `tenantId` — harmless today (a fresh unique ObjectId per run), but a deviation from "always scope by tenant." | Added `tenantId` to both. |
| (caught pre-review) | `assertSelfOrManage`/`canViewAll` initially only recognized `manage` on a subject as "broader than self" — the accountant role's deliberate `read('all')` (no `manage`) couldn't view anyone else's compensation/attendance/payroll, and the "omit staffId → show everyone" branches in `AttendanceService.list()`/`PayrollService` defaulted a manager's own unfiltered query down to just their own (empty) records. | `canViewAll()` now also recognizes `read('all')` for read paths; verified this can't leak write power (write routes are gated by `create`/`update`/`manage`, which a blanket-read role never has). |

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared **64**, incl. 14
  new HR math/distribution tests; api 19) · `pnpm build` 4/4 (new routes:
  `/attendance`, `/payroll`, extended `/team`, all compiled).
- **Live e2e — 57/57** against a single-node replica set + Redis:
  - **Compensation**: unknown-staffId rejected, owner sets rates, a stylist
    cannot set their own (or anyone's) compensation, a stylist can read only
    their own, a receptionist has no Staff access at all.
  - **Commission**: correct 10%/5% of net for two different staff members'
    rates on the same and different sales; zero for an un-attributed line.
  - **Tips**: full amount to a sole attributed staff member; exact pro-rata
    split (penny-verified to sum identically to the sale's tip) across two
    staff members with different net shares.
  - **Void reversal**: nets to exactly zero across a sale's commission+tip
    entries **with no wait** (proving the reversal is genuinely synchronous,
    not a race against an async handler).
  - **Attendance**: self clock-in/out, duplicate clock-in rejected,
    **10-way concurrent clock-in race for one staff member → exactly one
    succeeds**, a stylist cannot clock someone else in, a receptionist can,
    manager correction and no-open-shift clock-out rejection.
  - **Payroll**: a receptionist cannot run payroll; an owner's run
    reconciles exactly (hours × rate, net-of-reversal commission/tips,
    signed adjustments, gross/net identity); re-running the *exact* same
    period is rejected; **8-way concurrent payroll run for one unclaimed
    period → exactly one succeeds**, reconciling to the same totals
    regardless of which request won; mark-paid and double-mark-paid
    rejection; a stylist's payslip list is scoped to their own.
  - **Blanket-visibility roles**: an accountant can process payroll and read
    (not set) compensation, and — the specific authz gap this phase's review
    caught — sees earnings/payslips/attendance for **multiple** staff
    members with no `staffId` filter, not just their own.
- Frontend verified by `next build`; a full authenticated browser click-
  through needs a real Supabase project (same documented limitation as
  Phases 3–5).

## Follow-ups

- Tiered/per-service commission rates (the blueprint's fuller `CommissionRule`
  concept) — the flat per-staff rate shipped here is a deliberate v1; a
  rule engine is additive, not a rebuild.
- Staff-specific working hours + service→eligible-staff (deferred from
  Phase 3, staff-adjacent but a booking-availability concern, not HR).
- Hourly pay currently has no overtime/break-deduction policy — it's a raw
  sum of closed-shift hours × rate. A real policy is a follow-up once one
  is actually needed.
- Attendance has no `source` field (kiosk/mobile/web) — meaningless with
  only one client today; add when a second one exists.
- Actual payroll disbursement (bank transfer / mobile wallet payout) is out
  of scope, same as Phase 4/5 never executed a real payment — `mark-paid`
  is a record, not a transfer.

## Next: Phase 7 — Inventory & Suppliers.
