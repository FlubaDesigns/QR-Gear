import { type DescriptionLayers, resolveDescription, resolvePublicDescription, buildDescriptionSnapshot } from './descriptionLayers';

export type WizardMode = 'member' | 'owner' | 'public';

export interface WizardProduct {
  canonicalBlankKey: string;
  title: string;
  imageUrl: string;

  fulfillmentProvider: 'printify' | 'printful';
  providerProductId: number;

  providerDescription: string;
  adminCatalogDescription: string;
  memberPacketDescription: string;
  effectiveDescription: string;

  retailPrice: number;
  memberEarnings: number;
  baseCost: number;

  availableColors: Array<{ name: string; hex: string }>;
  availableSizes: string[];

  isEditableInMemberWizard: boolean;
  isReadOnlyInOwnerWizard: boolean;
  isReadOnlyInPublicWizard: boolean;

  brand?: string;
  placements?: Array<{ id: string; title: string; widthPx?: number; heightPx?: number; widthInches?: string; heightInches?: string }>;
  hasUSAProvider?: boolean;

  variantMap?: Record<string, any>;
  selectedColor?: string;
  selectedSize?: string;
  priceSnapshot?: number;
  earningsSnapshot?: number;
  providerDescriptionSnapshot?: string;
  adminCatalogDescriptionSnapshot?: string;
  effectivePublicDescription?: string;

  blueprintId?: number;
  printProviderId?: number;
}

export interface NormalizeWizardProductInput {
  blueprintId?: number;
  providerProductId?: number;
  printProviderId?: number;
  canonicalBlankKey?: string;
  title?: string;
  imageUrl?: string | null;
  fulfillmentProvider?: string;
  brand?: string | null;

  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  memberPacketDescription?: string | null;
  effectiveDescription?: string | null;
  description?: string | null;

  retailPrice?: number;
  memberEarnings?: number;
  baseCost?: number;

  availableColors?: Array<{ name: string; hex: string }>;
  availableSizes?: string[];
  colors?: string[];
  sizes?: string[];

  hasUSAProvider?: boolean;
  placements?: Array<{ id: string; title: string; widthPx?: number; heightPx?: number; widthInches?: string; heightInches?: string }>;

  variantMap?: Record<string, any>;
  selectedColor?: string;
  selectedSize?: string;
}

function deriveCanonicalBlankKey(input: NormalizeWizardProductInput): string {
  if (input.canonicalBlankKey) return input.canonicalBlankKey;
  const id = input.blueprintId ?? input.providerProductId ?? input.printProviderId ?? 0;
  if (input.fulfillmentProvider === 'printful') {
    return `pf:${id}`;
  }
  return String(id);
}

export function normalizeWizardProduct(
  input: NormalizeWizardProductInput,
  mode: WizardMode = 'member'
): WizardProduct {
  const providerDesc = input.providerDescription || input.description || '';
  const adminDesc = input.adminCatalogDescription || '';
  const memberDesc = input.memberPacketDescription || '';

  const layers: DescriptionLayers = {
    providerDescription: providerDesc,
    adminCatalogDescription: adminDesc,
    memberPacketDescription: memberDesc,
  };

  const effectiveDesc = mode === 'member'
    ? resolveDescription(layers)
    : resolvePublicDescription(layers);

  const provider = (input.fulfillmentProvider === 'printful' ? 'printful' : 'printify') as 'printify' | 'printful';

  return {
    canonicalBlankKey: deriveCanonicalBlankKey(input),
    title: input.title || '',
    imageUrl: input.imageUrl || '',

    fulfillmentProvider: provider,
    providerProductId: input.providerProductId || input.printProviderId || input.blueprintId || 0,

    providerDescription: providerDesc,
    adminCatalogDescription: adminDesc,
    memberPacketDescription: memberDesc,
    effectiveDescription: effectiveDesc,

    retailPrice: input.retailPrice || 0,
    memberEarnings: input.memberEarnings || 0,
    baseCost: input.baseCost || 0,

    availableColors: input.availableColors || (input.colors ? input.colors.map(c => ({ name: c, hex: '' })) : []),
    availableSizes: input.availableSizes || input.sizes || [],

    isEditableInMemberWizard: mode === 'member',
    isReadOnlyInOwnerWizard: mode === 'owner',
    isReadOnlyInPublicWizard: mode === 'public',

    brand: input.brand || undefined,
    placements: input.placements,
    hasUSAProvider: input.hasUSAProvider,

    effectivePublicDescription: resolvePublicDescription(layers),

    blueprintId: input.blueprintId,
    printProviderId: input.printProviderId,

    variantMap: input.variantMap,
    selectedColor: input.selectedColor,
    selectedSize: input.selectedSize,
  };
}

export function wizardProductToPacketBoundProduct(wp: WizardProduct): Record<string, any> {
  const snapshot = buildDescriptionSnapshot({
    providerDescription: wp.providerDescription,
    adminCatalogDescription: wp.adminCatalogDescription,
    memberPacketDescription: wp.memberPacketDescription,
  });

  return {
    canonicalBlankKey: wp.canonicalBlankKey,
    blueprintId: wp.blueprintId || wp.providerProductId,
    printProviderId: wp.printProviderId || wp.providerProductId,
    fulfillmentProvider: wp.fulfillmentProvider,
    providerProductId: wp.providerProductId,
    title: wp.title,
    imageUrl: wp.imageUrl,
    memberEarnings: wp.memberEarnings,
    retailPrice: wp.retailPrice,
    baseCost: wp.baseCost,
    description: wp.effectiveDescription,
    providerDescription: snapshot.providerDescription || '',
    originalDescription: snapshot.providerDescription || '',
    adminCatalogDescription: snapshot.adminCatalogDescription || '',
    memberPacketDescription: snapshot.memberPacketDescription || '',
    effectiveDescription: snapshot.effectiveDescription || '',
    providerDescriptionSnapshot: snapshot.providerDescription || '',
    adminCatalogDescriptionSnapshot: snapshot.adminCatalogDescription || '',
  };
}

export function updateWizardProductMemberDescription(wp: WizardProduct, newDescription: string): WizardProduct {
  return {
    ...wp,
    memberPacketDescription: newDescription,
    effectiveDescription: newDescription || wp.adminCatalogDescription || wp.providerDescription || '',
  };
}
