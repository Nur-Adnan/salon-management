import { describe, expect, it } from 'vitest';
import { add, isNegative, money, mulInt, subtract, zero } from './money.js';

describe('money (integer minor units)', () => {
  it('adds without float error (10.99 + 0.01 BDT)', () => {
    expect(add(money(1099), money(1)).amount).toBe(1100);
  });

  it('multiplies by integer qty', () => {
    expect(mulInt(money(250), 3).amount).toBe(750);
  });

  it('subtracts and may go negative (a due balance)', () => {
    const r = subtract(money(10_000), money(15_000));
    expect(r.amount).toBe(-5_000);
    expect(isNegative(r)).toBe(true);
  });

  it('rejects non-integer minor units', () => {
    expect(() => money(10.5)).toThrow(RangeError);
  });

  it('rejects fractional qty', () => {
    expect(() => mulInt(money(100), 1.5)).toThrow(TypeError);
  });

  it('rejects currency mismatch at runtime', () => {
    // @ts-expect-error deliberately passing a non-BDT currency to hit the guard
    expect(() => add(money(1), { amount: 1, currency: 'USD' })).toThrow(TypeError);
  });

  it('zero is 0 BDT', () => {
    expect(zero()).toEqual({ amount: 0, currency: 'BDT' });
  });
});
