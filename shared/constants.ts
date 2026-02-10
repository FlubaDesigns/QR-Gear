export const DEFAULT_MEMBER_PROFIT_SHARE = 0.25;

export function formatProfitSharePercent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
