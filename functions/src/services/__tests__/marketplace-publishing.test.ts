import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const context = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ get db() { return context.db; } }));
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../amazon-sp-api', async importOriginal => ({ ...await importOriginal<any>(), pushListingToAmazon: vi.fn(), getAmazonSetupOptions: vi.fn(), previewAmazonSubmissions: vi.fn(), checkAmazonListing: vi.fn() }));
vi.mock('../ebay-api', () => ({ pushListingToEbay: vi.fn(), checkEbayListing: vi.fn(), getEbaySetupOptions: vi.fn() }));
vi.mock('../etsy-api', async original => ({ ...await original<any>(), pushListingToEtsy: vi.fn(), getEtsySetupOptions: vi.fn(), checkEtsyListing: vi.fn() }));
import { register } from '../../routes/marketplace';
import { getOrCreateMarketplaceListing, runMarketplaceJob, retryFailedJob } from '../marketplace-sync';
import { normalizeProductForPublishing, createSurfaceDraftFromNormalizedProduct } from '../surface-generator';
import { pushListingToAmazon, checkAmazonListing, getAmazonSetupOptions, previewAmazonSubmissions } from '../amazon-sp-api';
import { pushListingToEbay, checkEbayListing, getEbaySetupOptions } from '../ebay-api';
import { pushListingToEtsy } from '../etsy-api';
const sku = 'QRG-11111-I-000001';
let fixture: ReturnType<typeof database>;
const app = express(); app.use(express.json()); register(app);
beforeEach(() => {
  vi.clearAllMocks();
  fixture = database({
    'admin_catalog_instances/i': { qrgBaseCode: sku, resolved: { title: 'Saved product', description: 'Product description', images: ['https://files/image.jpg'], pricing: { customerPrice: 29 } } },
    'surfaces/s': { masterProductId: 'i', sku, title: 'Saved product', description: 'Product description', images: ['https://files/image.jpg'], retailPrice: 29, enabledPlatforms: ['amazon', 'ebay', 'etsy'], status: 'draft', ebay: { categoryId: '123', quantity: 0 } },
    'marketplaceAccounts/a': { platform: 'amazon', isActive: true, amazonConnected: true, amazonRefreshToken: 'selected-account-token', amazonSellerId: 'selected-seller', amazonMarketplaceId: 'ATVPDKIKX0DER' },
  }); context.db = fixture.db;
  vi.mocked(pushListingToAmazon).mockResolvedValue({ success: true, sku, status: 'ACCEPTED', listingStatus: 'pending', submissionId: 'submission' });
});

