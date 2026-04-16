/**
 * safeAssign — prevents null/empty/undefined provider values from
 * overwriting previously-curated, non-empty data during sync operations.
 *
 * Returns `incoming` only when it is a non-empty, non-null string.
 * Otherwise the existing value is preserved unchanged.
 *
 * Usage:
 *   title = safeAssign(existing.title, providerTitle);
 *   description = safeAssign(existing.description, providerDescription);
 */
export function safeAssign(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  if (incoming === null || incoming === undefined || String(incoming).trim() === "") {
    return existing ?? null;
  }
  return incoming;
}

/**
 * safeAssignRequired — same as safeAssign but always returns a string,
 * never null. Falls back to existing, then to the fallback, then to ''.
 */
export function safeAssignRequired(
  existing: string | null | undefined,
  incoming: string | null | undefined,
  fallback = ""
): string {
  if (incoming !== null && incoming !== undefined && String(incoming).trim() !== "") {
    return incoming;
  }
  if (existing !== null && existing !== undefined && String(existing).trim() !== "") {
    return existing;
  }
  return fallback;
}
