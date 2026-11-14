// Keep a purchase intent across remounts, reloads and lost network responses.
// Never rotate it on an ambiguous network/provider error.
function storageKey(scope: string, selection: unknown) {
  return `qrgear_checkout:${scope}:${JSON.stringify(selection)}`;
}
export function checkoutAttemptId(scope: string, selection: unknown): string {
  try {
    const key = storageKey(scope, selection);
    const saved = window.sessionStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(key, id);
    return id;
  } catch {
    throw new Error('Allow browser storage so checkout can safely recover if your connection is interrupted.');
  }
}
export function releaseCheckoutAttempt(scope: string, selection: unknown) {
  window.sessionStorage.removeItem(storageKey(scope, selection));
}
