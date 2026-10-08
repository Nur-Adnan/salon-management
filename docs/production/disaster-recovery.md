# Disaster Recovery, Business Continuity & Rollback Strategy

This document provides actionable runbooks for recovering the Salon & Spa platform from database corruption, Redis outages, queue deadlocks, payment discrepancies, storage failures, and emergency deployment rollbacks.

---

## 1. MongoDB Database Backup & Restore Runbook

### 1.1 Automated Backup Schedule
- **Continuous Point-in-Time Recovery (PITR)**: MongoDB Oplog archived every 10 minutes.
- **Daily Full Backups**: `mongodump` execution at 02:00 UTC with zstandard compression.
- **Retention Policy**:
  - Daily snapshots retained for 30 days.
  - Weekly snapshots retained for 12 weeks.
  - Monthly snapshots retained for 1 year in isolated, write-once-read-many (WORM) storage.

### 1.2 Point-in-Time Restore Procedure
1. **Isolate Workload**: Point API traffic to a maintenance page by setting maintenance mode on the load balancer or cloud proxy.
2. **Provision Target Replica Set**:
   ```bash
   mongorestore --host="mongodb-restore.internal:27017" \
     --ssl --username="admin" --password="[SECRET]" \
     --authenticationDatabase="admin" \
     --archive="daily-snapshot-2026-10-08.archive.zst" \
     --oplogReplay --oplogLimit="2026-10-08T17:30:00Z"
   ```
3. **Verify Integrity & Invariants**:
   - Check unique index constraints (`{ tenantId: 1, phone: 1 }` on Customers).
   - Reconcile stock movement balances against `StockLevel.qtyOnHand`.
   - Reconcile loyalty entries against `LoyaltyAccount.balance`.
4. **Shift Traffic**: Update `MONGODB_URI` secret in container orchestrator and restart API instances.

---

## 2. Redis Failure & In-Memory Fallback Behavior

### 2.1 Failure Modes & Degradation
- **Rate Limiting (`RateLimitService`)**:
  - Automatically degrades to local in-memory sliding window counters per instance if Redis drops.
  - Prevents total API lockout while protecting backend from brute force.
- **BullMQ Background Workers**:
  - Queue operations pause safely; jobs remain queued with TTL in Redis.
  - Workers automatically attempt reconnect with exponential backoff.
- **Socket.IO Real-Time Clustering**:
  - Degrades to single-instance WebSockets or long-polling if Redis Pub/Sub adapter is severed.

### 2.2 Redis Node Recovery Procedure
1. If standalone node fails, restart or failover to read-replica via Sentinel / AWS ElastiCache.
2. Flush corrupt AOF/RDB files if startup crashes occur:
   ```bash
   redis-check-aof --fix /var/lib/redis/appendonly.aof
   ```
3. Test connectivity with `pnpm --filter @salon/api dev` or curl `/health/ready`.

---

## 3. BullMQ Job Recovery & Dead-Letter Queues (DLQ)

### 3.1 Failed Job Handling
- **Notifications Queue (`NOTIFICATION_QUEUE`)**: Configured with 3 exponential backoff attempts (delays: 10s, 30s, 2m).
- **Campaigns Queue (`CAMPAIGN_QUEUE`)**: Rate-limited chunk processing (100 jobs/batch). If a worker crashes mid-batch, lock expiration releases unacknowledged jobs for replay.

### 3.2 Dead-Letter Queue Triage
```bash
# Inspection via NestJS Terminus or BullMQ CLI
npx bullmq-cli get-failed --queue=notifications
# Retry all failed notification jobs after network restoration
npx bullmq-cli retry-all --queue=notifications
```

---

## 4. Payment Reconciliation & Webhook Replay Runbook

### 4.1 Daily Reconciler Process
Every morning at 03:00 UTC, the system audits payment records against gateway transaction reports:
1. Identify all `PaymentTransaction` records in `initiated` or `pending` state older than 30 minutes.
2. Call provider server-to-server query API (`queryPayment` on bKash, `verifyPayment` on Nagad, `validateTransaction` on SSLCommerz).
3. If gateway reports `Completed` / `Success` / `VALID`:
   - Transition transaction to `captured`.
   - Update related `Sale` record if payment was pending.
4. If gateway reports `Failed` or does not exist:
   - Transition transaction to `failed` with failure reason.

### 4.2 Webhook Replay Protection
- Every webhook payload contains unique provider reference IDs (`paymentID`, `payment_ref_id`, `val_id`).
- Incoming webhooks check Redis key `webhook:processed:{provider}:{ref}` with 24-hour expiration (`NX` flag).
- Duplicate deliveries immediately receive HTTP 200 `{ status: "duplicate_accepted" }` without re-executing stock or ledger operations.

---

## 5. Object Storage (Cloudflare R2 / AWS S3) Recovery

### 5.1 Bucket Outage & Fallback
- `ObjectStorageService` includes an in-memory buffer cache for unit tests and localized temporary degradation.
- Upload Presigned URLs: Valid for 15 minutes. If a customer upload fails due to network termination, client app requests a fresh URL without re-authenticating the whole session.

### 5.2 Accidental Object Deletion
- Bucket versioning must be enabled on production buckets.
- Undelete objects by removing delete markers:
  ```bash
  aws s3api delete-object --bucket salon-uploads --key "tenants/xxx/treatment_photos/abc.jpg" --version-id "marker-id"
  ```

---

## 6. Emergency Deployment Rollback Runbook

### 6.1 Application Rollback (< 5 Minutes)
1. **Container / Pod Reversion**:
   ```bash
   # Kubernetes / ECS deployment rollback
   kubectl rollout undo deployment/salon-api
   kubectl rollout undo deployment/salon-admin
   kubectl rollout undo deployment/salon-booking
   ```
2. **Schema Invariant Check**:
   - All Mongoose schema additions in Phases 9–14 are **additive only** (new optional fields, new standalone collections `campaigns`, `daily_rollups`, `payment_transactions`).
   - Rolling back API application code causes zero schema breakage because old code ignores unknown fields.

### 6.2 Health Verification Post-Rollback
Verify that health endpoints report green:
```bash
curl -f https://api.yourdomain.com/health/ready
curl -f https://api.yourdomain.com/health/live
```