describe('Marketplace product and job handoff', () => {
  it('preserves intentionally empty selections and does not substitute wholesale cost', async () => {
    fixture.store.set('admin_catalog_instances/i', { qrgBaseCode: sku, enabledColors: [], enabledSizes: [], resolved: { colors: ['Black'], sizes: ['L'] }, baseSnapshot: { minPrice: 12 } });
    const product = await normalizeProductForPublishing('i', fixture.db);
    expect(product.colors).toEqual([]); expect(product.sizes).toEqual([]); expect(product.retailPrice).toBe(0);
    const surface = createSurfaceDraftFromNormalizedProduct(product, 'ebay');
    expect(surface.colors).toEqual([]); expect(surface.readinessErrors).toHaveLength(2);
  });
  it('fails a missing linked packet', async () => {
    fixture.store.get('admin_catalog_instances/i').currentPacketId = 'missing';
    await expect(normalizeProductForPublishing('i', fixture.db)).rejects.toThrow('Linked packet');
  });
  it('uses selected account OAuth and retail price, tracks accepted Amazon as pending', async () => {
    const listing = await getOrCreateMarketplaceListing('s', 'a'); const result = await runMarketplaceJob(listing.id, 'create');
    expect(result.success).toBe(true);
    expect(pushListingToAmazon).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'selected-account-token', sellerId: 'selected-seller' }), expect.objectContaining({ price: 29 }), sku, undefined, [], expect.any(Function), []);
    expect(fixture.store.get(`marketplaceListings/${listing.id}`).status).toBe('pending'); expect(fixture.store.get('surfaces/s').status).toBe('draft');
    expect(fixture.store.get(`marketplaceSyncJobs/${result.id}`).status).toBe('completed');
    expect([...fixture.store.keys()].filter(key => key.startsWith('marketplaceSyncLogs/'))).toHaveLength(1);
  });
  it('direct Push and Jobs reuse the same listing and ignore SKU overrides', async () => {
    const response = await request(app).post('/admin/surfaces/s/push-to-amazon').send({ accountId: 'a', sku: 'wrong' });
    expect(response.status).toBe(200); expect(response.body.success).toBe(true);
    const listing = await getOrCreateMarketplaceListing('s', 'a'); expect(listing.id).toBe(response.body.marketplaceListingId);
    await request(app).post('/admin/surfaces/jobs').send({ listingId: listing.id, action: 'update' }).expect(200);
    expect([...fixture.store.keys()].filter(key => key.startsWith('marketplaceListings/'))).toHaveLength(1);
    expect(pushListingToAmazon).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), sku, undefined, [], expect.any(Function), []);
  });
  it.each(['listings', 'jobs', 'logs', 'accounts'])('routes %s before the generic surface lookup', async path => {
    const response = await request(app).get(`/admin/surfaces/${path}`).expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    if (path === 'accounts') expect(JSON.stringify(response.body)).not.toContain('selected-account-token');
  });
  it('blocks unresolved canonical variants and reports readiness failure', async () => {
    fixture.store.get('admin_catalog_instances/i').resolved.colors = ['Black', 'White'];
    const listing = await getOrCreateMarketplaceListing('s', 'a'); const result = await runMarketplaceJob(listing.id, 'create');
    expect(result.success).toBe(false); expect(result.error).toContain('canonical blank'); expect(pushListingToAmazon).not.toHaveBeenCalled();
    const readiness = await request(app).post('/admin/surfaces/s/check-readiness').send({}).expect(200);
    expect(readiness.body.ready).toBe(false); expect(readiness.body.errors.join(' ')).toContain('canonical blank');
  });
  it('leaves failures failed until explicit retry and rejects concurrent jobs', async () => {
    const listing = await getOrCreateMarketplaceListing('s', 'a');
    vi.mocked(pushListingToAmazon).mockResolvedValueOnce({ success: false, sku, listingStatus: 'error', error: 'Rejected' });
    const result = await runMarketplaceJob(listing.id, 'create');
    expect(result.success).toBe(false); expect(fixture.store.get(`marketplaceSyncJobs/${result.id}`).status).toBe('failed');
    await retryFailedJob(result.id); expect(pushListingToAmazon).toHaveBeenCalledTimes(2);
    fixture.store.get(`marketplaceListings/${listing.id}`).status = 'syncing';
    await expect(runMarketplaceJob(listing.id, 'create')).rejects.toThrow('already running');
  });
  it('blocks identity mismatch and inactive accounts', async () => {
    fixture.store.get('surfaces/s').sku = 'QRG-11111-I-000002'; await expect(getOrCreateMarketplaceListing('s', 'a')).rejects.toThrow('identity');
    fixture.store.get('surfaces/s').sku = sku; fixture.store.get('marketplaceAccounts/a').isActive = false;
    await expect(getOrCreateMarketplaceListing('s', 'a')).rejects.toThrow('inactive'); expect(pushListingToAmazon).not.toHaveBeenCalled();
  });
  it('uses eBay override price and preserves zero quantity', async () => {
    fixture.store.set('marketplaceAccounts/a', { platform: 'ebay', isActive: true, ebayConnected: true, ebayRefreshToken: 'ebay-selected' });
    fixture.store.get('surfaces/s').ebay.priceOverride = 35; vi.mocked(pushListingToEbay).mockResolvedValue({ success: true, sku, listingId: 'ebay-id' });
    const listing = await getOrCreateMarketplaceListing('s', 'a'); await runMarketplaceJob(listing.id, 'create');
    expect(pushListingToEbay).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'ebay-selected' }), expect.objectContaining({ price: 35, quantity: 0 }), sku, expect.any(Function), expect.any(Object), expect.any(Function));
  });
  it('retains Etsy settings and partial external identity for retry', async () => {
    fixture.store.set('marketplaceAccounts/a', { platform: 'etsy', isActive: true, etsyConnected: true, etsyRefreshToken: 'etsy-selected', etsyShopId: '456' });
    vi.mocked(pushListingToEtsy).mockImplementation(async (_account, _product, persistence) => {
      await persistence.onRefreshToken('rotated'); await persistence.onBeforeCreate(); await persistence.onListingCreated(123);
      return { success: false, listingId: 123, state: 'draft', error: 'Image upload failed' };
    });
    const listing = await getOrCreateMarketplaceListing('s', 'a'); const result = await runMarketplaceJob(listing.id, 'create', { taxonomyId: 9, shippingProfileId: 10, readinessStateId: 4, whoMade: 'someone_else', whenMade: 'made_to_order', quantity: 5, autoRenew: false, productionPartnerIds: [] });
    expect(result.success).toBe(false); expect(result.listingStatus).toBe('error');
    expect(fixture.store.get('marketplaceAccounts/a').etsyRefreshToken).toBe('rotated');
    expect(fixture.store.get(`marketplaceListings/${listing.id}`).externalListingId).toBe('123');
    vi.mocked(pushListingToEtsy).mockResolvedValue({ success: true, listingId: 123, state: 'active' }); await retryFailedJob(result.id);
    expect(pushListingToEtsy).toHaveBeenLastCalledWith(expect.objectContaining({ refreshToken: 'rotated' }), expect.objectContaining({ taxonomyId: 9, shippingProfileId: 10 }), expect.objectContaining({ existingListingId: 123 }));
  });
  it('blocks blind Etsy retries after unknown create outcome', async () => {
    fixture.store.set('marketplaceAccounts/a', { platform: 'etsy', isActive: true, etsyConnected: true, etsyRefreshToken: 'token', etsyShopId: '456' });
    vi.mocked(pushListingToEtsy).mockImplementation(async (_a, _p, persistence) => { await persistence.onBeforeCreate(); throw new Error('Connection lost'); });
    const listing = await getOrCreateMarketplaceListing('s', 'a'); const result = await runMarketplaceJob(listing.id, 'create', { taxonomyId: 9, shippingProfileId: 10, readinessStateId: 4, whoMade: 'someone_else', whenMade: 'made_to_order', quantity: 5, autoRenew: false, productionPartnerIds: [] });
    await expect(retryFailedJob(result.id)).rejects.toThrow('unknown outcome'); expect(pushListingToEtsy).toHaveBeenCalledTimes(1);
  });
  it('does not claim remote deletion succeeded or discard linked records', async () => {
    const listing = await getOrCreateMarketplaceListing('s', 'a'); fixture.store.get(`marketplaceListings/${listing.id}`).externalListingId = sku;
    vi.mocked(checkAmazonListing).mockRejectedValueOnce(new Error('Amazon removal failed'));
    const result = await runMarketplaceJob(listing.id, 'delete'); expect(result.success).toBe(false); expect(pushListingToAmazon).not.toHaveBeenCalled();
    await request(app).delete(`/admin/surfaces/listings/${listing.id}`).expect(409);
  });
});

