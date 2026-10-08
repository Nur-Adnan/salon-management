# Stage F Roadmap — Phase 12: Real-Time Synchronization

## 1. Objective
Enable bi-directional, multi-tenant real-time synchronization across administrative dashboards, appointment calendar grids, customer walk-in queues, and active POS checkout sessions with zero cross-tenant leakage and robust reconnection resilience.

## 2. Architecture
```
Database Transaction Committed
         ↓
Domain Event Emitted (EventBus / Service)
         ↓
RealtimeGateway (`apps/api/src/realtime/realtime.gateway.ts`)
         ↓
Room Resolution (`tenant:{tenantId}:branch:{branchId}:{roomType}`)
         ↓
Authenticated WebSockets Clients (Socket.IO with Redis Adapter)
```
- **Gateway**: NestJS `@WebSocketGateway({ cors: true })` with namespace `/events` or root.
- **Transport**: WebSockets primary with long-polling fallback.
- **Adapter**: Redis Pub/Sub adapter for horizontal clustering across multi-instance API deployments.

## 3. Dependencies
- `socket.io` & `@nestjs/websockets` / `@nestjs/platform-socket.io`
- `@socket.io/redis-adapter` (backed by existing Redis infrastructure)
- Supabase JWT verification on connection handshake

## 4. Database Changes
No new collections required. Existing collections (`Appointment`, `Sale`, `Customer`) trigger post-commit domain events through the `EventBus` or direct gateway dispatch.

## 5. API & Gateway Surface
- **Handshake Auth**: `auth: { token: string }` validated against `JwtAuthGuard` / Supabase public keys or HMAC secret.
- **Rooms**:
  - `tenant:{tenantId}:branch:{branchId}:calendar` — appointment creation, status changes, reschedules, cancellations.
  - `tenant:{tenantId}:branch:{branchId}:queue` — walk-in queue position updates and wait times.
  - `tenant:{tenantId}:branch:{branchId}:pos` — sale completion, stock lock / inventory updates.
- **Client Actions**:
  - `join_branch_room({ tenantId, branchId, room })` — strictly validated against the user's verified token claims.

## 6. Security Requirements
- **Tenant Isolation**: Handshake rejects unauthenticated sockets immediately. Room joins require verified membership in the requested `tenantId` and `branchId`.
- **Privilege Separation**: Client app / public booking cannot subscribe to internal POS or staff earnings rooms.
- **DDoS & Flooding**: Limit connection attempts and packet rates per socket IP via rate limiting.

## 7. Tests & Validation
- Handshake without JWT → rejection.
- Handshake with valid JWT → connection accepted, user metadata attached.
- Cross-tenant room join attempt → `ForbiddenException` / socket error.
- Event broadcast fires only to matching tenant/branch rooms.
- Reconnect replay and state catch-up verification.

## 8. Rollout & Rollback
- **Rollout**: Enable gateway on API instances; clients connect progressively with fallback to REST polling if WebSocket connection fails.
- **Rollback**: Disable frontend WebSocket listeners; system degrades cleanly to existing HTTP polling.
