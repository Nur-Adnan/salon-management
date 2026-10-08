---
trigger: always_on
description: TypeScript, linting, formatting, and general coding standards
---

# Coding Standards

## 1. TypeScript Strictness
- Strict type checking is enforced across all apps and packages (`tsconfig.base.json`).
- Never use `any`. Use `unknown` with type narrowing, generics, or discriminated unions.
- Define explicit return types on public service methods and exported utility functions.
- Favor `interface` for object contracts and `type` for unions, intersections, and utility types.

## 2. Formatting & Linting
- Formatting must follow `.prettierrc.json`: 2 spaces, single quotes, trailing commas (`es5`), 100 print width.
- Code must pass ESLint with zero warnings (`pnpm lint`).
- Imports must be ordered logically:
  1. Node built-ins (`node:path`, `node:fs`)
  2. External dependencies (`react`, `@nestjs/common`)
  3. Internal workspace packages (`@salon/shared`)
  4. Relative internal imports (`../services/...`, `./types`)

## 3. Naming Conventions
- Files: kebab-case for utilities, modules, and scripts (e.g., `appointment.service.ts`, `date-utils.ts`); PascalCase for React component files (e.g., `BookingCalendar.tsx`).
- Classes and Interfaces: PascalCase (e.g., `AppointmentService`, `CreateBookingDto`).
- Functions and Variables: camelCase (e.g., `fetchAvailableSlots`, `currentSlot`).
- Constants & Enums: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_ATTEMPTS`, `BookingStatus.CONFIRMED`).

## 4. Error Handling
- Never swallow errors silently. Always catch, log contextual details, and throw a typed domain exception or return a structured error response.
- In NestJS, throw standard HTTP exceptions (`NotFoundException`, `BadRequestException`, `ConflictException`).
- In React components, use Error Boundaries and user-friendly error banners or toast notifications.