it('rejects account-wide fees and platform changes, and never returns seller tokens from edits', async () => {
  await request(app).patch('/admin/surfaces/accounts/a').send({ feePercent: 10 }).expect(400);
  await request(app).patch('/admin/surfaces/accounts/a').send({ platform: 'etsy' }).expect(400);
  const result = await request(app).patch('/admin/surfaces/accounts/a').send({ accountName: 'My Amazon' }).expect(200);
  expect(JSON.stringify(result.body)).not.toContain('selected-account-token');
});
it('exposes unavailable fee status from the real listing endpoint without substituting zero', async () => {
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  const result = await request(app).post(`/admin/surfaces/listings/${listing.id}/fees`).send({}).expect(422);
  expect(result.body.fees.amount).toBeNull();
  const saved = await request(app).get('/admin/surfaces/listings').expect(200);
  expect(saved.body[0].fees.status).toBe('unavailable'); expect(saved.body[0].estimatedMargin).toBeNull();
});

it('does not discard an eBay offer identity when publication has not completed', async () => {
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  fixture.store.get(`marketplaceListings/${listing.id}`).externalOfferId = 'prepared-offer';
  await request(app).delete(`/admin/surfaces/listings/${listing.id}`).expect(409);
});

it('checks and ends an eBay listing through the same locked job path even if product selections are invalid', async () => {
  fixture.store.set('marketplaceAccounts/a', { platform: 'ebay', isActive: true, ebayConnected: true, ebayRefreshToken: 'selected' });
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  fixture.store.get(`marketplaceListings/${listing.id}`).externalOfferId = 'offer';
  fixture.store.get(`marketplaceListings/${listing.id}`).externalListingId = 'live';
  fixture.store.get('admin_catalog_instances/i').enabledColors = [];
  fixture.store.get('admin_catalog_instances/i').resolved.colors = ['Black'];
  fixture.store.get('surfaces/s').enabledPlatforms = [];
  vi.mocked(checkEbayListing).mockResolvedValue({ success: true, sku, listingStatus: 'active', listingId: 'live', remoteStatus: 'PUBLISHED/ACTIVE' });
  await request(app).post('/admin/surfaces/jobs').send({ listingId: listing.id, action: 'check_status' }).expect(200);
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).status).toBe('active');
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).remoteCheckedAt).toBeTruthy();
  vi.mocked(checkEbayListing).mockResolvedValue({ success: true, sku, listingStatus: 'delisted', listingId: 'live', remoteStatus: 'UNPUBLISHED/ENDED' });
  await runMarketplaceJob(listing.id, 'delete');
  expect(checkEbayListing).toHaveBeenLastCalledWith(expect.objectContaining({ refreshToken: 'selected' }), expect.objectContaining({ offers: [{ sku, offerId: 'offer' }] }), sku, true);
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).status).toBe('delisted');
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).externalListingId).toBe('live');
});
it('saves seller policies on the listing and shared eBay details on the existing item', async () => {
  fixture.store.set('marketplaceAccounts/a', { platform: 'ebay', isActive: true, ebayConnected: true, ebayRefreshToken: 'selected' });
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  vi.mocked(getEbaySetupOptions).mockResolvedValue({ fulfillmentPolicies: [{ fulfillmentPolicyId: 'ship', name: 'Ship' }], paymentPolicies: [{ paymentPolicyId: 'pay', name: 'Pay' }], returnPolicies: [{ returnPolicyId: 'return', name: 'Return' }], locations: [{ merchantLocationKey: 'location', name: 'Warehouse' }], categories: [], aspects: [] });
  const body = { categoryId: '123', itemSpecifics: { Brand: 'Saved Brand' }, settings: { fulfillmentPolicyId: 'ship', paymentPolicyId: 'pay', returnPolicyId: 'return', merchantLocationKey: 'location' } };
  await request(app).patch(`/admin/surfaces/listings/${listing.id}/ebay-setup`).send(body).expect(200);
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).publishOptions.ebay).toEqual(body.settings);
  expect(fixture.store.get('surfaces/s').ebay.itemSpecifics).toEqual(body.itemSpecifics);
  await request(app).patch(`/admin/surfaces/listings/${listing.id}/ebay-setup`).send({ ...body, settings: { ...body.settings, paymentPolicyId: 'another-seller' } }).expect(400);
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).publishOptions.ebay.paymentPolicyId).toBe('pay');
});
it('keeps a failed remote end from being recorded as delisted', async () => {
  fixture.store.set('marketplaceAccounts/a', { platform: 'ebay', isActive: true, ebayConnected: true, ebayRefreshToken: 'selected' });
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  vi.mocked(checkEbayListing).mockResolvedValue({ success: false, sku, error: 'Remote end rejected' });
  await runMarketplaceJob(listing.id, 'delete');
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).status).toBe('error');
});

