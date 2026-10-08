---
trigger: always_on
description: Security standards, secret management, OWASP Top 10 mitigation, auth, and permissions
---

# Security Standards

## 1. Secrets & Credentials Hygiene
- **Never Commit Secrets**: Never commit `.env`, `.env.local`, API keys, JWT secrets, database connection strings, or cloud tokens to version control.
- Ensure `.gitignore` ignores all `.env*` except `.env.example`.
- `.env.example` must contain only dummy placeholders, never active production credentials.
- When displaying logs or command output, mask all authorization headers and credentials.

## 2. Authentication & Authorization
- Use JWT tokens signed with strong algorithms (`HS256` or `RS256`) and short expiration windows (`15m` access token, `7d` refresh token).
- Implement Role-Based Access Control (RBAC) with guards: `RolesGuard` checking roles: `SUPER_ADMIN`, `ADMIN`, `STAFF`, `CUSTOMER`.
- Enforce strict resource-level permission checks (e.g., a customer can only view or cancel their own appointments; staff can only access their salon tenant).

## 3. OWASP Top 10 Protections
- **SQL Injection**: Prevented by utilizing Prisma ORM parameterized queries. Never use raw string interpolation in `$queryRaw`.
- **Cross-Site Scripting (XSS)**: Rely on React's automatic JSX encoding. Avoid `dangerouslySetInnerHTML`. If necessary, sanitize with `DOMPurify`.
- **Cross-Site Request Forgery (CSRF)**: For cookie-based sessions, use `SameSite=Strict` or `Lax` and CSRF tokens.
- **Rate Limiting**: Protect authentication endpoints (`/auth/login`, `/auth/register`) with `@nestjs/throttler` (e.g., max 5 attempts per minute).
- **Secure Headers**: Apply `helmet` in NestJS and secure header configs in Next.js (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`).
