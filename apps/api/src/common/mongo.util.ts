// Mongo duplicate-key (E11000) -> map to a 409 in callers.
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}