it('uses explicit eBay size labels while retaining the canonical item and variant mapping', async () => {
  fixture.store.set('marketplaceAccounts/a', { platform: 'ebay', isActive: true, ebayConnected: true, ebayRefreshToken: 'selected' });
  Object.assign(fixture.store.get('admin_catalog_instances/i'), { sourceMasterId: 'qrg_11111', enabledSizes: ['L'], enabledColors: ['Black'] });
  fixture.store.set('master_catalog/qrg_11111', { isActive: true, qrgVariants: { '0501': { sizeLabel: 'L', colorLabel: 'Black' } } });
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  fixture.store.get(`marketplaceListings/${listing.id}`).publishOptions = { ebay: { variationValues: { Size: { L: 'Large' } } } };
  vi.mocked(pushListingToEbay).mockResolvedValue({ success: true, sku, listingId: 'live', listingStatus: 'active' });
  await runMarketplaceJob(listing.id, 'create');
  expect(pushListingToEbay).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variants: [{ variantKey: '0501', sku: `${sku}:0501`, size: 'Large', color: 'Black' }] }), sku, expect.any(Function), expect.any(Object), expect.any(Function));
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).qrgCode).toBe(sku);
  expect(fixture.store.get('admin_catalog_instances/i').enabledSizes).toEqual(['L']);
});

