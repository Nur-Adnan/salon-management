# System Performance Audit & Optimization Strategy

## 1. Database Indexing & Query Analysis

### 1.1 Index Evaluation Matrix
| Collection | Indexes Defined | Performance Characteristics | Gaps / Recommendations |
|---|---|---|---|
| `users` | `{ supabaseUserId: 1 }` (unique), `{ email: 1 }` (unique) | Fast lookup during JWT validation. | Verified optimal. |
| `memberships` | `{ tenantId: 1, userId: 1, branchId: 1 }` (unique) | Immediate scope resolution on auth. | Verified optimal. |
| `branches` | `{ tenantId: 1, slug: 1 }` (unique), `{ tenantId: 1, deletedAt: 1 }` | Fast routing for public booking. | Add index on `{ slug: 1 }` for root slug resolution. |
| `services` | `{ tenantId: 1, categoryId: 1, deletedAt: 1 }` | Categorized catalog listings. | Add index on `{ tenantId: 1, active: 1, deletedAt: 1 }`. |
| `products` | `{ tenantId: 1, sku: 1 }`, `{ tenantId: 1, barcode: 1 }` | Barcode scanning in POS is indexed. | Add index on `{ tenantId: 1, active: 1, deletedAt: 1 }`. |
| `slot_reservations`| `{ tenantId: 1, branchId: 1, holderType: 1, holderId: 1, slotStart: 1 }` (unique) | Primary engine of double-booking prevention. | Fast date range range scans via `{ slotStart: 1 }`. |
| `appointments` | `{ tenantId: 1, branchId: 1, customerId: 1, 'lines.start': 1 }` | Calendar and customer history queries. | Index `{ tenantId: 1, branchId: 1, status: 1, 'lines.start': 1 }` for calendar filters. |
| `sales` | `{ tenantId: 1, branchId: 1, createdAt: -1 }`, `{ tenantId: 1, invoiceNumber: 1 }` (unique) | Fast invoice search and daily sales list. | Add `{ tenantId: 1, branchId: 1, status: 1, createdAt: -1 }` for sales reports. |
| `stock_levels` | `{ tenantId: 1, branchId: 1, productId: 1 }` (unique) | Fast atomic `$inc` updates in `applyStockDelta`. | Add `{ tenantId: 1, branchId: 1, qtyOnHand: 1, reorderPoint: 1 }` for low-stock reports. |
| `stock_movements` | `{ tenantId: 1, refType: 1, refId: 1, productId: 1, reason: 1 }` (unique) | Idempotent movement ledger insertion. | Add `{ tenantId: 1, branchId: 1, productId: 1, createdAt: -1 }` for stock history audit. |

### 1.2 Aggregation & N+1 Prevention
- **Reports Module**: On-demand pipelines (`ReportsService`) currently run live aggregations over entire collections.
- **Rollup Architecture (Phase 11)**:
  - Raw event aggregation over millions of rows will introduce latency.
  - Solution: Background cron/BullMQ workers will compute `DailyMetricRollup` records at midnight for each branch. Dashboard and historical trend requests will query the pre-aggregated rollups, dropping query times from seconds to <5ms.

---

## 2. API & Caching Architecture

1. **Idempotency Caching**:
   - `IdempotencyInterceptor` stores mutation responses in Redis with 24-hour TTL using atomic `SET NX`.
   - Prevents duplicate credit card/mobile wallet charges and double-booking on network retries.

2. **Public Route Caching**:
   - Public booking metadata (`/public/:slug`, `/public/:slug/:branchId/services`) is read-heavy.
   - Redis caching with 60-second TTL or tag-based invalidation prevents database thrashing during peak marketing campaigns.

3. **Rate Limiting**:
   - Implemented via Redis sliding-window counter to maintain sub-millisecond overhead.

---

## 3. Background Queue Throughput & Concurrency

1. **BullMQ Worker Configuration**:
   - Connection re-uses Redis connection pool with `maxRetriesPerRequest: null`.
   - Worker concurrency tuned per queue:
     - `notifications`: Concurrency 10 (I/O bound to SMS/WhatsApp APIs).
     - `campaigns`: Concurrency 5 with rate-limiting token bucket to adhere to telecom rate limits.
     - `reports`: Concurrency 2 (CPU/Memory intensive PDF/Excel generation).

2. **Graceful Worker Shutdown**:
   - `enableShutdownHooks()` in NestJS ensures active jobs complete before container termination during zero-downtime rolling deployments.

---

## 4. Frontend Performance & Core Web Vitals

1. **Turborepo & Next.js 16 Optimization**:
   - Both `apps/admin` and `apps/booking` leverage React 19 Server Components for data-heavy views, minimizing client-side JavaScript bundle size.
   - Tailwind CSS v4 eliminates runtime style generation overhead.
   - Images served with WebP/AVIF formatting and dimension attributes to achieve CLS = 0.
   - HeroUI v3 tree-shaken with minimal bundle overhead.
