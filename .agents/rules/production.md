---
trigger: always_on
description: Production readiness standards, environment configuration, database migrations, and health checks
---

# Production Readiness Standards

## 1. Zero-Downtime Database Migrations
- Schema changes must be backward-compatible (expand and contract pattern).
- Never rename or drop active columns in a single migration without a deprecation phase.
- Always run `pnpm --filter @salon/api prisma migrate status` to confirm migration synchronization before deployment.

## 2. Environment Configuration Validation
- Every environment variable must be validated on startup using a schema validator (`zod` or `class-validator`).
- Fail fast on application boot if a required environment variable is missing or malformed.
- Separate development secrets from production keys.

## 3. Observability & Health Probes
- All services must expose standard health endpoints:
  - `GET /health/liveness`: Returns 200 if the process is responsive.
  - `GET /health/readiness`: Returns 200 only if database connectivity (Prisma) and external services are operational.
- Output logs in structured JSON format with timestamps, correlation IDs, and log levels (`error`, `warn`, `info`, `debug`).

## 4. Production Build Verification
- Before declaring any release or milestone complete, verify a clean production build across the entire monorepo:
  `pnpm build`
- Confirm that no build errors, type mismatches, or missing exports occur during the build pipeline.
