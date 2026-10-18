/** Current paid codes are 24 hex characters; admin-issued codes are 12 case-sensitive alphanumerics. */
export const CLAIM_CODE_MAX_LENGTH = 24;
export function normalizeClaimCode(value: string) {
  const code = value.trim();
  return /^[a-f0-9]{24}$/i.test(code) ? code.toUpperCase() : code;
}
export function isClaimCode(value: string) {
  return /^(?:[a-fA-F0-9]{24}|[A-Za-z0-9]{12})$/.test(value.trim());
}
