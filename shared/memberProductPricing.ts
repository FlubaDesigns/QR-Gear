/** Existing catalog/member markup policy, shared by tiered and curated choices. */
export function memberProductPricing(cost: number | null, settings: Record<string, any>) {
  const retailPrice = cost === null ? null : Math.ceil((cost * (1 + (settings.markupPercent ?? 25) / 100) + (settings.markupFixed ?? 0)) * 100) / 100;
  const memberEarnings = retailPrice === null || cost === null ? null : Math.round((retailPrice - cost) * (settings.memberProfitShare ?? 0.25) * 100) / 100;
  return { retailPrice, memberEarnings };
}
