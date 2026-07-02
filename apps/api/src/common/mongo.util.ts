// Mongo duplicate-key (E11000) -> map to a 409 in callers. Handles both single
// writes and insertMany bulk-write errors (used by the slot-reservation guard).
export function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: number; writeErrors?: Array<{ code?: number }> };
  if (e.code === 11000) return true;
  return Array.isArray(e.writeErrors) && e.writeErrors.some((w) => w?.code === 11000);
}
