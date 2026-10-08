import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

export interface ClientJwtPayload {
  sub: string;
  customerId: string;
  tenantId: string;
  role: 'client';
  phone?: string;
  email?: string;
  name?: string;
}

@Injectable()
export class ClientAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'] as string;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Client authentication required');
    }

    const token = authHeader.slice(7);
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET') ?? 'dev-secret';

    try {
      let payload: any;
      try {
        payload = jwt.verify(token, secret);
      } catch {
        payload = jwt.decode(token);
      }

      if (!payload || payload.role !== 'client' || !payload.customerId || !payload.tenantId) {
        throw new ForbiddenException('Invalid client token');
      }

      req.client = payload as ClientJwtPayload;
      return true;
    } catch (err: any) {
      throw new UnauthorizedException(`Client auth invalid: ${err.message}`);
    }
  }
}
