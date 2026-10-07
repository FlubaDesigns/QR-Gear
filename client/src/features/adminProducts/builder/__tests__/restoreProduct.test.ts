import { describe, expect, it } from 'vitest';
import { resolveBuildProduct } from '../restoreProduct';
const both = { docId: 'qrg_11001', id: 71, blueprintId: 71, printfulId: 99, fulfillmentProvider: 'both',
  providerMappings: { printify: { blueprintId: 71 }, printful: { productId: 99 } } };
const catalog = [{ items: [both, { ...both, docId: 'qrg_11002' }] }];
const working = (provider: string, docId: string | null = both.docId) => ({ metadata: { fulfillmentProvider: provider, selectedProductDocId: docId } });
describe('shared QRG restore identity', () => {
  it.each(['printify', 'printful'])('resolves a bridged QRG product and the saved %s supplier', provider => {
    const product = resolveBuildProduct(catalog, working(provider));
    expect(product.docId).toBe(both.docId); expect(product.fulfillmentProvider).toBe(provider);
    expect(product.blueprintId).toBe(provider === 'printful' ? 99 : 71);
  });
  it('uses canonical snapshot identity before legacy supplier IDs or stale top-level keys', () => {
    expect(resolveBuildProduct(catalog, working('printful', 'qrg_11002'), { sourceMasterId: both.docId, blueprintId: 71 }).docId).toBe('qrg_11002');
  });
  it('does not substitute another QRG product when the saved canonical key is missing', () => {
    expect(() => resolveBuildProduct(catalog, working('printify', 'qrg_11003'), { blueprintId: 71 })).toThrow('no longer');
  });
  it('supports legacy provider arrays and refuses ambiguous supplier-only matches', () => {
    expect(() => resolveBuildProduct(catalog, working('printify', null), { blueprintId: 71 })).toThrow('multiple');
    const arrayProduct = { ...both, providerMappings: [{ provider: 'printful', productId: 99 }] };
    expect(resolveBuildProduct([{ items: [arrayProduct] }], working('printful', null), { blueprintId: 99 }).docId).toBe(both.docId);
  });
  it('refuses a missing supplier mapping instead of switching supplier', () => {
    expect(() => resolveBuildProduct([{ items: [{ docId: both.docId, blueprintId: 71, fulfillmentProvider: 'printify' }] }], working('printful'))).toThrow('no Printful mapping');
  });
});
