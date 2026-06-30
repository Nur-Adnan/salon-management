import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('applies localhost defaults when infra URLs are absent', () => {
    const env = validateEnv({ NODE_ENV: 'test' });
    expect(env.API_PORT).toBe(4000);
    expect(env.MONGODB_URI).toContain('mongodb://');
    expect(env.REDIS_URL).toContain('redis://');
  });

  it('coerces API_PORT from a string', () => {
    expect(validateEnv({ API_PORT: '5000' }).API_PORT).toBe(5000);
  });

  it('rejects a non-numeric port', () => {
    expect(() => validateEnv({ API_PORT: 'abc' })).toThrow(/Invalid environment/);
  });
});
