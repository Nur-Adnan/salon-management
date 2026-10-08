---
trigger: model_decision
description: Testing guidelines for Jest, Playwright, test fixtures, unit, integration, and E2E verification
---

# Testing Standards & Strategy

## 1. Test Pyramid & Scope
- **Unit Tests (Jest)**: Test domain logic, utility functions, calculation helpers, and isolated service methods. Aim for fast, deterministic execution with no real network or database calls.
- **Integration Tests (Jest + Test Containers / In-memory DB)**: Verify cross-service communication, repository operations, and NestJS controllers against test database fixtures.
- **End-to-End Tests (Playwright)**: Exercise full user journeys in real headless Chromium browsers:
  - Customer appointment booking flow (service selection -> staff selection -> date/time selection -> customer info -> confirmation)
  - Staff / Admin login, dashboard analytics, and appointment status update

## 2. Test Authoring Principles
- **Descriptive Test Titles**: Structure tests with `describe('FeatureOrModule', () => { it('should perform action when condition', () => {}) })`.
- **AAA Pattern**: Structure each test cleanly into Arrange, Act, and Assert phases.
- **Deterministic Assertions**: Never use arbitrary `sleep` or timers. In Playwright, wait for concrete selectors or network responses (`waitForSelector`, `waitForResponse`).
- **Clean Test State**: Each test must clean up after itself or run in an isolated transaction. Never rely on test execution order.

## 3. Verification Commands
- Monorepo tests: `pnpm test`
- Backend API tests: `pnpm --filter @salon/api test`
- E2E Playwright tests: `pnpm test:e2e` or `npx playwright test`
- When modifying a specific module, always run its targeted test file before considering the task complete.
