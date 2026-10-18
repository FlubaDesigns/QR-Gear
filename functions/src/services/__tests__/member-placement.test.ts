import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ QR_GEAR_BRANDED_TAG_URL: 'https://fixture.test/brand.png', db: { collection: (...a: any[]) => m.db.collection(...a), batch: () => m.db.batch() } }));
vi.mock('../catalog-tier-products', () => {
  const products = async () => [{ canonicalBlankKey: 'qrg_11001', fulfillmentProvider: 'printful', title: 'Shirt', availableColors: [{ name: 'Black', hex: '#000000' }] }];
  return { memberCatalogProducts: products, publicCatalogProducts: products };
});
vi.mock('../catalog-sale-variants', () => ({ selectCatalogSaleVariant: () => ({ mapping: { variantId: 10, productId: 71 }, color: 'Black', size: 'M', key: 'black-m' }) }));
vi.mock('../pricing', () => ({ priceNewPacket: async (_db: any, snapshot: any) => ({ builderSnapshot: snapshot, pricing: {}, placementGraphicUrls: {} }), brandLabelSpec: () => null }));
vi.mock('../qrg-instance-allocator', () => ({ allocateQrgInstance: async () => ({ qrgBaseCode: 'QRG-11001-M-000001' }) }));
import { prepareMemberBuild, prepareOwnerBuild } from '../member-build';
import { productGraphicOptions } from '../../../../shared/builderSnapshot';
beforeEach(() => {
  const f = database({ 'channels/c': { ownerId: 'u' }, 'master_catalog/qrg_11001': { qrgBlankId: '11001', qrgPrintSpecs: { printful: { locations: ['front', 'back'].map(id => ({ id, provider: 'printful', dimensions: { widthPx: 3600, heightPx: 4800 }, verifiedVariantIds: [10] })) } } } });
  m.db = f.db; m.db.batch = () => ({ create: (ref: any, data: any) => f.store.set(ref.path, data), commit: async () => {} });
});
const input = () => ({ boundProduct: { canonicalBlankKey: 'qrg_11001' }, channelId: 'c', packetType: 'qr-plus', title: 'Distinct placements', selectedPlacements: ['front', 'back'], perPlacementConfigs: { front: { graphicChoice: 'full' }, back: { graphicChoice: 'qr-only' } }, graphicSize: 'medium', headerStyle: { enabled: true, text: 'Front only' }, qrPositionX: 30, qrPositionY: 70, qrBasicContent: 'https://example.test' });
it('carries member and owner placement choices from API input through canonical rendered options', async () => {
  for (const prepare of [prepareMemberBuild, prepareOwnerBuild]) {
    const build = await prepare('u', input());
    expect(productGraphicOptions(build.builderSnapshot, build.qrContent, 'front').headerStyle.text).toBe('Front only');
    expect(productGraphicOptions(build.builderSnapshot, build.qrContent, 'back')).toMatchObject({ headerStyle: null, footerStyle: null, qrPositionX: 30, qrPositionY: 70 });
  }
});
it('rejects unknown placement choices before creating a build', async () => {
  const invalid = input(); invalid.perPlacementConfigs.back.graphicChoice = 'unrecognized';
  await expect(prepareMemberBuild('u', invalid)).rejects.toThrow('Choose full graphic or QR only');
});
