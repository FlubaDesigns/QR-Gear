/** Etsy seller choices on the existing MarketplaceListing.publishOptions record. */
export const ETSY_WHO_MADE = ['i_did', 'someone_else', 'collective'] as const;
export const ETSY_WHEN_MADE = ['made_to_order', '2020_2026', '2010_2019', '2007_2009', 'before_2007', '2000_2006', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s', '1930s', '1920s', '1910s', '1900s', '1800s', '1700s', 'before_1700'] as const;
export interface EtsySellerSettings {
  taxonomyId: number;
  shippingProfileId: number;
  readinessStateId: number;
  returnPolicyId?: number;
  whoMade: typeof ETSY_WHO_MADE[number];
  whenMade: typeof ETSY_WHEN_MADE[number];
  quantity: number;
  autoRenew: boolean;
  productionPartnerIds: number[];
}
export interface EtsySetupOptions {
  categories: Array<{ id: number; name: string }>;
  shippingProfiles: Array<{ id: number; name: string }>;
  processingProfiles: Array<{ id: number; name: string }>;
  returnPolicies: Array<{ id: number; name: string }>;
  productionPartners: Array<{ id: number; name: string }>;
  currency: string;
}
export function validateEtsySettings(input: any): EtsySellerSettings {
  if (!input || typeof input !== 'object') throw new Error('Save Etsy Setup before publishing.');
  const result: any = {};
  for (const key of ['taxonomyId', 'shippingProfileId', 'readinessStateId']) {
    if (!Number.isSafeInteger(input[key]) || input[key] <= 0) throw new Error(`Choose Etsy ${key}.`);
    result[key] = input[key];
  }
  if (input.returnPolicyId != null) {
    if (!Number.isSafeInteger(input.returnPolicyId) || input.returnPolicyId <= 0) throw new Error('Choose a valid Etsy return policy.');
    result.returnPolicyId = input.returnPolicyId;
  }
  if (!ETSY_WHO_MADE.includes(input.whoMade) || !ETSY_WHEN_MADE.includes(input.whenMade)) throw new Error('Choose who made this item and when.');
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 0 || input.quantity > 999) throw new Error('Etsy quantity must be a whole number from 0 to 999 per variation.');
  if (typeof input.autoRenew !== 'boolean') throw new Error('Choose whether Etsy should automatically renew this listing.');
  if (!Array.isArray(input.productionPartnerIds) || input.productionPartnerIds.some((id: any) => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Choose valid production partners.');
  return { ...result, whoMade: input.whoMade, whenMade: input.whenMade, quantity: input.quantity, autoRenew: input.autoRenew, productionPartnerIds: Array.from(new Set<number>(input.productionPartnerIds)) };
}
