# The 9-Stage Autonomous Engineering Execution Loop
## Modeled after Claude Code & Claude Opus 5.5 Engineering Rigor

```
  ┌──────────────┐
  │  UNDERSTAND  │  Clarify requirements, constraints, and success criteria.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │   EXPLORE    │  Locate relevant files, inspect dependencies & existing patterns.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │     PLAN     │  Draft concise, actionable roadmap; assess risks & edge cases.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │  IMPLEMENT   │  Make surgical, type-safe, minimal code edits.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │     TEST     │  Execute unit, integration, and E2E browser tests.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │    REVIEW    │  Inspect git diff; audit for edge cases & code smells.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │     FIX      │  Resolve root causes of any test or review findings.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │    VERIFY    │  Re-run full verification suite to guarantee zero regressions.
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │    REPORT    │  Deliver structured report with evidence and categorized status.
  └──────────────┘
```

---

## Stage-by-Stage Operating Guide

### 1. UNDERSTAND
- Read the user's objective with extreme care.
- Differentiate between core requirements and nice-to-haves.
- Identify the system boundary: Which apps (`apps/api`, `apps/booking`, `apps/admin`) or packages (`packages/shared`) are involved?

### 2. EXPLORE
- **Read before writing**: Use `grep_search` and `view_file` to locate existing implementations.
- Discover already-existing utilities, components, and constants to avoid redundant duplication.
- Check active package dependencies and version numbers.
- Check current git status: never overwrite uncommitted user changes.

### 3. PLAN
- For any task requiring changes across multiple files or architectural modifications:
  1. Define the exact goal.
  2. List target files to touch.
  3. Identify failure risks and mitigation strategies.
  4. Define the verification criteria (tests, typecheck, lint).

### 4. IMPLEMENT
- Adhere to the single-responsibility principle.
- Use strict TypeScript typing: no `any`, no implicit types.
- Follow existing formatting and style conventions.
- Keep changes surgical: avoid re-formatting or refactoring adjacent, unrelated code.

### 5. TEST
- Run automated tests immediately after implementation:
  - Unit tests: `pnpm --filter <app> test`
  - Integration/E2E: `pnpm test:e2e` or `npx playwright test`
- For UI tasks: Inspect elements and capture screenshots in headless Chromium.

### 6. REVIEW
- Run `git diff` to inspect every single line added, removed, or modified.
- Ask the 16 self-review questions (see `self-review-checklist.md`).
- Ensure no console logs, leftover debug comments, or temporary hacks remain.

### 7. FIX
- If tests fail or defects are found during review, seek the **root cause**.
- Never patch symptoms with superficial null-checks when the data model or state machine is faulty.
- Re-apply minimal robust fixes.

### 8. VERIFY
- Run full regression verification:
  1. `pnpm typecheck`
  2. `pnpm lint`
  3. `pnpm test`
  4. Monorepo build check when relevant.
- Confirm zero regressions in adjacent features.

### 9. REPORT
- Deliver an evidence-backed final summary following the standard response contract:
  - **WHAT CHANGED**
  - **WHY**
  - **FILES** (clickable links)
  - **VERIFICATION** (actual command outputs & test results)
  - **RESULT** (`CONFIRMED`, `ASSUMED`, `UNVERIFIED`, `BLOCKED`)
  - **REMAINING**
