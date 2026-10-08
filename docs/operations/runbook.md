# Operations & Site Reliability Runbook

## 1. MongoDB Maintenance & Disaster Recovery
- **Continuous Oplog Archiving**: MongoDB ReplicaSet must maintain oplog window of at least 72 hours.
- **Automated Snapshots**: Daily point-in-time snapshots executed at 03:00 UTC.
- **Restore Verification Procedure**:
  1. Spin up isolated staging cluster: `mongorestore --archive=/backups/salon-2026-10-08.archive.gz --gzip`.
  2. Verify tenant integrity: check collection counts (`tenants`, `customers`, `sales`, `stock_levels`).
  3. Replay oplog up to target recovery timestamp: `mongorestore --oplogReplay --oplogLimit="<timestamp>:1"`.

## 2. Redis Operations & Cache Eviction
- **Persistence**: Hybrid RDB + AOF enabled (`appendonly yes`, `appendfsync everysec`).
- **Memory Policy**: `maxmemory-policy volatile-lru` to protect durable token bucket keys while pruning stale cache entries.
- **Failover**: Sentinel or Redis Cluster with automated failover (timeout <= 15s).

## 3. BullMQ Queue Observability & Dead-Letter Handling
- **Queue Dashboards**: Bull-Board or monitoring CLI accessible to SREs.
- **Dead-Letter Recovery Procedure**:
  1. Inspect failed jobs in `notification` or `reminder` queues:
     `SELECT failed FROM bullmq WHERE queue = 'notification';`
  2. Inspect `failedReason` and retry counter.
  3. After resolving upstream network or SMS provider outage, trigger bulk retry:
     `queue.retryJobs({ count: 100 })`.

## 4. Payment Reconciliation & Webhook Replay
- When a mobile wallet or gateway undergoes downtime:
  1. Run the reconciliation query on `payment_transactions` where `status = 'pending'` and `createdAt < now - 30m`.
  2. For each pending transaction, invoke `PaymentsController.verifyStatus(provider, id)`.
  3. If status transitioned to `Captured`, update the `Sale.paymentStatus` and emit `pos.sale_completed`.

## 5. Rollback Procedure
If a production deployment encounters critical regressions:
1. **Container Rollback**:
   - Revert container image tag to previous stable release: `kubectl rollout undo deployment/api`.
2. **Schema Backward Compatibility**:
   - All migrations follow expand-and-contract patterns. No columns or collections are dropped in the same release. Previous application versions can run against the current database schema without schema conflicts.
3. **Cache Clearing**:
   - Invalidate any affected Redis cache keys: `redis-cli KEYS "cache:*" | xargs redis-cli DEL`.
