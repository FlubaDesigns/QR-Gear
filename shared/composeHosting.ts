/** Terms supported by the existing QR Dynamics expiry contract. */
export const COMPOSE_HOSTING_YEARS: Readonly<Record<string, number>> = Object.freeze({
  '1_year': 1, '3_year': 3, '5_year': 5,
});

export function isComposeHostingCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMPOSE_HOSTING_YEARS, code);
}
