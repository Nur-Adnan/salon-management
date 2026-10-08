# Stage H Roadmap — Phase 14: Production Integrations & Hardening

## 1. Objective
Elevate the core platform to true enterprise production readiness by implementing robust third-party payment rails (bKash, Nagad, SSLCommerz) with signature-verified webhooks, tokenized recurring subscription billing, distributed Redis rate limiting, S3/R2 presigned object storage, full-stack observability (metrics, tracing, sanitized logs), and comprehensive database indexing.

## 2. Payment Gateway Architecture
```
Client / POS Checkout
         ↓
PaymentGateway (`apps/api/src/pos/payment/`)
         ├── BkashAdapter (Create Payment, Execute Payment, Query, Refund, Webhook)
         ├── NagadAdapter (Init, Verify, Decrypt Callback, Signature Check)
         ├── SslCommerzAdapter (Session Init, IPN Validation, Validation API, Refund)
         └── SandboxAdapter (Dev/test fallback when credentials unset)
```
- **Guarantees**:
  - Zero trust of client payment outcome: State must be confirmed via server-to-server query or cryptographic webhook.
  - Zero storage of raw card PAN or CVV/CVC.
  - Replay protection via Redis unique nonce / idempotent invoice locks.
  - Safe error recovery: Network timeouts query payment state before declaring failure.

## 3. Recurring Billing
- Tokenized agreements with recurring billing profiles for subscriptions.
- Automatic renewal scheduler executing 24 hours prior to expiration with retry backoff (3 attempts over 5 days) before entering grace period / cancellation.

## 4. Distributed Rate Limiting
- **Technology**: Redis sliding-window counter (`RateLimitService` + `RateLimitGuard`).
- **Tiers**:
  - Public Booking / Search: 60 requests / minute per IP.
  - OTP Requests: 3 requests / 15 minutes per phone/IP.
  - OTP Verification: 5 attempts / 15 minutes per phone/IP.
  - POS Checkout & Payments: 30 requests / minute per staff session.
- **Headers**: Standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

## 5. Object Storage (S3 / Cloudflare R2)
- Service: `StorageService` (`apps/api/src/common/storage/storage.service.ts`).
- Operations:
  - Generate Presigned Upload URL: Validates tenant ID, content-type (JPEG, PNG, WebP, PDF only), max file size (10 MB).
  - Key Scheme: `tenants/{tenantId}/{category}/{uuid}.{ext}`.
  - Presigned Download URL: Expiring private access (15 minutes).
  - Delete Object: Secure removal upon customer/staff data cleanup.

## 6. Observability & Sanitization
- **Metrics**: Prometheus metrics export (`/metrics`) tracking HTTP request durations, response code histograms, active WebSocket connections, queue wait/processing latencies.
- **Tracing**: Inbound `x-correlation-id` passed to downstream services, database logs, and BullMQ jobs.
- **Redaction**: Strict regex/field sanitizer ensuring passwords, OTPs, JWT tokens, bKash/Nagad secrets, and customer PII are redacted from pino logs.
- **Health Probes**:
  - `GET /health/liveness`: Basic process health check.
  - `GET /health/readiness`: Deep verification of MongoDB replica set, Redis connectivity, and BullMQ workers.

## 7. Database Hardening & Indexing
- Compound indexes for high-throughput queries:
  - Appointments: `{ tenantId: 1, branchId: 1, 'timeSlot.startUtc': 1 }`
  - Sales: `{ tenantId: 1, branchId: 1, createdAt: -1 }`
  - Customers: `{ tenantId: 1, phone: 1 }` (unique)
  - StockLevel: `{ tenantId: 1, branchId: 1, productId: 1 }` (unique)
  - DailyRollup: `{ tenantId: 1, branchId: 1, date: 1 }` (unique)
