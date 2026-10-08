# Architecture Overview — Salon & Spa Management Platform

## 1. Executive Architectural Summary
The system is built as a high-performance **modular monolith** in TypeScript, designed for multi-tenant, multi-branch beauty salons, spas, and wellness centers operating primarily in South Asia (Bangladesh) with internationalization readiness.

```
                          ┌───────────────────────────┐
                          │   Client / Browser        │
                          └─────────────┬─────────────┘
                                        │
                       HTTPS / WSS      │  CDN / Reverse Proxy
                                        ▼
    ┌───────────────────────┬───────────────────────┬───────────────────────┐
    │     apps/booking      │      apps/admin       │       apps/api        │
    │  (Next.js 16 Portal)  │  (Next.js 16 Admin)   │   (NestJS 11 Core)    │
    └───────────────────────┴───────────────────────┴───────────┬───────────┘
                                                                │
           ┌───────────────────────┬────────────────────────────┼───────────────────────────┐
           ▼                       ▼                            ▼                           ▼
    ┌─────────────┐         ┌─────────────┐              ┌─────────────┐             ┌─────────────┐
    │  MongoDB    │         │ Redis 7+    │              │  BullMQ     │             │ Object Store│
    │  (ReplSet)  │         │ (Tokens/RL) │              │  (Queues)   │             │ (S3 / R2)   │
    └─────────────┘         └─────────────┘              └─────────────┘             └─────────────┘
```

## 2. Core Tenancy & Data Isolation Model
- **Logical Multi-Tenancy**: Every entity is scoped by `tenantId: Types.ObjectId` (representing an Organization).
- **Branch Scoping**: Location-sensitive operations (appointments, inventory, shift attendance, cash drawers) are scoped by `branchId: Types.ObjectId`.
- **AsyncLocalStorage Context**: The `ContextMiddleware` populates `RequestContextService` per HTTP request from either JWT claims or verified slug resolution.
- **Repository Scoping & Query Enforcement**: All queries (`find`, `findOneAndUpdate`, aggregations) explicitly bind `{ tenantId }` in the filter predicate.
- **Strict IDOR Prevention**: Customer portal endpoints enforce matching `{ tenantId, customerId }`, returning `404 Not Found` if a customer attempts to query resources belonging to another user.

## 3. Financial Integrity & Integer Accounting
- **Poisha Minor Units**: All monetary values are strictly represented in integer minor units (1 BDT = 100 poisha). Float drift is structurally impossible.
- **Auditable Double-Entry & Ledgers**:
  - Loyalty points balance is derived from append-only `LoyaltyLedgerEntry` records.
  - Gift card balances are modified atomically and tracked via `GiftCardLedgerEntry`.
  - Commission earnings and tips are immutably logged in `StaffEarningEntry`.
  - Inventory movements and COGS adjustments are audited via `StockMovement`.
- **Historical Receipt Immutability**:
  - `SaleLine` items snapshot the exact name, tax rate, unit price, and discount at checkout time. Subsequent catalog modifications never alter historical receipts.

## 4. Background Processing & Distributed Queues
- **BullMQ Architecture**:
  - `notification` queue: dispatches customer SMS, WhatsApp, and email messages via provider-independent adapters.
  - `reminder` queue: executes scheduled appointment reminders (24h and 2h before), subscription renewal reminders, and gift card expiration alerts with duplicate detection.
  - `campaign` queue: processes bulk customer marketing broadcasts asynchronously with opt-out enforcement and rate limiting.
- **Fault Tolerance**:
  - Exponential backoff retry policies (`attempts: 3`).
  - Idempotency key tracking in Redis (`set(key, 1, 'EX', 86400, 'NX')`).

## 5. Real-Time Data Synchronization
- **WebSocket Gateway**: NestJS `@WebSocketGateway({ namespace: '/events' })` powered by Socket.IO.
- **Room Isolation**: Clients join strictly authorized rooms:
  - `tenant:{tenantId}:branch:{branchId}:calendar` (appointment created, rescheduled, cancelled)
  - `tenant:{tenantId}:branch:{branchId}:pos` (sale completed, refunded)
  - `tenant:{tenantId}:branch:{branchId}:queue` (walk-in queue entries)
- **Zero Global Broadcasts**: Cross-tenant data leakage is cryptographically and logically prohibited.

## 6. Payment Abstraction & Provider Adapters
- Independent gateway interface supporting:
  - **Cash & Card**: Counter settle with terminal reference.
  - **bKash**: Tokenized checkout, webhook HMAC-SHA256 signature verification, recurring agreements.
  - **Nagad**: Merchant checkout, RSA SHA256 signature verification.
  - **SSLCommerz**: Session initiation, Instant Payment Notification (IPN) MD5 hash validation, and tokenized rebill.
  - **Loyalty & Gift Cards**: Ledger-backed debits with strict zero/positive balance constraints.
