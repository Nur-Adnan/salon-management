# Security Architecture & Hardening Guide

## 1. Authentication & Identity
- **Supabase Authentication**: Acts as Identity Provider (IdP) for internal salon staff, cashiers, managers, and owners.
- **RS256 / ES256 JWKS Verification**: Production validates JWTs against Supabase public keys via `jwks-rsa`.
- **Customer Portal Authentication**:
  - Phone-based OTP authentication with 6-digit cryptographic verification.
  - Dedicated `client` JWT signed with scoped claims (`tenantId`, `customerId`).
  - Separated from staff credentials; clients cannot authenticate to staff APIs.

## 2. Authorization & RBAC Matrix (CASL)
Role-based access control is enforced declaratively using CASL abilities:
| Role | Organization & Branches | Catalog & Services | Calendar & Bookings | POS & Sales | Staff & Payroll | Inventory & PO |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Full manage | Full manage | Full manage | Full manage | Full manage | Full manage |
| **Manager** | Read Org, Manage Branches | Full manage | Full manage | Full manage | Full manage | Full manage |
| **Accountant** | Read only | Read only | Read only | Read only | Manage Payroll runs | Read only |
| **Receptionist** | Read only | Read only | Manage Bookings | Manage POS | Self attendance only | Read only |
| **Stylist** | Read only | Read only | Update assigned appts | Read own sales | Self attendance only | Read only |
| **Client** | Read public salon | Read public services | Own appointments only | View own invoices | None | None |

## 3. IDOR & Multi-Tenant Isolation
- **Storage Protection**: S3/R2 presigned upload/download endpoints enforce keys strictly prefixed with `tenants/${tenantId}/`. Requests containing path traversal (`..` or `//`) or mismatched tenant prefixes are rejected with `403 Forbidden` / `400 Bad Request`.
- **Client Portal Scoping**: All operations (`/profile`, `/appointments/:id/cancel`) explicitly match `{ tenantId, customerId }`. Accessing another customer's ID returns a generic `404 Not Found` without leaking record existence.

## 4. Distributed Rate Limiting
- **Redis Sliding-Window Log**: Prevents brute-force attacks and resource exhaustion across distributed instances.
- **Protected Surface**:
  - `POST /public/:slug/portal/auth/request-otp`: Max 5 requests / 5 minutes per IP.
  - `POST /public/:slug/portal/auth/verify-otp`: Max 10 attempts / 5 minutes per IP.
  - `POST /public/:slug/:branchId/appointments`: Max 10 bookings / minute per IP.
  - `POST /payments/webhooks/*`: Max 120 webhooks / minute.
- **Response Headers**: Returns standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After: <seconds>` on `429 Too Many Requests`.

## 5. Webhook Security & Idempotency
- **Cryptographic Signature Verification**:
  - bKash: HMAC-SHA256 signature verification with `BKASH_WEBHOOK_SECRET`.
  - Nagad: RSA SHA256 public key verification.
  - SSLCommerz: MD5 IPN hash verification with `store_passwd` and secondary server-to-server validation call.
- **Replay Protection**:
  - Redis distributed lock on `webhook:processed:${provider}:${id}` with 24-hour expiration (`set(..., 'NX')`).
  - Durable unique index in MongoDB on `PaymentTransactionSchema.index({ tenantId: 1, method: 1, providerRef: 1 }, { unique: true })`.

## 6. Sensitive Data Redaction
- Pino logger automatically redacts sensitive fields from HTTP logs:
  - `req.headers.authorization`
  - `req.headers.cookie`
  - `req.body.password`
  - `req.body.cardNumber`
  - `req.body.cvv`
  - `req.body.pin`
  - `req.body.otp`
- Raw credit card numbers and CVV codes are NEVER stored in the database.
