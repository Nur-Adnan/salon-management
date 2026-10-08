# Production Deployment Guide

## 1. Container Infrastructure & Topology
The application is containerized with multi-stage Docker builds:
- `apps/api`: NestJS Node.js 22 LTS Alpine runtime (`node dist/main.js`).
- `apps/admin`: Next.js 16 Standalone server (`node server.js`).
- `apps/booking`: Next.js 16 Standalone server (`node server.js`).

## 2. Environment Variables Specification

### Core Infrastructure
| Variable | Description | Production Requirement |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment identifier | Set to `production` |
| `API_PORT` | HTTP port for NestJS API | e.g. `4000` |
| `MONGODB_URI` | MongoDB ReplicaSet URI | Direct or SRV with replicaSet |
| `REDIS_URL` | Redis URI (Cluster/Sentinel) | TLS enabled (`rediss://...`) |
| `WEB_ORIGINS` | CORS allowed origins | e.g. `https://admin.salon.com,https://book.salon.com` |

### Authentication
| Variable | Description | Production Requirement |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Supabase API endpoint | `https://<ref>.supabase.co` |
| `SUPABASE_JWKS_URL` | Supabase JWKS endpoint | `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_SECRET`| Supabase JWT verification secret | Production secret (never dev default) |

### Payment Gateways (Bangladesh)
| Variable | Description | Notes |
| :--- | :--- | :--- |
| `BKASH_APP_KEY` | bKash Merchant App Key | Provided by bKash PGW portal |
| `BKASH_APP_SECRET` | bKash Merchant App Secret | Secure secret |
| `BKASH_USERNAME` | bKash API Username | Merchant username |
| `BKASH_PASSWORD` | bKash API Password | Merchant password |
| `BKASH_WEBHOOK_SECRET` | Secret for HMAC signature | Required for webhook validation |
| `BKASH_IS_SANDBOX` | Toggle live vs sandbox URL | Set to `false` in production |
| `NAGAD_MERCHANT_ID` | Nagad Merchant Identifier | Provided by Nagad PGW team |
| `NAGAD_PUBLIC_KEY` | Nagad Public Key (PEM) | For verifying Nagad signatures |
| `NAGAD_PRIVATE_KEY` | Merchant Private Key (PEM) | For signing requests |
| `NAGAD_IS_SANDBOX` | Toggle live vs sandbox URL | Set to `false` in production |
| `SSLCOMMERZ_STORE_ID`| SSLCommerz Store ID | Store identifier |
| `SSLCOMMERZ_STORE_PASS`| SSLCommerz Store Password | Store password |
| `SSLCOMMERZ_IS_LIVE` | Toggle live vs sandbox URL | Set to `true` in production |

### Object Storage (Cloudflare R2 / AWS S3)
| Variable | Description | Notes |
| :--- | :--- | :--- |
| `STORAGE_ENDPOINT` | S3 API endpoint URL | e.g. `https://<account>.r2.cloudflarestorage.com` |
| `STORAGE_BUCKET` | Upload bucket name | e.g. `salon-production-media` |
| `STORAGE_ACCESS_KEY_ID` | Storage access key | Min-privilege IAM user |
| `STORAGE_SECRET_ACCESS_KEY` | Storage secret key | Secure secret |
| `STORAGE_REGION` | Storage region | `auto` for Cloudflare R2 |

## 3. Health Probes & Kubernetes / ECS Configuration
- **Liveness Probe**: `GET /health/live` (Checks process health & responsiveness).
  ```yaml
  livenessProbe:
    httpGet:
      path: /health/live
      port: 4000
    initialDelaySeconds: 15
    periodSeconds: 10
  ```
- **Readiness Probe**: `GET /health/ready` (Validates MongoDB ping & Redis ping).
  ```yaml
  readinessProbe:
    httpGet:
      path: /health/ready
      port: 4000
    initialDelaySeconds: 20
    periodSeconds: 10
  ```

## 4. Background Workers & Cron Jobs
- The BullMQ queue processors (`NotificationProcessor`, `ReminderProcessor`, `CampaignProcessor`) run inside `apps/api` with graceful shutdown hooks (`app.enableShutdownHooks()`).
- In high-throughput deployments, the API instances can be separated into Web and Worker roles using `QUEUE_WORKER_ONLY=true`.
