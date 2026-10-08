# Comprehensive Testing Strategy & Quality Assurance Framework

## 1. Quality Objectives & Test Pyramid

Our testing framework ensures enterprise reliability across the modular monolith, preventing regressions, concurrency bugs, and financial discrepancies.

```
                  ┌──────────────────────┐
                  │    E2E & Security    │
                  │   Workflows (Play-   │
                  │  wright / Supertest) │
                  ├──────────────────────┤
                  │  Integration Tests   │
                  │  (MongoDB rs0/Redis  │
                  │   Transactional Txn) │
                  ├──────────────────────┤
                  │      Unit Tests      │
                  │ (Money math, CASL,   │
                  │  Slots, Commission,  │
                  │   Stock Math, FEFO)  │
                  └──────────────────────┘
```

---

## 2. Test Suites & Coverage Requirements

### 2.1 Unit Tests (`packages/shared` & Domain Utilities)
- **Zero-Dependency Math & Logic**:
  - `money.test.ts`: Addition, subtraction, multiplication, percentage calculation, rounding (integer minor units).
  - `pricing.test.ts`: Components total, package savings, branch price override resolution.
  - `hr.test.ts`: Tiered commission calculation, overtime, break deductions, payroll summaries.
  - `inventory.test.ts`: FEFO batch selection, stock delta checks, moving weighted-average COGS.
  - `appointment-status.test.ts`: Valid and forbidden appointment state transitions.
  - `crm.test.ts`: Loyalty earn/redeem math, gift card balance guards, subscription billing state derivation.
  - `reporting.test.ts`: `safeRate`, date range bucket math.

### 2.2 Integration Tests (`apps/api`)
- **Database & Concurrency Invariants**:
  - **Double Booking Guarantee**: Concurrent reservation attempts on the same slot must result in exactly one winner and one 409 conflict.
  - **Non-Negative Stock Invariant**: Concurrent decrements exceeding `qtyOnHand` must throw 409 and abort without creating movement rows.
  - **Atomic Ledger Updates**: Ensure `StockMovement`, `LoyaltyLedgerEntry`, and `StaffEarningEntry` rows match balance caches.
  - **Transaction Reversal on Void**: Verify full refund voids synchronously debit loyalty, reset referrals to pending, and restock inventory.
  - **Queue Processors**: Verify BullMQ job processing, retries with exponential backoff, and dead-letter queue routing.

### 2.3 Security & Multi-Tenancy Tests
- **Tenant Boundary Isolation**:
  - Verify that a user from Tenant A cannot access, query, or modify resources belonging to Tenant B (cross-tenant IDOR).
  - Verify that a receptionist cannot perform manager actions (e.g. modify staff compensation or issue payroll).
  - Verify that public booking endpoints reject invalid tenant slugs or cross-branch injections.
  - Verify that authenticated clients in the self-service portal cannot access another client's appointments, subscriptions, or loyalty points.

### 2.4 End-to-End User Flow Tests
- Flow 1: Client books online -> appointment created -> slot reserved -> reminder queued.
- Flow 2: Receptionist checks in client -> stylist completes service -> POS rings up sale -> payment captured -> loyalty points awarded -> inventory decremented.
- Flow 3: Manager reviews daily sales & staff performance reports -> verifies rollup metrics.

---

## 3. Test Execution & CI Automation

```bash
# Run complete test suite across monorepo
pnpm turbo run test --force

# Run specific workspace tests
pnpm --filter @salon/shared test
pnpm --filter @salon/api test
```
- **Pre-commit & CI Gates**:
  - Typecheck: 0 errors (`tsc --noEmit`)
  - Lint: 0 errors (`eslint .`)
  - Tests: 100% pass rate
  - Secret scan: gitleaks verification
