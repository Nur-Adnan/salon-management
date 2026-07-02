import type { AppointmentStatus } from './enums.js';

// The appointment status machine. Only these transitions are legal; the API
// rejects anything else. Terminal states have no outgoing transitions.
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  booked: ['confirmed', 'checked_in', 'no_show', 'cancelled'],
  confirmed: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['in_service', 'cancelled'],
  in_service: ['completed', 'cancelled'],
  completed: [],
  no_show: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: readonly AppointmentStatus[] = ['completed', 'no_show', 'cancelled'];

// Transitions that free the staff/resource slots again (the time is gone or void).
export const RELEASING_STATUSES: readonly AppointmentStatus[] = ['completed', 'no_show', 'cancelled'];

export const canTransition = (from: AppointmentStatus, to: AppointmentStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const allowedTransitions = (from: AppointmentStatus): readonly AppointmentStatus[] =>
  TRANSITIONS[from];

export const isTerminal = (s: AppointmentStatus): boolean => TERMINAL_STATUSES.includes(s);
