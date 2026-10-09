import { normalizeProductColors } from '@shared/adapters/catalog.adapter';
import type { CatalogProduct } from './types';

/** Resume and Templates resolve the same QRG identity, then its saved supplier. */
export function resolveBuildProduct(categories: Array<{ items: any[] }>, working: any, source: any = {}): CatalogProduct {
  const metadata = working?.metadata || {};
  const provider = metadata.fulfillmentProvider || source.fulfillmentProvider;
  if (provider !== 'printify' && provider !== 'printful') {
    throw new Error('This build has no selected fulfillment supplier. Open its draft and select Printify or Printful.');
  }
  const products = categories.flatMap(c => c.items || []);
  const keys = [metadata.selectedProductDocId, source.sourceMasterId].filter(Boolean).map(String);
  const canonicalKey = keys.find(key => key.startsWith('qrg_'));
  const mappings = (p: any) => Array.isArray(p.providerMappings) ? p.providerMappings
    : Object.entries(p.providerMappings || {}).map(([supplier, mapping]) => ({ ...(mapping as object), provider: supplier }));
  const supplierId = (p: any) => {
    const mapping = mappings(p).find((m: any) => m.provider === provider);
    return provider === 'printful'
      ? mapping?.productId ?? p.printfulId ?? p.printfulProductId ?? (p.fulfillmentProvider === 'printful' ? p.id : null)
      : mapping?.blueprintId ?? p.blueprintId ?? p.printifyBlueprintId ?? (p.fulfillmentProvider === 'printify' ? p.id : null);
  };
  let product = canonicalKey ? products.find(p => p.docId === canonicalKey) : products.find(p => keys.includes(p.docId));
  // Only legacy builds without a canonical QRG key may use a supplier ID.
  if (!product && !canonicalKey) {
    const legacyId = metadata.selectedProductBlueprintId ?? source.blueprintId ?? keys.find(key => /^\d+$/.test(key));
    const matches = legacyId ? products.filter(p => supplierId(p) != null && String(supplierId(p)) === String(legacyId)) : [];
    if (matches.length > 1) throw new Error('This legacy build matches multiple QRG products. Its product identity needs repair.');
    product = matches[0];
  }
  if (!product) throw new Error('The saved QRG product is no longer in the master catalog. Your current build has been kept.');
  const id = supplierId(product);
  if (id == null) throw new Error(`The saved QRG product has no ${provider === 'printful' ? 'Printful' : 'Printify'} mapping.`);
  return { ...product, fulfillmentProvider: provider, id, blueprintId: id,
    availableColors: normalizeProductColors(product) };
}

export async function fetchBuildCatalog(): Promise<Array<{ items: any[] }>> {
  const response = await fetch('/api/master-catalog');
  if (!response.ok) throw new Error(`Could not load the master catalog (${response.status}).`);
  const categories = await response.json();
  if (!Array.isArray(categories)) throw new Error('The master catalog returned an invalid response.');
  return categories;
}
