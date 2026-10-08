---
trigger: model_decision
description: Performance optimization guidelines, Core Web Vitals, bundle splitting, and DB latency
---

# Performance Standards

## 1. Core Web Vitals Targets
Every user-facing page must achieve:
- **Largest Contentful Paint (LCP)**: < 2.5s (pre-load hero elements, optimize Next.js images, minimize server TTFB).
- **Interaction to Next Paint (INP)**: < 200ms (avoid heavy synchronous JavaScript during user clicks; use `useTransition` or Web Workers).
- **Cumulative Layout Shift (CLS)**: < 0.1 (define explicit image dimensions and reserve container space for async content).

## 2. Frontend Bundle & Asset Optimization
- Use dynamic imports (`next/dynamic`) with loading skeletons for heavy components (e.g., date pickers, rich text editors, charts).
- Ensure third-party scripts (analytics, widgets) use `strategy="lazyOnload"` or `strategy="afterInteractive"`.
- Eliminate unused CSS classes and avoid bulky duplicate libraries (e.g. do not import both `lodash` and individual utilities).

## 3. Backend & Database Performance
- Database queries must execute within < 50ms for standard read operations.
- Avoid N+1 queries by leveraging Prisma relation eager loading (`include`) or batch queries.
- Add database indexes on foreign keys, status flags, and timestamps frequently sorted or filtered.
- Utilize caching (in-memory cache or Redis) for slow-changing static data like service catalog and salon configuration.
