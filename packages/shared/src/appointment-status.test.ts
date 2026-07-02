import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, isTerminal } from './appointment-status.js';

describe('appointment status machine', () => {
  it('allows the happy path', () => {
    expect(canTransition('booked', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'checked_in')).toBe(true);
    expect(canTransition('checked_in', 'in_service')).toBe(true);
    expect(canTransition('in_service', 'completed')).toBe(true);
  });

  it('allows cancellation before service, no_show before check-in', () => {
    expect(canTransition('booked', 'cancelled')).toBe(true);
    expect(canTransition('confirmed', 'no_show')).toBe(true);
    expect(canTransition('in_service', 'cancelled')).toBe(true);
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('booked', 'in_service')).toBe(false);
    expect(canTransition('booked', 'completed')).toBe(false);
    expect(canTransition('checked_in', 'no_show')).toBe(false);
  });

  it('terminal states go nowhere', () => {
    for (const t of ['completed', 'cancelled', 'no_show'] as const) {
      expect(isTerminal(t)).toBe(true);
      expect(allowedTransitions(t)).toHaveLength(0);
      expect(canTransition(t, 'booked')).toBe(false);
    }
  });
});
