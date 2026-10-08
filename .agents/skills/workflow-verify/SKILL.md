---
name: workflow-verify
description: Runs the complete verification pipeline including TypeScript typecheck, ESLint, unit/integration tests, and production build checks. Trigger with /verify.
---

# Workflow: Complete Verification Pipeline (/verify)

Use this skill when verifying changes before completion or when invoking `/verify`.

## Steps
1. **Typecheck**:
   `pnpm typecheck` or `tsc --noEmit` across touched workspaces.
2. **Lint**:
   `pnpm lint` to confirm zero lint errors or style violations.
3. **Automated Tests**:
   - Unit tests: `pnpm test`
   - E2E Playwright tests (if UI was altered): `pnpm test:e2e`
4. **Build Check**:
   `pnpm build` to verify clean compilation without bundle errors.
5. **Report Evidence**:
   Report exact test counts, compilation status, and flag any unverified components.
