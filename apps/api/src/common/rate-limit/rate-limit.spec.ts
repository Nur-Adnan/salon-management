import { describe, expect, it, beforeEach } from 'vitest';
import { RateLimitService } from './rate-limit.service.js';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
    service.resetMemoryStore();
  });

  it('allows requests within point limit', async () => {
    const res1 = await service.consume('192.168.1.1', 3, 60, 'test');
    expect(res1.allowed).toBe(true);
    expect(res1.total).toBe(1);
    expect(res1.remaining).toBe(2);

    const res2 = await service.consume('192.168.1.1', 3, 60, 'test');
    expect(res2.allowed).toBe(true);
    expect(res2.total).toBe(2);
    expect(res2.remaining).toBe(1);

    const res3 = await service.consume('192.168.1.1', 3, 60, 'test');
    expect(res3.allowed).toBe(true);
    expect(res3.total).toBe(3);
    expect(res3.remaining).toBe(0);
  });

  it('rejects requests exceeding points limit', async () => {
    await service.consume('192.168.1.2', 2, 60, 'test');
    await service.consume('192.168.1.2', 2, 60, 'test');

    const blocked = await service.consume('192.168.1.2', 2, 60, 'test');
    expect(blocked.allowed).toBe(false);
    expect(blocked.total).toBe(3);
    expect(blocked.remaining).toBe(0);
  });

  it('isolates different identifiers and prefixes', async () => {
    await service.consume('user-a', 1, 60, 'auth');
    const blockedA = await service.consume('user-a', 1, 60, 'auth');
    expect(blockedA.allowed).toBe(false);

    // user-b is unaffected
    const resB = await service.consume('user-b', 1, 60, 'auth');
    expect(resB.allowed).toBe(true);

    // user-a on a different prefix is unaffected
    const resAOtherPrefix = await service.consume('user-a', 1, 60, 'booking');
    expect(resAOtherPrefix.allowed).toBe(true);
  });
});
