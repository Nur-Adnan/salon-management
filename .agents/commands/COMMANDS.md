# Antigravity Workflow Commands Registry

This directory defines standard commands for recurring engineering workflows. Each command orchestrates specialized skills and agents to ensure maximum quality and consistency.

---

## Command Catalog

| Command | Specialist Agent | Primary Skills | Description |
| :--- | :--- | :--- | :--- |
| **`/plan`** | `architect` | `spec-driven-development`, `architecture-designer` | Constructs a structured, actionable implementation plan before touching code. |
| **`/audit`** | `production-auditor` | `verification-before-completion`, `shipping-and-launch` | Runs a comprehensive production-readiness audit across security, build, and tests. |
| **`/review`** | `code-reviewer` | `code-review`, `react-doctor` | Reviews current git diff against standards, architecture, and regression risks. |
| **`/debug`** | `debugging-engineer` | `systematic-debugging`, `error-debugging-error-analysis` | Systematic root-cause investigation: reproduce, isolate, diagnose, and test. |
| **`/fix`** | `debugging-engineer` | `systematic-debugging` | Implements the minimal robust fix for a confirmed defect with regression proof. |
| **`/test`** | `qa-engineer` | `playwright-expert`, `javascript-testing-patterns` | Executes unit, integration, and E2E Playwright test suites. |
| **`/security`** | `security-engineer` | `security-reviewer`, `secure-code-guardian` | Audits code for OWASP Top 10 vulnerabilities, auth flaws, and dependency risks. |
| **`/performance`** | `performance-engineer` | `core-web-vitals`, `database-optimizer` | Audits Core Web Vitals, bundle footprints, and database query latencies. |
| **`/frontend`** | `frontend-engineer`, `ui-ux-engineer` | `senior-frontend`, `ui-ux-pro-max`, `impeccable` | Implements responsive, accessible UI components aligned with local design tokens. |
| **`/backend`** | `backend-engineer` | `senior-backend`, `nestjs-expert`, `prisma-client-api` | Implements NestJS services, controllers, DTOs, and Prisma database models. |
| **`/verify`** | `qa-engineer`, `production-auditor` | `verification-before-completion` | Executes the complete verification gate: typecheck, lint, unit tests, and build. |
| **`/release`** | `production-auditor` | `shipping-and-launch` | Pre-flight release verification, database migration sync, and deployment audit. |

---

## Invocation Protocol
Commands can be triggered by:
1. User slash commands in chat (e.g. `/plan`, `/verify`, `/audit`).
2. Primary agent delegation when decomposing complex tasks into specialist sub-tasks.
