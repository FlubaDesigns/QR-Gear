vi.mock('../../core', () => ({ db: {}, QR_GEAR_BRANDED_TAG_URL:'https://files.example/brand.png' }));
vi.mock('../printful', () => ({ printfulClient: {}, getPrintfulApiKeyAsync: vi.fn() }));
vi.mock('../printify', () => ({ printifyClient: {} }));
import { parseGrfId } from '../../../../shared/GRF_engine';
import { buildWorkingSnapshot } from '../../../../shared/builderSnapshot';
import { expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
import { syncCatalogMarkup } from '../catalog-instance-update';
const settings = { markupPercent: 0, markupFixed: 0, additionalPlacementCost: 0, textLineUpcharge: 0, centerGraphicUpcharge: 0,
  memberProfitShare: 0, builtInShippingCost: 0, sizeUpcharges: { S: 0 }, hostingTiers: [],
  brandLabelPricing: { printifyInside: 0, printifyOutside: 0, printfulInside: 0, printfulOutside: 0 }, preferredLabelPosition: 'outside' };
const labelId='GRF-11442-000002';
const labelSpec={id:'label_inside',provider:'printful',providerPlacementId:'label_inside',dimensions:{widthPx:900,heightPx:900,dpi:300}};
function fixture() {
  const pricing = { baseProductCost: 12, subtotal: 20, customerPrice: 25, markupPercent: 25, markupFixed: 0, markupAmount: 5, shippingCost: 4.95 };
  return database({ 'testSettings/pricing': settings,
    'admin_catalog_instances/a': { baseSnapshot: { title: 'Army', pricing }, resolved: { title: 'Army', pricing }, overrides: {}, version: 3, currentPacketId: 'p', storeId: 's' },
    'productPackets/p': { ownerInstanceId: 'a', pricing, placementGrfIds:{label_inside:labelId}, placementGraphicUrls:{label_inside:'https://files.example/brand.png'}, builderSnapshot: buildWorkingSnapshot({content:{graphicLayoutMode:'zone',qrSizePercent:50},selectedProduct:{docId:'qrg_11001'},selectedPlacements:['front','label_inside'],placementConfig:{},placementSizes:{},placementMethods:{},fulfillmentProvider:'printful',qrProductState:'qr_basics'}, {selectedRole:'internal',selectedStore:null,selectedChannel:null,selectedCollection:null}) },
    [`grf_assets/${labelId}`]:{...parseGrfId(labelId),grfId:labelId,publicUrl:'https://files.example/brand.png'},
    'master_catalog/qrg_11001': {qrgPrintSpecs:{printful:{locations:[labelSpec]}},providerMappings:{printful:{productId:'71',minPrice:20,maxPrice:20}}},
    'printful_products/71':{minPrice:20,maxPrice:20},
    'master_catalog/blank': { retailPrice: 99 }, 'storeAllowedProducts/s': { products: [{ retailPrice: 55 }] },
  });
}
it('previews without writes then applies zero markup to the instance and packet atomically', async () => {
  const { db, store } = fixture(), before = structuredClone(store);
  const preview = await syncCatalogMarkup(db, 'now', 'owner');
  expect(store).toEqual(before); expect(preview.productsUpdated).toBe(0); expect(preview.productsToUpdate).toBe(1);
  expect(preview.products[0]).toMatchObject({currentPrice:25,customerPrice:20});
  const saved = await syncCatalogMarkup(db, 'now', 'owner', preview.previewToken);
  expect(saved.productsUpdated).toBe(1);
  expect(store.get('admin_catalog_instances/a').resolved.pricing).toEqual(store.get('productPackets/p').pricing);
  expect(store.get('admin_catalog_instances/a').resolved.pricing).toMatchObject({customerPrice:20,markupPercent:0,markupAmount:0,shippingCost:0});
  expect(store.get('master_catalog/blank')).toEqual(before.get('master_catalog/blank'));
  expect(store.get('storeAllowedProducts/s')).toEqual(before.get('storeAllowedProducts/s'));
  expect((await syncCatalogMarkup(db, 'later', 'owner')).productsToUpdate).toBe(0);
});
it.each(['markup', 'product', 'shipping', 'lookup cost'])('rejects a stale %s preview before any writes', async what => {
  const { db, store } = fixture(); const preview = await syncCatalogMarkup(db, 'now', 'owner');
  if (what === 'markup') store.get('testSettings/pricing').markupPercent = 50;
  else if (what === 'shipping') store.get('testSettings/pricing').builtInShippingCost = 3;
  else if (what === 'lookup cost') store.get('printful_products/71').maxPrice = 23;
  else store.get('admin_catalog_instances/a').version++;
  const before = structuredClone(store);
  await expect(syncCatalogMarkup(db, 'now', 'owner', preview.previewToken)).rejects.toThrow('Preview again');
  expect(store.get('admin_catalog_instances/a')).toEqual(before.get('admin_catalog_instances/a'));
  expect(store.get('productPackets/p')).toEqual(before.get('productPackets/p'));
});
it.each(['missing cost', 'packet ownership', 'duplicate packet'])('reports %s and refuses partial catalog writes', async kind => {
  const { db, store } = fixture();
  const second = structuredClone(store.get('admin_catalog_instances/a'));
  if (kind === 'missing cost') delete second.baseSnapshot.pricing.subtotal;
  if (kind === 'packet ownership') second.currentPacketId = 'missing';
  store.set('admin_catalog_instances/b', second);
  const before = structuredClone(store), preview = await syncCatalogMarkup(db, 'now', 'owner');
  expect(preview.blocked).toHaveLength(1); expect(preview.success).toBe(false);
  await expect(syncCatalogMarkup(db, 'now', 'owner', preview.previewToken)).rejects.toThrow('No prices were changed');
  expect(store).toEqual(before);
});
it('rejects missing saved configuration without fallback amounts', async () => {
  const { db, store } = fixture(); store.delete('testSettings/pricing');
  const before = structuredClone(store);
  await expect(syncCatalogMarkup(db, 'now', 'owner')).rejects.toThrow('Save valid Admin Pricing');
  expect(store).toEqual(before);
});

it('restores missing inside label and registered artwork only when the preview is applied', async () => {
  const {db,store}=fixture();const packet=store.get('productPackets/p');
  packet.builderSnapshot.layoutConfig.selectedPlacements=['front'];delete packet.placementGrfIds;delete packet.placementGraphicUrls;
  const before=structuredClone(packet),preview=await syncCatalogMarkup(db,'now','owner');
  expect(preview.products[0].restoreInsideLabel).toBe(true);expect(store.get('productPackets/p')).toEqual(before);
  await syncCatalogMarkup(db,'now','owner',preview.previewToken);
  const saved=store.get('productPackets/p');expect(saved.builderSnapshot.layoutConfig.selectedPlacements).toEqual(['front','label_inside']);
  expect(saved.placementGraphicUrls.label_inside).toBe('https://files.example/brand.png');
  expect(store.get('grf_assets/'+saved.placementGrfIds.label_inside).publicUrl).toBe(saved.placementGraphicUrls.label_inside);
  expect((await syncCatalogMarkup(db,'later','owner')).productsToUpdate).toBe(0);
});
