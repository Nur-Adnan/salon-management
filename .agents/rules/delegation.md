---
trigger: always_on
description: Intelligent specialist agent delegation matrix and multi-agent coordination protocols
---

# Specialist Agent Delegation Matrix

The primary agent coordinates work and delegates to specialized personas when task complexity demands deep, focused expertise.

---

## 1. Multi-Agent Delegation Protocols

### A. Complex Frontend Feature
When implementing complex interactive UI, design system redesigns, or responsive screens:
1. **`ui-ux-engineer`**: Establishes visual hierarchy, typography, spacing, microinteractions, and 21st.dev component pattern selection.
2. **`frontend-engineer`**: Implements React/Next.js 14 App Router components, state management, and type-safe props.
3. **`performance-engineer`**: Audits bundle impact, lazy-loading boundaries, and Core Web Vitals (LCP, INP, CLS).
4. **`code-reviewer`**: Reviews the final diff against standards, accessibility (WCAG 2.2 AA), and edge cases.

### B. Security-Sensitive Feature (Auth, Payments, RBAC)
When touching authentication, payment webhooks, password resets, or permission guards:
1. **`backend-engineer`**: Implements NestJS controllers, services, DTO validations, and Prisma transaction logic.
2. **`security-engineer`**: Threat models the data flow, audits against OWASP Top 10, verifies rate limits and token signatures.
3. **`qa-engineer`**: Tests boundary conditions, invalid tokens, brute-force limits, and expired sessions.
4. **`code-reviewer`**: Conducts independent security diff review before merging.

### C. Large Database or Architecture Migration
When altering domain boundaries, migrating schemas, or introducing new services:
1. **`architect`**: Authors migration strategy, evaluates backward compatibility, and designs schema indexes and constraints.
2. **`backend-engineer`**: Implements Prisma migrations, service refactors, and DTO adapters.
3. **`qa-engineer`**: Validates data consistency, verifies existing tests, and runs migration rollback checks.
4. **`code-reviewer`**: Verifies zero architectural leakage across package boundaries.

### D. Production Readiness Audit
Before production deployments or major milestone releases:
1. **`production-auditor`**: Coordinates pre-flight audit checklist (builds, migrations, environment variables).
2. **`security-engineer`**: Scans dependencies (`pnpm audit`) and audits secret protection.
3. **`performance-engineer`**: Measures server response latencies and web vital thresholds.
4. **`qa-engineer`**: Runs full end-to-end regression suites in headless Chromium.

---

## 2. Anti-Patterns to Avoid
- **No Trivial Delegation**: Do NOT delegate single-line typos, basic docstring edits, or simple dependency additions.
- **No Performative Delegation**: Do NOT spawn subagents merely to restate instructions without adding value.
- **Always Consolidate Evidence**: The primary agent remains responsible for synthesizing specialist findings and reporting clear, actionable evidence to the user.
