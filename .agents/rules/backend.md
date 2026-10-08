---
trigger: glob
glob: apps/api/**
description: Backend standards for NestJS, Prisma ORM, PostgreSQL, and REST API design
---

# Backend Engineering Standards

## 1. NestJS Architecture
- Maintain strict modular separation in `apps/api/src/modules/`.
- Controllers handle HTTP routing, request parsing, and status codes. Business logic belongs strictly in injectable `@Injectable()` Services.
- Input validation: All request payloads must be typed via DTO classes decorated with `class-validator` and `class-transformer`. Apply global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`.

## 2. Database & Prisma ORM Guidelines
- All database interactions must use Prisma Client via the shared `PrismaService`.
- Multi-step writes that modify financial balances, booking reservations, or inventory must be wrapped in atomic Prisma transactions (`prisma.$transaction`).
- Avoid N+1 queries by utilizing Prisma `include` or explicit batching.
- Always use indexed fields in `where` clauses on high-volume tables (`Appointment`, `User`, `Payment`).

## 3. REST API Contract & Versioning
- API routes must be prefixed with `/api/v1/`.
- Use correct HTTP status codes:
  - `200 OK`: Successful read or update
  - `201 Created`: Successful creation
  - `204 No Content`: Successful deletion
  - `400 Bad Request`: Payload validation error
  - `401 Unauthorized`: Missing or invalid bearer token
  - `403 Forbidden`: Authenticated user lacks required permission
  - `404 Not Found`: Resource does not exist
  - `409 Conflict`: Business constraint violation (e.g. double booking)
  - `500 Internal Server Error`: Unhandled server exception
- Response payloads must follow a consistent envelope structure defined in `@salon/shared`.

## 4. Concurrency & Locking
- Booking appointments and checking time slots must be guarded against race conditions using row-level locking or optimistic concurrency tokens (`version`).
