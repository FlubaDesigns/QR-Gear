/** Supported integrations are capabilities; the selected provider is saved admin data. */
export const FULFILLMENT_PROVIDERS = [
  { value: 'printful', label: 'Printful' },
  { value: 'printify', label: 'Printify' },
] as const;
export type FulfillmentProviderChoice = typeof FULFILLMENT_PROVIDERS[number]['value'];

export function requireFulfillmentProvider(value: unknown): FulfillmentProviderChoice {
  if (!FULFILLMENT_PROVIDERS.some(provider => provider.value === value)) {
    throw new Error('Choose a fulfillment provider in Admin → Build → Products.');
  }
  return value as FulfillmentProviderChoice;
}
