# Implementation Plan Template

## 1. Problem Statement
<!-- High-level description of what needs to be solved, implemented, or fixed -->

## 2. Current Architecture & Context
<!-- Summary of current components, data flow, schema, and existing patterns -->

## 3. Root Cause / Requirements
<!-- For bugs: exact root cause mechanism. For features: acceptance criteria and invariants -->

## 4. Proposed Solution & Architecture
<!-- Technical design, abstraction choices, and trade-offs considered -->

## 5. Files & Components Affected
- `path/to/file.ts`: [Nature of modification]
- `path/to/component.tsx`: [Nature of modification]

## 6. Dependencies & Contracts
<!-- Any package additions (if justified) or shared contract changes in packages/shared -->

## 7. Risks & Mitigation
| Risk | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| Breaking API contract | High | Maintain backward-compatible schema; version endpoint |

## 8. Edge Cases Considered
- [ ] Network failure or timeout handling
- [ ] Concurrency/race condition behavior
- [ ] Empty state and nullish data handling
- [ ] Extreme viewport sizes (375px mobile, 4K desktop)

## 9. Verification Strategy
- [ ] Typecheck: `pnpm typecheck`
- [ ] Linter: `pnpm lint`
- [ ] Unit/Integration tests: `pnpm test`
- [ ] E2E / Browser verification: Playwright test or manual reproduction script

## 10. Rollback & Contingency Plan
<!-- How to revert safely if unexpected production issues occur -->
