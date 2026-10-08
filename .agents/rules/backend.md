---
trigger: glob
glob: apps/api/**
description: Backend standards for NestJS 11, Mongoose, MongoDB, Redis, BullMQ, and REST API design
---

# Backend Engineering Standards

## 1. NestJS Architecture
- Maintain strict modular separation in `apps/api/src/modules/`.
- Controllers handle HTTP routing, request parsing, and status codes. Business logic belongs strictly in injectable `@Injectable()` Services.
- Input validation: All request payloads must be typed and validated using `Zod` schemas and `@salon/shared` contracts.

## 2. Database & Mongoose (MongoDB) Guidelines
- All database interactions must use Mongoose models injected via `@InjectModel()`.
- Multi-step writes that modify financial balances, booking reservations, or inventory must be wrapped in atomic MongoDB ClientSession transactions (`session.withTransaction`).
- Utilize lean queries (`.lean()`) for high-throughput read operations.
- Always ensure indexes (`@Prop({ index: true })` or compound indexes) exist on fields frequently queried or sorted (e.g. `tenantId`, `customerId`, `status`, `scheduledAt`).

## 3. Caching & Background Queues
- Use Redis (`ioredis`) for high-speed caching and distributed locks.
- Long-running or asynchronous operations (notifications, marketing campaigns, reports) must be dispatched via BullMQ queues (`@nestjs/bullmq`).

## 4. REST API Contract & Versioning
- Use correct HTTP status codes:
  - `200 OK`: Successful read or update
  - `201 Created`: Successful creation
  - `204 No Content`: Successful deletion
  - `400 Bad Request`: Payload validation error
  - `401 Unauthorized`: Missing or invalid bearer token
  - `403 Forbidden`: Authenticated user lacks required permission (CASL ability check)
  - `404 Not Found`: Resource does not exist
  - `409 Conflict`: Business constraint violation (e.g. double booking)
  - `500 Internal Server Error`: Unhandled server exception
- Response payloads must follow a consistent envelope structure defined in `@salon/shared`.

## 5. Concurrency & Slot Locking
- Booking appointments and checking time slots must be guarded against race conditions using Redis distributed locks (`redlock` pattern) or atomic conditional updates.
