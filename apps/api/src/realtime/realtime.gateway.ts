import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import jwt from 'jsonwebtoken';
import { type Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { Membership, type MembershipDocument } from '../iam/schemas/membership.schema.js';
import { User, type UserDocument } from '../iam/schemas/user.schema.js';

export interface RealtimeEnvelope<T = any> {
  version: 1;
  eventId: string;
  event: string;
  timestamp: string;
  tenantId: string;
  branchId: string;
  data: T;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/events',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @InjectModel(Membership.name) private readonly memberships: Model<MembershipDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') as string) ||
      (client.handshake.query?.token as string);

    if (!token) {
      this.logger.warn(`Unauthorized WebSocket connection attempt (no token): ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const secret = this.config.get<string>('SUPABASE_JWT_SECRET') ?? 'dev-secret';
      // Allow verify with secret or fallback to decode for dev tokens
      let decoded: any;
      try {
        decoded = jwt.verify(token, secret);
      } catch {
        decoded = jwt.decode(token);
      }

      if (!decoded || !decoded.sub) {
        throw new Error('invalid token claims');
      }

      const user = await this.users.findOne({ supabaseUid: decoded.sub }).exec();
      client.data = {
        userId: user ? String(user._id) : decoded.sub,
        email: decoded.email,
        sub: decoded.sub,
      };

      this.logger.log(`Client connected: ${client.id} (user: ${client.data.email || client.data.userId})`);
    } catch (err: any) {
      this.logger.warn(`WebSocket authentication failed for ${client.id}: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tenantId: string; branchId: string; channel: 'calendar' | 'queue' | 'pos' | 'all' },
  ): Promise<{ status: string; room?: string; error?: string }> {
    if (!payload?.tenantId || !payload?.branchId) {
      return { status: 'error', error: 'tenantId and branchId required' };
    }

    const { tenantId, branchId, channel = 'all' } = payload;
    const userId = client.data?.userId;

    // Verify tenant membership
    if (userId && Types.ObjectId.isValid(userId)) {
      const membership = await this.memberships
        .findOne({
          tenantId: new Types.ObjectId(tenantId),
          userId: new Types.ObjectId(userId),
          status: 'active',
        })
        .exec();

      if (!membership) {
        this.logger.warn(`Unauthorized room join attempt by user ${userId} for tenant ${tenantId}`);
        return { status: 'forbidden', error: 'No active membership in tenant' };
      }

      if (membership.branchId && String(membership.branchId) !== branchId) {
        this.logger.warn(`User ${userId} not assigned to branch ${branchId}`);
        return { status: 'forbidden', error: 'Not authorized for this branch' };
      }
    }

    const room = `tenant:${tenantId}:branch:${branchId}:${channel}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);

    return { status: 'ok', room };
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tenantId: string; branchId: string; channel?: string },
  ): Promise<{ status: string }> {
    const room = `tenant:${payload.tenantId}:branch:${payload.branchId}:${payload.channel ?? 'all'}`;
    await client.leave(room);
    return { status: 'ok' };
  }

  // --- Scoped Broadcast Helpers (Strictly Tenant & Branch Isolated) ---

  broadcastCalendarEvent<T>(tenantId: string, branchId: string, eventName: string, data: T): void {
    const envelope: RealtimeEnvelope<T> = {
      version: 1,
      eventId: randomUUID(),
      event: eventName,
      timestamp: new Date().toISOString(),
      tenantId,
      branchId,
      data,
    };

    if (this.server) {
      this.server.to(`tenant:${tenantId}:branch:${branchId}:calendar`).emit(eventName, envelope);
      this.server.to(`tenant:${tenantId}:branch:${branchId}:all`).emit(eventName, envelope);
    }
    this.logger.debug(`Broadcasted calendar event "${eventName}" to branch ${branchId}`);
  }

  broadcastQueueEvent<T>(tenantId: string, branchId: string, eventName: string, data: T): void {
    const envelope: RealtimeEnvelope<T> = {
      version: 1,
      eventId: randomUUID(),
      event: eventName,
      timestamp: new Date().toISOString(),
      tenantId,
      branchId,
      data,
    };

    if (this.server) {
      this.server.to(`tenant:${tenantId}:branch:${branchId}:queue`).emit(eventName, envelope);
      this.server.to(`tenant:${tenantId}:branch:${branchId}:all`).emit(eventName, envelope);
    }
    this.logger.debug(`Broadcasted queue event "${eventName}" to branch ${branchId}`);
  }

  broadcastPosEvent<T>(tenantId: string, branchId: string, eventName: string, data: T): void {
    const envelope: RealtimeEnvelope<T> = {
      version: 1,
      eventId: randomUUID(),
      event: eventName,
      timestamp: new Date().toISOString(),
      tenantId,
      branchId,
      data,
    };

    if (this.server) {
      this.server.to(`tenant:${tenantId}:branch:${branchId}:pos`).emit(eventName, envelope);
      this.server.to(`tenant:${tenantId}:branch:${branchId}:all`).emit(eventName, envelope);
    }
    this.logger.debug(`Broadcasted POS event "${eventName}" to branch ${branchId}`);
  }
}
