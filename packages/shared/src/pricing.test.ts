import { describe, expect, it } from 'vitest';
import { money } from './money.js';
import { componentsTotal, packageSavings } from './pricing.js';

describe('package pricing', () => {
  it('sums price × quantity across components', () => {
    // 2 × 500 (haircut) + 1 × 1200 (color) = 2200 poisha
    const total = componentsTotal([
      { price: money(500), quantity: 2 },
      { price: money(1200), quantity: 1 },
    ]);
    expect(total.amount).toBe(2200);
  });

  it('empty package => zero', () => {
    expect(componentsTotal([]).amount).toBe(0);
  });

  it('computes savings vs a discounted package price', () => {
    const total = componentsTotal([{ price: money(2200), quantity: 1 }]);
    expect(packageSavings(total, money(2000)).amount).toBe(200);
  });

  it('premium bundle => negative savings', () => {
    const total = componentsTotal([{ price: money(2000), quantity: 1 }]);
    expect(packageSavings(total, money(2200)).amount).toBe(-200);
  });

  it('rejects fractional quantity (no float prices)', () => {
    expect(() => componentsTotal([{ price: money(500), quantity: 1.5 }])).toThrow();
  });
});
