import { z } from 'zod';
import { LOCALES } from './enums.js';

export const localeSchema = z.enum(LOCALES);

// Sample contract used by the Phase-0 end-to-end ping (admin form -> api).
// Replaced by real domain schemas from Phase 1 onward.
export const pingRequestSchema = z.object({
  name: z.string().trim().min(1, 'required').max(80),
  note: z.string().trim().max(280).optional(),
});
export type PingRequest = z.infer<typeof pingRequestSchema>;

export const pingResponseSchema = z.object({
  pong: z.literal(true),
  correlationId: z.string(),
  greeting: z.string(),
  receivedAt: z.string(),
});
export type PingResponse = z.infer<typeof pingResponseSchema>;
