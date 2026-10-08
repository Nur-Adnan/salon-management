# Stage G Roadmap — Phase 13: Client Self-Service Portal

## 1. Objective
Provide customers with a secure, self-service portal to view appointment history, reschedule or cancel upcoming visits, manage profile details, track loyalty balance and redemption history, check active subscriptions, and view gift cards with strict ownership-based IDOR enforcement.

## 2. Architecture
- **Frontend App**: `apps/booking/app/[slug]/portal/page.tsx`
  - Responsive, mobile-first interface designed with HeroUI v3 and Tailwind CSS v4.
  - Multi-tab navigation: Appointments, Loyalty, Subscriptions, Gift Cards, Profile.
- **Backend API**: `apps/api/src/customers/client-portal.controller.ts` & `client-portal.service.ts`
  - Guard: `ClientAuthGuard` (`apps/api/src/customers/client-auth.guard.ts`).
  - Auth mechanisms: OTP-backed phone verification or customer JWT minting.
  - Strict ownership checking: Every database query uses `{ _id: resourceId, customerId: authenticatedClientId, tenantId }`.

## 3. Security & IDOR Protection Matrix
| Resource | Access Rule | Ownership Enforcement |
| :--- | :--- | :--- |
| **Upcoming Appointments** | Read/Reschedule/Cancel | `tenantId` + `customerId: auth.customerId` + status in `['booked', 'confirmed']` |
| **Past Appointments** | Read | `tenantId` + `customerId: auth.customerId` |
| **Loyalty Ledger** | Read balance & history | `tenantId` + `customerId: auth.customerId` |
| **Subscriptions** | Read active/cancelled status | `tenantId` + `customerId: auth.customerId` |
| **Gift Cards** | Read claimed cards | `tenantId` + `customerId: auth.customerId` |
| **Profile** | Read/Update personal info | `tenantId` + `_id: auth.customerId` |

## 4. API Surface
- `POST /portal/auth/send-otp`: Sends 6-digit verification code to customer phone number.
- `POST /portal/auth/verify-otp`: Validates OTP and returns signed `ClientSessionToken`.
- `GET /portal/me`: Customer profile, total points, active subscriptions, gift card count.
- `GET /portal/appointments`: Customer's appointments with status filters.
- `POST /portal/appointments/:id/reschedule`: Reschedules slot (guarded by advance-notice window, e.g. >= 2h).
- `POST /portal/appointments/:id/cancel`: Cancels booking with audit reason.
- `GET /portal/loyalty`: Balance and ledger transaction history.
- `GET /portal/subscriptions`: Subscriptions with billing intervals and renewal status.

## 5. Verification & Tests
- OTP brute-force defense (max 3 failed attempts before lockout).
- Horizontal privilege escalation test: Client A attempts to fetch or cancel Client B's appointment → 404/403.
- Reschedule validation: Cannot reschedule a cancelled, completed, or in-progress appointment.
- Responsive mobile UI verified through headless build and component rendering.
