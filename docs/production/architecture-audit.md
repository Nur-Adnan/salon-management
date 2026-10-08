# Comprehensive System Architecture Audit

## 1. Executive Summary

This architecture audit evaluates the **Salon & Spa Management Platform** — a multi-tenant modular monolith consisting of:
- **`apps/api`**: NestJS 11 modular monolith with MongoDB (replica set), Redis 7, BullMQ, Mongoose 9, CQRS EventBus, and Pino logging.
- **`apps/admin`**: Next.js 16 (React 19) App Router admin portal for owners, managers, receptionists, stylists, and accountants.
- **`apps/booking`**: Next.js 16 (React 19) App Router public booking client.
- **`packages/shared`**: Zero-dependency contracts, Zod schemas, domain enums, integer minor-unit money arithmetic (`packages/shared/src/money.ts`), and pricing helpers.
- **`packages/ui`**: HeroUI v3 component library, Tailwind CSS v4 design tokens, and theme/locale providers.
- **`packages/config`**: Unified ESLint flat configuration.

Phases 0 through 8 have been implemented, incorporating a 14-defect hardening pass across POS, scheduling, CRM, and HR. However, key deferred domain refinements (staff shift schedules, branch-specific pricing, tiered/per-service commissions, batch/lot FEFO inventory) and subsequent phases (Phase 9 Campaigns, Phase 10 Notifications & Reminders, Phase 11 Enterprise Analytics, Phase 12 Real-Time Sync, Phase 13 Client Self-Service Portal, Phase 14 Production Integrations) remain to be implemented to reach full enterprise production readiness.

---

## 2. Current Architecture & Domain Boundaries

### 2.1 Domain Modules Overview
```
                         ┌────────────────────────────────────────┐
                         │               API Gateway              │
                         │ (NestJS 11, Helmet, Pino, CORS, Throttler)│
                         └───────────────────┬────────────────────┘
                                             │
      ┌────────────────┬─────────────────────┼────────────────────┬────────────────┐
      │                │                     │                    │                │
┌─────▼─────┐   ┌──────▼──────┐       ┌──────▼──────┐      ┌──────▼──────┐  ┌──────▼──────┐
│    IAM    │   │   Catalog   │       │ Scheduling  │      │     POS     │  │     CRM     │
│ Auth,CASL │   │ Services,   │       │ Appts,Slots │      │ Sales,Due,  │  │ Loyalty,    │
│ Tenancy   │   │ Products    │       │ Calendar    │      │ Payments    │  │ GiftCards   │
└─────┬─────┘   └──────┬──────┘       └──────┬──────┘      └──────┬──────┘  └──────┬──────┘
      │                │                     │                    │                │
┌─────▼─────┐   ┌──────▼──────┐       ┌──────▼──────┐      ┌──────▼──────┐  ┌──────▼──────┐
│  Staff/HR │   │  Inventory  │       │  Suppliers  │      │   Reports   │  │    Queue    │
│ Payroll,  │   │ StockLevels,│       │ POs, Vendor │      │ Aggregation │  │   BullMQ    │
│ Attendance│   │ Movements   │       │ Records     │      │ Pipelines   │  │   Workers   │
└───────────┘   └─────────────┘       └─────────────┘      └─────────────┘  └─────────────┘
```

1. **IAM Module (`apps/api/src/iam`)**:
   - **Identity Provider (IdP)**: Supabase Auth verifies JWTs (`apps/api/src/iam/auth/supabase-jwt.strategy.ts`). Audience and issuer are verified on production; dev fallbacks allow local testing.
   - **User Provisioning**: `ProvisioningService` provisions/syncs users on first valid JWT.
   - **Tenancy Scoping**: Handled via `x-tenant-id` and `x-branch-id` headers resolved against user memberships in `scope.resolver.ts`.
   - **Authorization**: CASL-based (`apps/api/src/iam/casl/ability.factory.ts`) evaluating role-based actions against domain subjects.

