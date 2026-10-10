import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';
import { normalizeSize, sortProductSizes } from '../../../shared/storefrontTypes';

export class CatalogSelectionError extends Error {
  readonly status = 400;
}

/** Storefront and cart consume the same saved QRG/provider intersection. */
export function catalogSaleVariants(instance: any, master: any, provider: string) {
  const labels = (rows: any[]) => rows.map(row => typeof row === 'string' ? row : row?.name || row?.label).filter((v: any) => typeof v === 'string');
  const sizes = new Set(labels(instance.enabledSizes || instance.resolved?.sizes || []).map(normalizeSize));
  const colors = new Set(labels(instance.enabledColors || instance.resolved?.colors || []));
  const variants = Object.entries(master?.qrgVariants || {}).flatMap(([key, value]) => {
    const row = value as any, mapping = row.providerVariants?.[provider];
    if (typeof row.sizeLabel !== 'string' || !sizes.has(normalizeSize(row.sizeLabel)) || !colors.has(row.colorLabel) || row.isActive === false || row.available === false) return [];
    if (!Number.isSafeInteger(Number(mapping?.variantId)) || Number(mapping.variantId) <= 0 || !Number.isSafeInteger(Number(mapping?.productId)) || Number(mapping.productId) <= 0) return [];
    return [{ key, size: normalizeSize(row.sizeLabel), color: row.colorLabel as string, mapping }];
  });
  // Ambiguous identities are never offered or selected arbitrarily.
  return variants.filter(row => variants.filter(v => v.size === row.size && v.color === row.color).length === 1);
}

export function selectCatalogSaleVariant(instance: any, master: any, provider: string, size: unknown, color: unknown) {
  if (typeof size !== 'string' || !size || typeof color !== 'string' || !color) throw new CatalogSelectionError('Choose an available size and color.');
  const variant = catalogSaleVariants(instance, master, provider).find(v => v.size === normalizeSize(size) && v.color === color);
  if (!variant) throw new CatalogSelectionError(`${color} / ${size} is unavailable for this product. Choose an available size or color.`);
  return variant;
}

/** Public option projection: saved selections can narrow QRG, never replace it. */
export async function catalogProductOptions(db: any, selection: any, packet: any) {
  const masterId = packet?.builderSnapshot?.metadata?.selectedProductDocId || packet?.sourceMasterId;
  const unavailable = (optionsError: string) => ({ availableVariants: [] as Array<{ color: string; size: string }>, availableColors: [] as string[], availableSizes: [] as string[], optionsError });
  if (typeof masterId !== 'string' || !isValidMasterCatalogDocId(masterId)) return unavailable('Product options unavailable: the saved QRG master reference is missing.');
  const master = (await db.collection('master_catalog').doc(masterId).get()).data();
  if (!master || master.isActive === false || master.status === 'archived') return unavailable('Product options unavailable: the QRG master is unavailable.');
  const variants = catalogSaleVariants(selection, master, packet.fulfillmentProvider);
  return {
    availableVariants: variants.map(({ color, size }) => ({ color, size })),
    availableColors: Array.from(new Set(variants.map(v => v.color))),
    availableSizes: sortProductSizes(Array.from(new Set(variants.map(v => v.size)))),
    optionsError: variants.length ? null : 'No available QRG color and size combinations for this product.',
  };
}
