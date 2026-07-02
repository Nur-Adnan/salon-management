# Phase 3 — Scheduling & Calendar

The heart of the product: appointments without double-booking.

## What was built

**Concurrency-safe booking.** Every appointment line occupies a set of 15-minute
**slot reservations** (one doc per staff-slot and per resource-slot). A **unique
index** `{tenantId, branchId, holderType, holderId, slotStart}` makes a double-book
a hard, atomic impossibility — two racing bookings for the same slot cannot both
insert; the loser gets `E11000`. The appointment + all its reservations commit in a
**Mongo transaction** (replica set), so it is all-or-nothing.

**Availability engine** (luxon, timezone/DST-aware): free start times for a
staff+service on a local date, respecting working hours, service duration, buffers,
existing reservations, and "no past slots".

**Status machine** (`booked → confirmed → checked_in → in_service → completed`, with
`no_show`/`cancelled` branches) enforced in shared + the API; cancel/no-show/complete
**release the slots**. Emits `AppointmentCreated/Cancelled/Completed` (audit
subscribes; reminders in Phase 10, analytics in Phase 11).

**Reschedule** re-validates conflicts transactionally (delete old reservations →
save new lines → insert new reservations; conflict → rollback, 409).

**Resource auto-assignment**: a service with `eligibleResourceTypes` gets the first
free eligible resource; the unique index still guarantees no resource double-book.

**Minimal Customer** (name/phone, find-or-create by phone) — booking needs one; the
full CRM is Phase 5. **Branch** gained `slotMinutes` + weekly `workingHours`
(`PATCH /branches/:id/schedule`).

**Public booking** (unauthenticated, per-tenant by slug): `/public/:slug`,
`/public/:slug/:branchId/{services,staff,availability}`, and
`POST .../appointments` (source `online`) — resolves the tenant from the slug and
sets the request context manually.

**Admin calendar** (day view, walk-in create with availability picker, status
transition buttons, waitlist) and the **public booking flow**
(service → staff → slot → details → confirm) in the `booking` app.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Conflict strategy | **Slot-reservation docs + unique index**, inside a transaction | The unique index is the *hard* guarantee (atomic, concurrency-proof); the transaction adds all-or-nothing across the appointment + its slots. Verified by a 12-way concurrent load test. |
| Slot granularity | 15 min, per-branch configurable | Standard salon grid; buffers extend the reserved window `[start−before, end+after)`. |
| Timezone/DST | luxon | tz/DST math is not a "few lines" job; an established, focused lib. |
| Customer | Minimal now (name/phone) | Booking needs a customer; the full CRM aggregate is Phase 5. |
| Public API | Unauthenticated, tenant-by-slug, context set manually | The public booking site has no staff login; still tenant-scoped. Rate-limiting deferred to Phase 14. |
| Multi-line | Supported in the schema; lines share one status | Sequential multi-service chaining UI is a later enhancement. |
| Reschedule/status | `POST` with `@HttpCode(200)` | They mutate an existing appointment (200), not create (201). |

## Verification

- `pnpm typecheck` 6/6 · `pnpm lint` 6/6 · `pnpm test` (shared + api slot/status unit
  tests) · `pnpm build` 4/4.
- **Live e2e (27/27)** against a **single-node replica set** + Redis:
  - **Concurrency: 12 simultaneous bookings for the same staff+slot → exactly 1
    wins, 11 get 409.** (The headline acceptance — double-booking is impossible.)
  - Availability reflects bookings; respects duration/buffers/hours/timezone.
  - Resource auto-assign + resource conflict (409 when the only chair is taken).
  - Reschedule → 200 and frees the old slot; status machine (legal 200 / illegal 400);
    working-hours guard (400 outside hours).
  - Public booking flow end-to-end (services → staff → availability → book, source
    `online`); admin routes still require auth (401 without token).
- Frontend verified by `next build`; live Supabase login still needs a real project.

## Follow-ups
- Load-test at scale (thousands/day) and add rate-limiting on public booking (Phase 14).
- Deposit/booking-fee capture is a hook (`depositAmount`); real payment is Phase 4.
- Staff-specific schedules + service→eligible-staff (Phase 6).

## Next: Phase 4 — POS & Billing (completes the MVP).