2. **Catalog Module (`apps/api/src/catalog`)**:
   - Manages `Service`, `Product`, `Package`, `ServiceCategory`, `ProductCategory`.
   - Prices stored in integer minor units (poisha).
   - Current limitation: Prices are global per tenant; branch-specific price overrides are deferred.

3. **Scheduling Module (`apps/api/src/scheduling`)**:
   - Manages `Appointment`, `SlotReservation`, and `Waitlist`.
   - Concurrency & double-booking protection: Guaranteed by MongoDB replica set transactions and unique index on `(tenantId, branchId, holderType, holderId, slotStart)`.
   - Current limitation: Availability evaluates branch open/close hours only; staff shifts, custom breaks, leaves, and staff service eligibility are not yet enforced in `availability.service.ts`.

4. **POS & Billing Module (`apps/api/src/pos`)**:
   - Manages `Sale`, `StockLevel`, `Counter` (invoice sequence generation `INV-000001`).
   - Supports cash, card, bKash, nagad, sslcommerz, gift card redemption, loyalty points redemption, and due balances.
   - Idempotent checkout using `Idempotency-Key` header with Redis cache.
   - Transactional clawback: Voiding a sale synchronously reverses staff earnings, referral rewards, loyalty redemption, and restocks inventory via `applyStockDelta`.
   - Current limitation: Payment gateway providers (`InstantProvider`, `DeferredProvider`) are mock sandboxes; no live webhook verification or signature validation.

5. **CRM Module (`apps/api/src/crm`)**:
   - Manages `LoyaltyAccount` & `LoyaltyLedgerEntry`, `GiftCard` & `GiftCardLedgerEntry`, `Coupon`, `CustomerSubscription`, `SubscriptionPlan`, `Referral`, `TreatmentRecord`.
   - Ledger integrity: Balances are strictly updated atomically in lockstep with ledger entries (`apps/api/src/crm/ledger.util.ts`).
   - Customer profile service (`apps/api/src/crm/customer-profile.service.ts`) aggregates cross-module customer data.
   - Current limitation: No campaign engine or automated segmentation (Phase 9); treatment photo URLs are plain strings without object storage signed URLs (Phase 14).

6. **HR & Staff Module (`apps/api/src/hr`)**:
   - Manages `StaffCompensation`, `AttendanceRecord`, `StaffEarningEntry`, `Payslip`.
   - Tracks commissions, tips, attendance hours, and generates immutable payslips.
   - Current limitation: Single flat commission rate; lacks tiered commissions, service-specific overrides, break deductions, and overtime rules.

7. **Inventory & Suppliers Module (`apps/api/src/inventory` & `apps/api/src/suppliers`)**:
   - Manages `StockLevel`, `StockMovement`, `StockAdjustment`, `Supplier`, `PurchaseOrder`.
   - Ledger cache pattern: `qtyOnHand` is a cache over immutable `StockMovement` ledger entries updated via `applyStockDelta`.
   - Purchase orders enforce immutable-on-receive semantics.
   - Current limitation: Lacks batch/lot tracking, expiry dates, FEFO consumption, inter-branch stock transfers, and weighted-average COGS.

8. **Reports Module (`apps/api/src/reports`)**:
   - On-demand MongoDB aggregation pipelines: `sales`, `staff-performance`, `inventory-value`, `appointments`, and tenant-wide `crm-liabilities`.
   - Branch-scoped, timezone-aware date bucketing.
   - Current limitation: Purely on-demand pipelines with no background rollups (Phase 11), forecasting, or asynchronous file exports (CSV/Excel/PDF).

9. **Queue Module (`apps/api/src/queue`)**:
   - Configured with BullMQ and Redis connection options.
   - Contains a sample processor proving infrastructure.
   - Current limitation: Lacks real background processors for appointment reminders, subscription notices, campaign broadcasts, and export jobs.

---

## 3. Database Architecture & Tenancy Model

