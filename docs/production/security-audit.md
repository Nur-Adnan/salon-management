# System Security Audit & Hardening Analysis

## 1. Threat Model & Security Posture (STRIDE)

| Threat Category | Potential Risk / Vector | Existing Defense | Required Hardening |
|---|---|---|---|
| **Spoofing** | Forged JWTs or unauthorized tenant assumption | Supabase JWT verification with pinned `aud` and `iss` in production (`supabase-jwt.strategy.ts`). | Pin audience/issuer strictly. Implement client JWT strategy for public portal clients with short expirations and refresh rotation. |
| **Tampering** | Man-in-the-middle or webhook replay from payment gateways | HTTPS / TLS termination, `Idempotency-Key` on mutation routes. | Implement cryptographic HMAC-SHA256 signature verification on bKash, Nagad, and SSLCommerz webhooks. Validate timestamp window to prevent replay attacks. |
| **Repudiation** | Denied transactions, inventory updates, or payroll payouts | Immutable append-only ledgers: `StockMovement`, `LoyaltyLedgerEntry`, `GiftCardLedgerEntry`, `StaffEarningEntry`, `Payslip`. AuditModule logs events. | Add `audit_logs` collection for security-critical actions (privilege changes, payment webhooks, stock adjustments, portal logins). |
| **Information Disclosure** | Cross-tenant data leakage (IDOR), sensitive fields in logs | `TenantScopedRepository` enforces `{ tenantId, deletedAt: null }`. Pino redacts `authorization` and `cookie`. RFC 7807 hides 5xx error stacks. | Review all aggregation pipelines (e.g. `ReportsService`) and ensure `tenantId` is always the first filter stage. Implement signed presigned URLs for private media/PDFs. |
| **Denial of Service** | Abuse of public booking `/public/:slug/*` or login brute force | Helmet headers enabled. | Deploy Redis-backed rate limiting with IP and tenant tiers. Limit concurrency on heavy aggregation reports and async exports. |
| **Elevation of Privilege** | Stylist or receptionist performing owner/manager actions | CASL ability evaluation via `AbilitiesGuard` on controllers. Scope verification against `Membership` in `scope.resolver.ts`. | Add automated authorization regression tests verifying each role cannot access forbidden routes. |

---

## 2. Multi-Tenant Isolation Review

### 2.1 Enforced Patterns
- **Repository Level**: Base `TenantScopedRepository` injects `tenantId` into every find, update, create, and soft-delete operation.
- **Service Level**: Domain services (`sales.service.ts`, `booking.service.ts`, etc.) validate that referenced entities (customers, services, staff, branches) belong to the active tenant in `ctx.get()`.
- **Database Level**: Indexes on tenant collections start with `tenantId: 1`.

### 2.2 Critical Isolation Risks & Mitigations
1. **Public Booking Endpoints (`/public/:slug/*`)**:
   - Must resolve `tenantId` from slug and branch ID strictly.
   - Must prevent cross-tenant lookup of services, staff, and appointments.
2. **Client Portal Endpoints**:
   - Must restrict queries not only by `tenantId` but by verified `customerId` extracted from authenticated client credentials.
3. **Reports & Aggregations**:
   - `ReportsService` queries must unconditionally include `$match: { tenantId }` as their first pipeline stage before any `$lookup` or `$group`.

---

## 3. OWASP Top 10 & API Security Review

1. **A01: Broken Access Control**:
   - All private routes protected by `JwtAuthGuard` and `AbilitiesGuard`.
   - CASL rules explicitly forbid receptionists and stylists from managing compensation, payroll, or viewing reports.
2. **A02: Cryptographic Failures**:
   - Passwords and auth tokens managed by Supabase IdP.
   - Secret keys (`SUPABASE_JWT_SECRET`, Redis passwords, payment API keys) managed strictly via environment variables validated by Zod at startup.
   - All payment credentials and webhook signatures verified with standard crypto (`node:crypto`).
3. **A03: Injection**:
   - MongoDB queries constructed via typed Mongoose objects; no raw JavaScript evaluation or unsanitized `$where` operators.
4. **A04: Insecure Design**:
   - Integer minor units (poisha) prevent floating-point drift.
   - Atomic transactions enforce double-booking prevention and stock consistency.
5. **A05: Security Misconfiguration**:
   - Helmet enabled in `apps/api/src/main.ts`.
   - Strict CORS origin allowlist (`WEB_ORIGINS`).
   - Production requires `SUPABASE_JWKS_URL` or non-default `SUPABASE_JWT_SECRET`.
6. **A07: Identification and Authentication Failures**:
   - Disabled accounts (`user.status === 'disabled'`) are blocked immediately at guard level.
7. **A08: Software and Data Integrity Failures**:
   - `pnpm-workspace.yaml` enforces supply-chain protection: `blockExoticSubdeps: true`, `trustPolicy: no-downgrade`.

---

## 4. Webhook & Payment Security

1. **Webhook Security Architecture**:
   - Webhooks are idempotent: duplicate notifications with the same transaction reference return cached/acknowledged status without re-executing business logic.
   - Never trust client-side redirect results; transactions remain `pending` until verified server-side with provider API or HMAC-signed webhook.
   - Safe parsing of incoming payloads with Zod before processing.
