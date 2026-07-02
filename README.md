# Salon & Spa Platform

Multi-tenant Salon & Spa ERP/POS/CRM/Appointments. NestJS modular monolith + two
Next.js App Router apps, MongoDB, Redis, Turborepo. Built phases:
**Phase 0 — Foundation** (`docs/phase-0.md`),
**Phase 1 — Identity, Access, Tenancy** (`docs/phase-1.md`),
**Phase 2 — Service & Product Catalog** (`docs/phase-2.md`),
**Phase 3 — Scheduling & Calendar** (`docs/phase-3.md`), and
**Phase 4 — POS & Billing** (`docs/phase-4.md`).

Scheduling and POS require a MongoDB **replica set** — transactions power both the
double-booking guarantee and idempotent checkout (sale + stock decrement are
all-or-nothing); `pnpm infra:up` provisions a single-node one. All money is integer
minor units (poisha), computed server-side; checkout is idempotent by
`Idempotency-Key`.

Auth uses Supabase as the identity provider only; the admin app needs
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to run a live login.
The API verifies the Supabase JWT and enforces all tenant scoping + CASL authz
itself (no RLS). See `.env.example`.

## Layout

```
apps/
  api/        NestJS modular monolith (DDD-ready)
  admin/      Next.js 16 — staff/owner dashboard
  booking/    Next.js 16 — public online booking
packages/
  shared/     Zod schemas, enums, Money (integer minor units) — the contract
  ui/         HeroUI v3 surface, design tokens, theme + locale switches
  config/     shared ESLint flat config
```

## Prerequisites

- Node >= 22.12, pnpm 11.9 (`packageManager` is pinned)
- Mongo (replica set) + Redis. Use `pnpm infra:up` (docker compose) — Mongo runs as
  a single-node replica set that self-initiates via its healthcheck.
  - No Docker? Any local `redis-server` and `mongod` work; point `MONGODB_URI` /
    `REDIS_URL` at them (a standalone mongod needs `directConnection=true` and no
    `replicaSet`).

## Run

```bash
pnpm install          # see "Supply chain" below if this is rejected by the age gate
cp .env.example .env   # optional; the api has localhost defaults baked in
pnpm infra:up          # Mongo + Redis (docker)
pnpm dev               # api :4000, admin :3000, booking :3001
```

Quick check:

```bash
curl -X POST localhost:4000/ping -H 'content-type: application/json' \
  -H 'x-tenant-id: demo' -d '{"name":"Awsaf"}'
curl localhost:4000/health
```

## Scripts (Turborepo)

`pnpm dev | build | lint | typecheck | test | format`

## Locked decisions

- **Supabase = identity provider only** (no RLS; all authz in NestJS via CASL from
  Phase 1). Phase 0 only reserves the env seam.
- **Agora dropped** from the core. Optional video consults stay deferred (Phase 12).
- **Money** is integer minor units (poisha; 1 BDT = 100). Never floats. See
  `packages/shared/src/money.ts`.

## Supply chain

`pnpm-workspace.yaml` enables `blockExoticSubdeps` and `trustPolicy: no-downgrade`.
It also has `minimumReleaseAge`, **currently `0`**. pnpm re-checks this against the
*entire* lockfile on every install (including `--frozen-lockfile` and Turborepo's
deps-status precheck). The Phase-0 stack (Next 16, Tailwind 4.3.2, vitest/rolldown,
next-intl) is all younger than 7 days right now, so any positive gate makes the repo
uninstallable. **Decision pending** (see `docs/phase-0.md`): raise it to `10080`
(7 days) once the stack has aged, or pin older versions, if you want the gate active.

## Version pins (exact)

Next 16.2.9 · React 19.2.7 · TypeScript 6.0.3 · Turbo 2.10.2 · Zod 4.4.3 ·
NestJS 11.1.27 · Mongoose 9.7.3 · @nestjs/cqrs 11.0.3 · @nestjs/bullmq 11.0.4 ·
bullmq 5.79.2 · ioredis 5.11.1 · nestjs-pino 4.6.1 · @nestjs/terminus 11.1.1 ·
HeroUI 3.2.1 · next-intl 4.13.1 · Tailwind 4.3.2 · next-themes 0.4.6 ·
ESLint 10.6.0 · Vitest 4.1.9. Exact transitive versions live in `pnpm-lock.yaml`.
