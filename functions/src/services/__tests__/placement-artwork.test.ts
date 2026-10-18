import { expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), batch: () => m.db.batch() }, QR_GEAR_BRANDED_TAG_URL: 'https://files/label.png' }));
vi.mock('../catalog-tier-products', () => ({ memberCatalogProducts: async () => [{ canonicalBlankKey: 'qrg_11111', fulfillmentProvider: 'printful', availableColors: [{ name: 'Black' }], availableSizes: ['M'], title: 'Shirt' }] }));
vi.mock('../pricing', () => ({ brandLabelSpec: () => null, priceNewPacket: async (_db: any, builderSnapshot: any) => ({ builderSnapshot, pricing: { customerPrice: 25 }, placementGraphicUrls: {} }) }));
vi.mock('../qrg-instance-allocator', () => ({ allocateQrgInstance: async () => ({ qrgBlankId: '11111', qrgBaseCode: 'QRG-11111-M-000001' }) }));
import { prepareMemberBuild } from '../member-build';
import { productGraphicOptions } from '../../../../shared/builderSnapshot';
it('preserves per-placement QR-only and positioning choices through actual build preparation', async () => {
 const f = database({ 'channels/c': { ownerId: 'member' }, 'master_catalog/qrg_11111': { qrgBlankId: '11111', qrgVariants: { v: { sizeLabel: 'M', colorLabel: 'Black', providerVariants: { printful: { productId: 1, variantId: 2 } } } }, qrgPrintSpecs: { printful: { locations: ['front','back'].map(id => ({ id, provider: 'printful', dimensions: { widthPx: 1200, heightPx: 1800 }, verifiedVariantIds: [2] })) } } } });
 f.db.batch = () => { const pending: Array<() => void> = []; return { create: (ref: any, value: any) => pending.push(() => f.store.set(ref.path, value)), commit: async () => pending.forEach(fn => fn()) }; }; m.db = f.db;
 const input = { boundProduct: { canonicalBlankKey: 'qrg_11111' }, channelId: 'c', selectedColor: 'Black', selectedShirtSize: 'M', selectedPlacements: ['front','back'], packetType: 'qr-plus', title: 'My QR', qrBasicContent: 'hello', headerStyle: { enabled: true, text: 'Header' }, perPlacementConfigs: { front: { graphicChoice: 'full' }, back: { graphicChoice: 'qr-only', qrPositionX: 35, qrPositionY: 65 } } };
 const built = await prepareMemberBuild('member', input);
 expect(productGraphicOptions(built.builderSnapshot, 'hello', 'front').headerStyle.text).toBe('Header');
 expect(productGraphicOptions(built.builderSnapshot, 'hello', 'back')).toMatchObject({ headerStyle: null, footerStyle: null, areaImageUrl: null, qrPositionX: 35, qrPositionY: 65, graphicLayoutMode: 'freeform' });
 input.perPlacementConfigs.back.qrPositionX = 101; await expect(prepareMemberBuild('member', input)).rejects.toThrow('percent');
});
