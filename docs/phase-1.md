# Phase 1 — Identity, Access, Tenancy

Auth bridge, RBAC, multi-tenant + multi-branch foundation, staff-as-user, resources.

## What was built

**Auth bridge (Supabase = IdP only).** `SupabaseJwtStrategy` validates the bearer
JWT — JWKS (RS256/ES256) when `SUPABASE_JWKS_URL` is set, else the shared secret
(HS256). A global `JwtAuthGuard` runs the strategy, provisions the user (upsert by
`supabaseUserId`, activate pending invites by email), resolves the active
tenant/branch, and populates the request context. `@Public()` exempts health/ping.

**Tenancy model.** `Organization` (tenant), `Branch`, `User` (global), `Membership`
(`{tenantId, userId|invitedEmail, branchId|null, role, status}`). Every tenant-owned
collection has `{tenantId, ...}` compound indexes + soft delete.

**Tenant scoping (the security core).** A request-scoped `RequestContext`
(`AsyncLocalStorage`, stdlib — no nestjs-cls) holds the identity + active scope.
`TenantScopedRepository` forces `tenantId` (+ `branchId` for resources) onto every
read and write, so a query cannot escape its tenant. Scope is resolved from
`x-tenant-id` / `x-branch-id` headers **validated against the user's memberships** —
requesting a tenant/branch you don't belong to is a 403.

**Authorization (CASL).** `abilityForRole` maps role → abilities; `@CheckAbility`
+ global `AbilitiesGuard` enforce per-action authz. owner=manage all; manager=manage
Branch/Resource/Membership + read org; receptionist/stylist=read; accountant/read_only=read.

**Endpoints.** `GET /me`, `POST /organizations` (bootstrap → owner),
`GET/POST /branches`, `GET/POST /invitations` (invite staff), resources CRUD
(`GET/POST/PATCH/DELETE /resources`).

**Admin frontend.** `@supabase/ssr` httpOnly-cookie auth (login: password / magic
link / Google OAuth; `/auth/callback`), session-refreshing middleware that gates
protected routes, an authenticated server-side API client that forwards the access
token + active-scope headers, an org/branch switcher (cookie-backed), and
dashboard / resources / team(invite) pages.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| Token storage | httpOnly cookies via `@supabase/ssr` | No token in localStorage; middleware refreshes it. |
| Tenant resolution | `x-tenant-id`/`x-branch-id` headers, validated vs memberships | Simple, explicit; subdomain resolution deferred to the booking app. |
| JWT verify | HS256 (secret) + JWKS (RS256/ES256), env-switched | Prod uses Supabase asymmetric keys; dev mints HS256 to test without a project. |
| Context propagation | stdlib `AsyncLocalStorage` | One small service vs a new dependency. |
| api TS resolution | migrated to `nodenext` (+ `.js` import extensions) | `@casl/ability` (and future deps) ship `exports`-mapped types that `node10` can't resolve; `node10` is deprecated in TS 6. |
| Invite branch validation | not yet enforced to belong to the tenant | Low-risk (resources stay tenant-scoped, so no leak); hardened in Phase 2. |

## Verification

- `pnpm typecheck` (6/6) · `pnpm lint` (6/6) · `pnpm test` (shared 7 + api 15 = 22) ·
  `pnpm build` (4/4) — all green.
- **Unit:** CASL ability mapping per role; `resolveScope` (cross-tenant/cross-branch
  403s, org-wide grants, bootstrap path).
- **Live e2e (16/16)** with minted HS256 tokens against local Mongo + Redis:
  auth required (401), public health (200), first-login provisioning, org bootstrap
  → owner, branch + resource creation, invite → activation on login, **stylist can
  read but not create (CASL 403)**, **member of branch A cannot select branch B
  (403)**, **user of tenant T2 cannot access T1 (403)**, tenant isolation holds.
- Not runtime-verified here: the live Supabase browser login (needs a real Supabase
  project + `NEXT_PUBLIC_SUPABASE_*`); the backend was verified with minted tokens
  and the admin app was verified via `next build`.

## Follow-ups

- Next 16 deprecated the `middleware.ts` convention in favor of `proxy.ts` (still
  runs; non-fatal warning).
- Validate invite `branchId` belongs to the active tenant (Phase 2).
- Automated cross-tenant penetration tests land in Phase 14.

## Next: Phase 2 — Service & Product Catalog.
