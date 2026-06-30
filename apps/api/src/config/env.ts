import { z } from 'zod';

// Insecure dev fallback so HS256 token-minting works locally with zero Supabase
// setup. Production MUST set a real SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET.
export const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me';

// Schema-validated environment. Localhost defaults so `pnpm dev` boots with zero
// config; a root .env overrides for other environments.
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z
      .string()
      .min(1)
      .default('mongodb://localhost:27017/salon?replicaSet=rs0&directConnection=true'),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    WEB_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
    // Supabase = IdP only. Validate JWKS (RS256/ES256) when set, else the shared
    // secret (HS256). The dev default makes local auth work without a project.
    SUPABASE_URL: z.string().default(''),
    SUPABASE_JWKS_URL: z.string().default(''),
    SUPABASE_JWT_SECRET: z.string().default(DEV_JWT_SECRET),
  })
  .refine(
    (e) =>
      e.NODE_ENV !== 'production' ||
      e.SUPABASE_JWKS_URL.length > 0 ||
      (e.SUPABASE_JWT_SECRET.length > 0 && e.SUPABASE_JWT_SECRET !== DEV_JWT_SECRET),
    { message: 'production requires a real SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET' },
  );

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }
  return parsed.data;
}
