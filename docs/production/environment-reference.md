# Production Environment Reference

This document catalogs every environment variable required by the Salon & Spa modular-monolith platform for production deployments across `apps/api`, `apps/admin`, and `apps/booking`.

> [!CAUTION]
> **Zero Secret Commitment**: Never commit `.env` files or write live credentials into source control. All sensitive keys must be injected via secret managers (AWS Secrets Manager, Cloudflare Secrets, or HashiCorp Vault) into container runtime environments.

---

## 1. Core Server & Environment

| Variable Name | Required | Default / Format | Description & Production Security Guidance |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **YES** | `production` | Set strictly to `production`. Disables stack-trace leaks, enables pino JSON logs, enforces JWKS verification. |
| `API_PORT` | NO | `4000` | Port for the NestJS API application server. |
| `WEB_ORIGINS` | **YES** | Comma-separated URLs | Allowed CORS origins for browser web apps. E.g.: `https://admin.yourdomain.com,https://booking.yourdomain.com`. |

---

## 2. Database & Data Persistence

| Variable Name | Required | Example Format | Production Guidance |
| :--- | :---: | :--- | :--- |
| `MONGODB_URI` | **YES** | `mongodb://user:pass@host1:27017,host2:27017/salon?replicaSet=rs0&ssl=true&authSource=admin` | **Must be a replica set** to support multi-document ACID transactions for bookings, inventory, and ledger mutations. Enable TLS/SSL. |
| `REDIS_URL` | **YES** | `rediss://:authpass@redis-cluster.internal:6379` | Distributed Redis instance powering sliding-window rate limiting, BullMQ workers, and Socket.IO multi-node clustering. |

---

## 3. Identity & Authentication (Supabase IdP)

| Variable Name | Required | Example Format | Production Guidance |
| :--- | :---: | :--- | :--- |
| `SUPABASE_URL` | **YES** | `https://<project-ref>.supabase.co` | Base URL of the Supabase project used strictly as an Identity Provider. |
| `SUPABASE_JWKS_URL` | **YES** | `https://<project-ref>.supabase.co/rest/v1/auth/jwks` | Production RS256/ES256 JWKS endpoint for cryptographic signature verification. |
| `SUPABASE_JWT_SECRET` | NO | 64+ char random string | Fallback HMAC secret. In production, `SUPABASE_JWKS_URL` takes precedence. |

---

## 4. Payment Gateways (Bangladesh Mobile Financial Services & Card Rails)

### 4.1 bKash Tokenized Checkout
| Variable Name | Required | Format | Production Guidance |
| :--- | :---: | :--- | :--- |
| `BKASH_APP_KEY` | **YES** | String | Merchant App Key issued by bKash Merchant Portal. |
| `BKASH_APP_SECRET` | **YES** | String | Secret key for token grant and signature generation. |
| `BKASH_USERNAME` | **YES** | String | Merchant username. |
| `BKASH_PASSWORD` | **YES** | String | Merchant password. |
| `BKASH_WEBHOOK_SECRET` | **YES** | String | Secret used to verify incoming webhook HMAC-SHA256 signatures (`x-signature`). |
| `BKASH_IS_SANDBOX` | **YES** | `false` | Must be explicitly `false` in production. |

### 4.2 Nagad Direct Integration
| Variable Name | Required | Format | Production Guidance |
| :--- | :---: | :--- | :--- |
| `NAGAD_MERCHANT_ID` | **YES** | String | 16-character Merchant Identifier from Nagad. |
| `NAGAD_PUBLIC_KEY` | **YES** | PEM format | Nagad's RSA Public Key used for payload encryption and signature verification. |
| `NAGAD_PRIVATE_KEY` | **YES** | PEM format | Merchant's RSA Private Key used for digital signing and callback decryption. |
| `NAGAD_IS_SANDBOX` | **YES** | `false` | Must be explicitly `false` in production. |

### 4.3 SSLCommerz Gateway
| Variable Name | Required | Format | Production Guidance |
| :--- | :---: | :--- | :--- |
| `SSLCOMMERZ_STORE_ID` | **YES** | String | Store ID provided by SSLCommerz. |
| `SSLCOMMERZ_STORE_PASS` | **YES** | String | Store Password used for IPN hash validation and server-to-server validation API. |
| `SSLCOMMERZ_IS_LIVE` | **YES** | `true` | Must be explicitly `true` in production to use `securepay.sslcommerz.com`. |

---

## 5. Object Storage (Cloudflare R2 / AWS S3)

| Variable Name | Required | Format | Production Guidance |
| :--- | :---: | :--- | :--- |
| `STORAGE_ENDPOINT` | **YES** | `https://<account-id>.r2.cloudflarestorage.com` | S3-compatible API endpoint. |
| `STORAGE_BUCKET` | **YES** | String | Name of the bucket (e.g., `salon-production-media`). |
| `STORAGE_ACCESS_KEY_ID` | **YES** | String | AWS / R2 Access Key ID. |
| `STORAGE_SECRET_ACCESS_KEY` | **YES** | String | Secret Access Key with write/read permissions on the bucket. |
| `STORAGE_REGION` | NO | `auto` / `us-east-1` | S3 region (defaults to `auto` for Cloudflare R2). |
| `STORAGE_PUBLIC_BASE_URL` | NO | `https://media.yourdomain.com` | Optional CDN public domain for public assets; private customer files remain presigned only. |

---

## 6. Frontend Applications

### 6.1 Admin App (`apps/admin`)
| Variable Name | Required | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **YES** | Public Supabase project URL for browser auth initialization. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **YES** | Public Supabase anonymous client key. |
| `NEXT_PUBLIC_API_URL` | **YES** | Backend API base URL (`https://api.yourdomain.com`). |

### 6.2 Customer Booking Portal (`apps/booking`)
| Variable Name | Required | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | **YES** | Backend API base URL (`https://api.yourdomain.com`). |
| `NEXT_PUBLIC_APP_URL` | **YES** | Base URL of booking portal for sharing links and callbacks. |