it('saves Amazon setup on exactly the selected listing, blocks changes during a job, and previews without publishing', async () => {
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  const settings = { productType: 'SHIRT', quantity: 0, attributes: { brand: [{ value: 'QR Gear' }] } };
  await request(app).patch(`/admin/surfaces/listings/${listing.id}/amazon-setup`).send({ settings }).expect(200);
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).publishOptions.amazon).toMatchObject(settings);
  expect(fixture.store.get('surfaces/s').publishOptions).toBeUndefined(); expect(pushListingToAmazon).not.toHaveBeenCalled();
  vi.mocked(getAmazonSetupOptions).mockResolvedValue({ productTypes: [], schema: { properties: { brand: {} } } });
  vi.mocked(previewAmazonSubmissions).mockResolvedValue(['Amazon needs a barcode']);
  const preview = await request(app).post(`/admin/surfaces/listings/${listing.id}/amazon-preview`).send({ settings }).expect(200);
  expect(preview.body).toEqual({ valid: false, errors: ['Amazon needs a barcode'] }); expect(pushListingToAmazon).not.toHaveBeenCalled();
  expect(getAmazonSetupOptions).toHaveBeenCalledWith(expect.objectContaining({ sellerId: 'selected-seller', refreshToken: 'selected-account-token' }), 'SHIRT', '', false);
  fixture.store.get(`marketplaceListings/${listing.id}`).status = 'syncing';
  await request(app).patch(`/admin/surfaces/listings/${listing.id}/amazon-setup`).send({ settings }).expect(409);
});
it('tracks Amazon identities before a failed submission and keeps remote checks/removal usable after product selection changes', async () => {
  const listing = await getOrCreateMarketplaceListing('s', 'a');
  vi.mocked(pushListingToAmazon).mockImplementationOnce(async (_c, _p, _s, _settings, _variants, persist) => { await persist!([{ sku }]); return { success: false, sku, listingStatus: 'error', error: 'Unknown outcome' }; });
  await runMarketplaceJob(listing.id, 'create');
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).amazonItems).toEqual([{ sku }]);
  await request(app).delete(`/admin/surfaces/listings/${listing.id}`).expect(409);
  fixture.store.get('surfaces/s').enabledPlatforms = [];
  fixture.store.get('admin_catalog_instances/i').resolved.colors = ['Unavailable'];
  vi.mocked(checkAmazonListing).mockResolvedValue({ success: true, sku, listingStatus: 'active', remoteStatus: '1/1 variations buyable', externalListingId: sku, amazonItems: [{ sku, status: 'BUYABLE' }] });
  const check = await runMarketplaceJob(listing.id, 'check_status');
  expect(check.success).toBe(true); expect(fixture.store.get('surfaces/s').status).toBe('published');
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).remoteCheckedAt).toBeTruthy();
  vi.mocked(checkAmazonListing).mockImplementationOnce(async (_c, _s, _items, remove, _requested, persist) => { expect(remove).toBe(true); await persist!(); return { success: true, sku, listingStatus: 'pending', remoteStatus: 'Removal processing', externalListingId: sku, amazonItems: [{ sku }] }; });
  await runMarketplaceJob(listing.id, 'delete');
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).amazonRemovalRequested).toBe(true);
  expect(fixture.store.get(`marketplaceListings/${listing.id}`).status).toBe('pending');
});
