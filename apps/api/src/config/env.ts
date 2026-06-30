import { z } from 'zod';

// Schema-validated environment. Localhost defaults so `pnpm dev` boots with zero
// config; a root .env overrides for other environments.
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017/salon?replicaSet=rs0&directConnection=true'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  WEB_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  // Supabase = IdP only; wired in Phase 1. Empty/optional in Phase 0.
  SUPABASE_URL: z.string().default(''),
  SUPABASE_JWKS_URL: z.string().default(''),
  SUPABASE_JWT_SECRET: z.string().default(''),
});

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
