import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';
import type { Env } from '../../config/env.js';

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  [k: string]: unknown;
}

// Verify JWKS (RS256/ES256) when SUPABASE_JWKS_URL is set, else the shared secret
// (HS256). Lets prod use Supabase's asymmetric keys while dev mints HS256 tokens.
function buildOptions(config: ConfigService<Env, true>): StrategyOptions {
  const jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
  const jwks = config.get('SUPABASE_JWKS_URL', { infer: true });
  if (jwks) {
    return {
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({ jwksUri: jwks, cache: true, rateLimit: true }),
      algorithms: ['RS256', 'ES256'],
    };
  }
  return {
    jwtFromRequest,
    ignoreExpiration: false,
    secretOrKey: config.get('SUPABASE_JWT_SECRET', { infer: true }),
    algorithms: ['HS256'],
  };
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<Env, true>) {
    // We never set passReqToCallback, so this is the "without request" variant.
    super(buildOptions(config) as StrategyOptions & { passReqToCallback?: false });
  }

  validate(payload: SupabaseJwtPayload): SupabaseJwtPayload {
    if (!payload?.sub) throw new UnauthorizedException('token missing sub');
    if (!payload.email) throw new UnauthorizedException('token missing email');
    return payload;
  }
}
