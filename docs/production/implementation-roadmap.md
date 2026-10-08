# Enterprise Production Implementation Roadmap

## 1. Roadmap Strategy & Dependency Sequence

The implementation is executed in strict dependency order, ensuring each domain layer builds on hardened and verified predecessors:

```
[ Stage A: Full System Audit ]
              │
              ▼
[ Stage B: Deferred Domain Refinements ]
(Staff shifts, branch pricing, commission tiers, FEFO batch stock)
              │
              ▼
[ Stage C: Phase 10 — Notifications & Reminders ]
(BullMQ workers, notification abstraction, SMS/WhatsApp/Email, anti-duplicate)
              │
              ▼
[ Stage D: Phase 9 — Marketing & Campaigns ]
(Customer segmentation, campaign engine, consent/opt-out, delivery tracking)
              │
              ▼
[ Stage E: Phase 11 — Analytics & Enterprise Reporting ]
(Materialized rollups, forecasting, async CSV/Excel/PDF exports)
              │
              ▼
[ Stage F: Phase 12 — Real-Time Sync ]
(NestJS Socket.IO gateway, calendar events, walk-in queue, POS coordination)
              │
              ▼
[ Stage G: Phase 13 — Client Self-Service Portal ]
(Client authentication, booking/rescheduling/cancellation, loyalty/subs, mobile UI)
              │
              ▼
[ Stage H: Phase 14 — Production Integrations & Hardening ]
(bKash/Nagad/SSLCommerz, tokenized billing, rate limiting, S3/R2 storage, health/metrics)
              │
              ▼
[ Stage I: Full-System Production Audit & Verification ]
(Hostile audit, full regression test suite, zero-defect verification, deployment checklist)
```

---

## 2. Stage Breakdown & Deliverables

### Stage A — Full System Audit (Completed)
- Documented complete architecture, database schemas, APIs, security, and gaps.
- Created audit suite in `docs/production/`.

### Stage B — Deferred Domain Refinements
- **Scheduling**:
  - Add `StaffShift` schema and model (individual shift times, day-of-week working hours, break windows, leave dates).
  - Add service-to-staff eligibility mapping (`staff.eligibleServices` or `service.eligibleStaff`).
  - Upgrade `availability.service.ts` to compute intersection of:
    - Branch working hours
    - Staff shift schedule & working hours
    - Staff breaks & approved leaves
    - Service eligibility
    - Existing `SlotReservation` records
  - Ensure timezone safety via Luxon in branch timezone.
- **Catalog**:
  - Add `BranchPriceOverride` schema supporting service and product branch-specific pricing.
  - Implement effective pricing resolution with fallback to base catalog price.
  - Guarantee historical price immutability in POS `SaleLine` items.
- **HR / Commission**:
  - Upgrade `StaffCompensation` with tiered commission brackets (`CommissionTier`), per-service overrides, and fixed commission amounts.
  - Implement break deductions and overtime calculations on `AttendanceRecord`.
  - Ensure deterministic and auditable payroll period calculations in `payroll.service.ts`.
- **Inventory**:
  - Add `StockBatch` schema (`batchNumber`, `expiryDate`, `qtyOnHand`, `unitCost`).
  - Implement FEFO (First-Expired, First-Out) consumption in stock decrement paths.
  - Implement inter-branch stock transfers (`StockTransfer`: draft -> in_transit -> received).
  - Calculate moving weighted-average COGS.

### Stage C — Phase 10 — Notifications & Reminders
- Implement real BullMQ queue processor in `apps/api/src/queue/processors/notification.processor.ts`.
- Notification provider abstraction (`NotificationService` -> SMS, WhatsApp, Email adapters).
- Appointment reminders scheduled at 24 hours and 2 hours before start time.
- Cancellation and reschedule handling (cancel pending jobs, reschedule gracefully).
- Subscription notifications (upcoming renewal, renewal failed, grace period).
- Gift card expiration warnings.
- Idempotency and deduplication keys preventing double dispatch.

### Stage D — Phase 9 — Marketing & Campaigns
- Customer segmentation engine:
  - Total spend, average order value, visit frequency, last visit recency, inactive days.
  - Loyalty tier, active subscription, preferred branch, service categories.
- Campaign engine:
  - Targeted coupons, promotional gift cards, seasonal broadcast messages.
  - Audience snapshot generation before dispatch.
  - Queue-backed asynchronous delivery with batching and rate limiting.
  - Opt-out/unsubscribe tracking and consent verification.

### Stage E — Phase 11 — Analytics & Enterprise Reporting
- Background materialized rollups (`DailyMetricRollup`, `MonthlyMetricRollup`) by branch and organization.
- Rollup calculation worker: sales, net revenue, discounts, tax, tip, appointments, cancellations, no-shows, new vs returning customers.
- Cohort retention and churn calculations.
- Explainable sales forecasting using moving averages and seasonality estimates.
- Asynchronous exports (CSV, Excel, PDF) dispatched via queue with signed download links.

### Stage F — Phase 12 — Real-Time Sync
- NestJS Socket.IO gateway (`apps/api/src/realtime/realtime.gateway.ts`).
- WebSocket authentication via JWT and room segregation: `tenant:{tenantId}:branch:{branchId}`.
- Live event broadcasts:
  - Calendar updates on booking, rescheduling, status transition, and cancellation.
  - Walk-in queue position updates and status changes.
  - POS live order and payment status updates.
- Auto-reconnect handling and stale client cleanup.

### Stage G — Phase 13 — Client Self-Service Portal
- Client authentication: Phone OTP / Email Magic Link / Supabase client session.
- Secure client portal routes in `apps/booking/app/[slug]/portal`.
- Mobile-first responsive UI:
  - My Appointments (upcoming, past, reschedule, cancel within allowed cancellation window).
  - Loyalty Balance & Activity history.
  - Active Subscriptions & benefits usage.
  - Gift Cards balance and code lookup.
  - Profile & contact preferences.
- Strict IDOR prevention: clients can only read/mutate their own customer record.

### Stage H — Phase 14 — Production Integrations & Hardening
- **Payment Providers**:
  - Live adapters for bKash, Nagad, and SSLCommerz.
  - Webhook endpoints with HMAC signature validation, replay protection, and idempotency.
  - Two-phase payment state machine: `pending` -> `captured` / `failed` / `reversed`.
  - Automated reconciliation and payment audit log.
- **Rate Limiting**:
  - Redis-backed distributed rate limiting protecting `/public/:slug/*`, auth endpoints, and webhooks.
- **Multi-Tenant Security**:
  - Automated tenant boundary penetration tests and IDOR checks.
- **Object Storage**:
  - S3 / Cloudflare R2 client abstraction for treatment photos and invoice PDFs with presigned URLs.
- **Observability**:
  - Health checks (liveness, readiness), metrics, structured request/correlation IDs, error tracking.

### Stage I — Full-System Production Audit & Verification
- Hostile adversarial production review.
- Full automated test suite verification (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`).
- Documentation suite finalized and deployment readiness verdict issued.