### 3.1 Database Technology
- **Engine**: MongoDB 8 (Single-node replica set `rs0` for local dev/test; multi-node replica set for staging/prod).
- **Driver**: Mongoose 9.7.3.
- **Transactions**: Required across POS checkout, void clawbacks, appointment status transitions, PO receiving, and stock adjustments.

### 3.2 Tenancy Isolation Pattern
- **Logical Multi-Tenancy**: All collections share the same database. Every tenant-owned document includes `tenantId: Types.ObjectId` indexed as the first compound index key.
- **Branch Partitioning**: Branch-specific collections include `branchId: Types.ObjectId`.
- **Repository Scoping**: `TenantScopedRepository` enforces `{ tenantId, deletedAt: null }` on all reads, updates, and soft deletes.
- **Request Context**: `RequestContextService` leverages Node.js `AsyncLocalStorage` initialized in `ContextMiddleware` and populated by `JwtAuthGuard`.

---

## 4. Authentication & Authorization Architecture

1. **Authentication**:
   - Supabase Auth issues JWTs for admin and staff users.
   - `JwtAuthGuard` extracts token, verifies signature, loads/provisions user, and populates `RequestContext`.
   - Public endpoints marked with `@Public()` decorator bypass authentication (e.g. `/public/:slug/*`, `/health`, `/ping`).
   - Missing: Client authentication for customer self-service portal (OTP / phone verification / magic link).

2. **Authorization**:
   - CASL (`@casl/ability`) defines permissions per role: `owner`, `manager`, `receptionist`, `stylist`, `accountant`, `read_only`.
   - Checked via `@CheckAbilities({ action, subject })` and enforced by `AbilitiesGuard`.

---

## 5. Background Jobs & Event System

1. **Event System**:
   - `@nestjs/cqrs` `EventBus` publishes domain events (`AppointmentBooked`, `SaleCompleted`, `SaleVoided`, etc.).
   - Synchronous critical operations run in transactions; best-effort secondary concerns (e.g. async commission creation) run via event handlers.

2. **Queue Architecture**:
   - BullMQ backed by Redis (`REDIS_URL`).
   - `SampleProcessor` exists as a stub. Production requires dedicated queues:
     - `notifications`: Appointment reminders, subscription lifecycle alerts, gift card expiry.
     - `campaigns`: Marketing broadcast segmentation and delivery.
     - `reports`: Daily/monthly materialized rollups and async file generation.

---

## 6. Payment & Object Storage Architecture

1. **Payment Gateway**:
   - `PaymentGateway` currently routes to in-memory `InstantProvider` and `DeferredProvider`.
   - Production requirement: Live provider adapters for bKash, Nagad, and SSLCommerz with webhook signature validation, idempotency, retry mechanisms, and transaction reconciliation.

2. **Object Storage**:
   - Currently absent; photo URLs are arbitrary strings.
   - Production requirement: S3 / Cloudflare R2 abstraction with presigned upload/download URLs, content-type and size validation, secure bucket policies, and invoice PDF archiving.

---

## 7. Real-Time Infrastructure

- NestJS WebSocket / Socket.IO infrastructure is currently absent.
- Production requirement:
  - Gateway with JWT authentication, tenant and branch room segregation.
  - Live calendar sync on bookings/cancellations.
  - Walk-in queue live updates.
  - Live POS transaction state updates.

---

## 8. Deployment, Logging & Observability

- **Containerization**: `docker-compose.yml` provides MongoDB rs0 and Redis 7.
- **Logging**: `nestjs-pino` with correlation ID generation/forwarding (`x-correlation-id`) and tenant tagging (`x-tenant-id`). Authorization headers and cookies are redacted.
- **Health Checks**: `@nestjs/terminus` endpoint at `/health` checks MongoDB connection and Redis ping.
- **Error Handling**: `AllExceptionsFilter` converts unhandled exceptions to RFC 7807 problem+json format, masking 5xx internals.
- **Production Requirements**:
  - Multi-stage Dockerfiles for API, Admin, and Booking apps.
  - Production readiness probes (liveness, readiness, startup).
  - Rate limiting via Redis on abuse-prone endpoints.
