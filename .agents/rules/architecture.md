---
trigger: always_on
description: Monorepo architecture, package boundaries, and modular monolith principles
---

# Architecture Rules

## 1. Monorepo Organization
The repository is structured as a pnpm Turborepo modular monolith:
- `apps/api`: NestJS backend REST API on port 4000
- `apps/booking`: Customer-facing Next.js 14 App Router booking application on port 3001
- `apps/admin`: Salon management & staff Next.js 14 App Router admin portal on port 3000
- `packages/shared`: Shared TypeScript types, DTO contracts, enums, and constants
- `packages/tailwind-config`: Shared Tailwind CSS tokens and themes
- `packages/typescript-config`: Shared TypeScript `tsconfig.base.json` presets

## 2. Dependency Flow & Boundary Integrity
- `apps/*` may depend on `packages/*`.
- `packages/*` must NEVER depend on `apps/*`.
- `apps/booking` and `apps/admin` communicate with the backend exclusively via HTTP REST endpoints provided by `apps/api`. They must never share database connections or import internal NestJS services directly.
- Shared domain types and contracts belong in `packages/shared`. When an API response shape changes, update `packages/shared` first, then adapt the backend and frontend consumers.

## 3. NestJS Modular Backend Pattern
- Each domain (e.g., appointments, services, staff, customers, payments, notifications) must reside in its own NestJS module within `apps/api/src/modules/<domain>/`.
- A module must encapsulate its controller, service, repository queries, and DTOs.
- Cross-module communication must use exported services or domain events, never direct database queries into another domain's tables.
- Prisma ORM is the single source of truth for database schema and migrations (`apps/api/prisma/schema.prisma`).

## 4. Frontend Component & Route Architecture
- Follow Next.js 14 App Router conventions (`app/[locale]/...` or `app/...`).
- Keep Server Components as the default for data fetching and static markup.
- Use `"use client"` only when interactivity, browser APIs, or state hooks are required.
- Place reusable UI components in `components/ui/` and feature-specific components in `components/<feature>/`.
