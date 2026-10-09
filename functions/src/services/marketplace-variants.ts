import type { NormalizedProduct } from './surface-generator';
import { isValidQrgBase, buildMasterCatalogDocId } from '../../../shared/qrgCodes';

export interface MarketplaceVariant {
  /** Supplier-independent key from the existing master record; never mint a QRG here. */
  variantKey: string;
  sku: string;
  size: string;
  color: string;
}

/** Resolve real saved combinations, never a colors × sizes Cartesian product. */
export async function resolveMarketplaceVariants(product: NormalizedProduct, db: any): Promise<MarketplaceVariant[]> {
  if (product.selectionErrors.length) throw new Error(product.selectionErrors.join(' '));
  const unsupported = product.options.filter(option => !['size', 'color', 'colour'].includes(option.name.toLowerCase()));
  if (unsupported.length) throw new Error(`Unsupported marketplace options: ${unsupported.map(option => option.name).join(', ')}.`);
  if (!product.colors.length && !product.sizes.length && !product.options.length) return [];
  if (!isValidQrgBase(product.sku)) throw new Error('A canonical product QRG base is required to resolve variants.');
  const blankId = product.sku.split('-')[1];
  const masterId = buildMasterCatalogDocId(blankId);
  if (product.sourceMasterId !== masterId) throw new Error('Product and canonical blank identity disagree.');
  const snap = await db.collection('master_catalog').doc(masterId).get();
  const master = snap.data();
  if (!snap.exists || master.isActive === false) throw new Error('The canonical product blank is missing or inactive.');
  const selected = Object.entries(master.qrgVariants || {}).filter(([, value]: any) =>
    (!product.sizes.length || product.sizes.includes(value.sizeLabel)) &&
    (!product.colors.length || product.colors.includes(value.colorLabel)));
  const result: MarketplaceVariant[] = selected.map(([key, value]: any) => {
    if (!/^\d{4}$|^\d{5}$|^\d{7}$/.test(key) || !value.sizeLabel || !value.colorLabel || value.isActive === false || value.available === false)
      throw new Error(`Variant ${key} needs a valid available master-catalog record.`);
    if (product.fulfillmentProvider && !value.providerVariants?.[product.fulfillmentProvider]) throw new Error(`Variant ${value.sizeLabel}/${value.colorLabel} is not mapped to the built product’s fulfillment provider.`);
    // Marketplace SKU is an external mapping key. It is NOT a new QRG identity.
    return { variantKey: key, sku: `${product.sku}:${key}`, size: value.sizeLabel, color: value.colorLabel };
  });
  if (!result.length) throw new Error('No saved master-catalog variants match the selected sizes and colors.');
  for (const [field, values] of [['color', product.colors], ['size', product.sizes]] as const) {
    if (values.some(value => !result.some(row => row[field] === value))) throw new Error(`A selected ${field} has no available canonical variant.`);
  }
  if (new Set(result.map(row => `${row.size}\0${row.color}`)).size !== result.length) throw new Error('Ambiguous canonical size/color variants must be resolved before publishing.');
  return result;
}
