# Production API Reference

## 1. Public Booking API (`/public/:slug/*`)
Unauthenticated client-facing routes scoped by organization slug.
- `GET /public/:slug`: Retrieve salon profile, active branches, and timezones.
- `GET /public/:slug/:branchId/services`: List available catalog services, durations, and pricing in poisha.
- `GET /public/:slug/:branchId/staff`: List active practitioners.
- `GET /public/:slug/:branchId/availability?staffId=...&serviceId=...&date=YYYY-MM-DD`: Compute real-time available booking slots respecting branch hours, individual shift schedules, existing appointments, breaks, and buffer times.
- `POST /public/:slug/:branchId/appointments`: Book an appointment online (rate limited to 10 req/min).

## 2. Client Self-Service Portal (`/public/:slug/portal/*`)
Phone-authenticated customer management portal.
- `POST /public/:slug/portal/auth/request-otp`: Request 6-digit OTP via SMS (rate limited: 5 req / 5 min).
- `POST /public/:slug/portal/auth/verify-otp`: Validate OTP and receive scoped client JWT.
- `GET /public/:slug/portal/profile`: View customer profile, loyalty balance, and active gift cards.
- `PATCH /public/:slug/portal/profile`: Update customer name, email, and marketing opt-out status.
- `GET /public/:slug/portal/appointments/upcoming`: List upcoming appointments.
- `GET /public/:slug/portal/appointments/history`: List past appointments and treatment records.
- `POST /public/:slug/portal/appointments/:id/cancel`: Cancel an appointment (enforces 2-hour minimum notice cutoff).
- `POST /public/:slug/portal/appointments/:id/reschedule`: Reschedule an appointment to a new slot.
- `GET /public/:slug/portal/loyalty`: View loyalty point balance, tier status, and transaction history.
- `GET /public/:slug/portal/subscriptions`: View active memberships and renewal billing dates.
- `GET /public/:slug/portal/gift-cards`: View digital gift card codes, balances, and expiration dates.

## 3. Payment Gateway Webhooks (`/payments/*`)
- `POST /payments/webhooks/bkash`: bKash IPN callback (validates HMAC-SHA256 signature, idempotently updates payment state).
- `POST /payments/webhooks/nagad`: Nagad callback (validates RSA SHA256 signature, triggers server-side status verification).
- `POST /payments/webhooks/sslcommerz`: SSLCommerz IPN callback (validates MD5 signature, calls transaction validation API).
- `GET /payments/verify/:provider/:id`: Server-side reconciliation and verification status query.

## 4. Object Storage API (`/storage/*`)
- `POST /storage/presigned-upload`: Generates secure AWS SigV4 / Cloudflare R2 presigned PUT URL. Body: `{ category, filename, contentType, sizeBytes }`.
- `GET /storage/presigned-download?key=...`: Generates secure temporary presigned GET URL (enforces strict tenant path prefix).

## 5. Enterprise Analytics & Reports (`/reports/*`)
- `GET /reports/summary`: Fast materialized dashboard rollup metrics (revenue, bookings, cancellations, average ticket size).
- `GET /reports/forecast`: Explainable 30-day Holt-Winters style exponential smoothing forecast.
- `GET /reports/export?format=csv|xlsx|pdf`: Asynchronous multi-format enterprise report export.

## 6. Real-Time WebSocket Events (`/events`)
Socket.IO connection at namespace `/events` with JWT query handshake:
- `calendar.appointment_created`, `calendar.appointment_updated`, `calendar.appointment_cancelled`
- `pos.sale_completed`, `pos.sale_voided`
- `queue.entry_added`, `queue.entry_status_changed`, `queue.entry_cancelled`
