---
name: workflow-audit
description: Conducts an end-to-end production readiness audit across architecture, security, performance, database migrations, and testing. Trigger with /audit.
---

# Workflow: Production Readiness Audit (/audit)

Use this skill when auditing the project for production deployment or when invoking `/audit`.

## Steps
1. **Repository & Build Audit**:
   - Check `git status` for untracked or uncommitted drift.
   - Run `pnpm build` across all workspaces to confirm clean production bundles.
2. **Database & Schema Audit**:
   - Run `pnpm --filter @salon/api prisma migrate status` to verify migration sync.
   - Audit indexes on high-volume tables (`Appointment`, `User`, `Payment`).
3. **Security & Dependency Audit**:
   - Run `pnpm audit` to identify vulnerable dependencies.
   - Verify `.env` isolation and secret hygiene.
4. **Test & Quality Gate**:
   - Run `pnpm test` (unit) and `pnpm test:e2e` (browser journeys).
   - Verify health probes (`GET /health/liveness`, `GET /health/readiness`).
5. **Compile Audit Matrix**:
   Output final audit table with categorized status: `CONFIRMED`, `ASSUMED`, `UNVERIFIED`, `BLOCKED`.
