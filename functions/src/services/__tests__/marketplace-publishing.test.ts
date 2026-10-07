import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const context = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ get db() { return context.db; } }));
vi.mock('../../middleware', () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
vi.mock('../amazon-sp-api', () => ({ pushListingToAmazon: vi.fn() }));
vi.mock('../ebay-api', () => ({ pushListingToEbay: vi.fn() }));
vi.mock('../etsy-api', () => ({ pushListingToEtsy: vi.fn() }));
import { register } from '../../routes/marketplace';
import { getOrCreateMarketplaceListing, runMarketplaceJob, retryFailedJob } from '../marketplace-sync';
import { normalizeProductForPublishing, createSurfaceDraftFromNormalizedProduct } from '../surface-generator';
import { pushListingToAmazon } from '../amazon-sp-api';
import { pushListingToEbay } from '../ebay-api';
import { pushListingToEtsy } from '../etsy-api';
const sku = 'QRG-11111-I-000001';
let fixture: ReturnType<typeof database>;
const app = express(); app.use(express.json()); register(app);
beforeEach(() => {
  vi.clearAllMocks();
  fixture = database({
    'admin_catalog_instances/i': { qrgBaseCode: sku, resolved: { title: 'Saved product', description: 'Product description', images: ['https://files/image.jpg'], pricing: { customerPrice: 29 } } },
    'surfaces/s': { masterProductId: 'i', sku, title: 'Saved product', description: 'Product description', images: ['https://files/image.jpg'], retailPrice: 29, enabledPlatforms: ['amazon', 'ebay', 'etsy'], status: 'draft', ebay: { categoryId: '123', quantity: 0 } },
    'marketplaceAccounts/a': { platform: 'amazon', isActive: true, amazonConnected: true, amazonRefreshToken: 'selected-account-token', amazonSellerId: 'selected-seller' },
  }); context.db = fixture.db;
  vi.mocked(pushListingToAmazon).mockResolvedValue({ success: true, sku, status: 'ACCEPTED', submissionId: 'submission' });
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
    expect(pushListingToAmazon).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'selected-account-token', sellerId: 'selected-seller' }), expect.objectContaining({ price: 29 }), sku);
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
    expect(pushListingToAmazon).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), sku);
  });
  it.each(['listings', 'jobs', 'logs', 'accounts'])('routes %s before the generic surface lookup', async path => {
    const response = await request(app).get(`/admin/surfaces/${path}`).expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    if (path === 'accounts') expect(JSON.stringify(response.body)).not.toContain('selected-account-token');
  });
  it('blocks variations and reports the same readiness failure', async () => {
    fixture.store.get('admin_catalog_instances/i').resolved.colors = ['Black', 'White'];
    const listing = await getOrCreateMarketplaceListing('s', 'a'); const result = await runMarketplaceJob(listing.id, 'create');
    expect(result.success).toBe(false); expect(result.error).toContain('variation publishing'); expect(pushListingToAmazon).not.toHaveBeenCalled();
    const readiness = await request(app).post('/admin/surfaces/s/check-readiness').send({}).expect(200);
    expect(readiness.body.ready).toBe(false); expect(readiness.body.errors.join(' ')).toContain('variation publishing');
  });
  it('leaves failures failed until explicit retry and rejects concurrent jobs', async () => {
    const listing = await getOrCreateMarketplaceListing('s', 'a');
    vi.mocked(pushListingToAmazon).mockResolvedValueOnce({ success: false, sku, error: 'Rejected' });
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
    expect(pushListingToEbay).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'ebay-selected' }), expect.objectContaining({ price: 35, quantity: 0 }), sku);
  });
  it('retains Etsy settings and partial external identity for retry', async () => {
    fixture.store.set('marketplaceAccounts/a', { platform: 'etsy', isActive: true, etsyConnected: true, etsyRefreshToken: 'etsy-selected', etsyShopId: 'shop' });
    vi.mocked(pushListingToEtsy).mockImplementation(async (_account, _product, persistence) => {
      await persistence.onRefreshToken('rotated'); await persistence.onBeforeCreate(); await persistence.onListingCreated(123);
      return { success: false, listingId: 123, state: 'draft', error: 'Image upload failed' };
    });
    const listing = await getOrCreateMarketplaceListing('s', 'a'); const result = await runMarketplaceJob(listing.id, 'create', { taxonomyId: 9, shippingProfileId: 10 });
    expect(result.success).toBe(false); expect(result.listingStatus).toBe('draft');
    expect(fixture.store.get('marketplaceAccounts/a').etsyRefreshToken).toBe('rotated');
    expect(fixture.store.get(`marketplaceListings/${listing.id}`).externalListingId).toBe('123');
    vi.mocked(pushListingToEtsy).mockResolvedValue({ success: true, listingId: 123, state: 'active' }); await retryFailedJob(result.id);
    expect(pushListingToEtsy).toHaveBeenLastCalledWith(expect.objectContaining({ refreshToken: 'rotated' }), expect.objectContaining({ taxonomyId: 9, shippingProfileId: 10 }), expect.objectContaining({ existingListingId: 123 }));
  });
  it('blocks blind Etsy retries after unknown create outcome', async () => {
    fixture.store.set('marketplaceAccounts/a', { platform: 'etsy', isActive: true, etsyConnected: true, etsyRefreshToken: 'token', etsyShopId: 'shop' });
    vi.mocked(pushListingToEtsy).mockImplementation(async (_a, _p, persistence) => { await persistence.onBeforeCreate(); throw new Error('Connection lost'); });
    const listing = await getOrCreateMarketplaceListing('s', 'a'); const result = await runMarketplaceJob(listing.id, 'create', { taxonomyId: 9, shippingProfileId: 10 });
    await expect(retryFailedJob(result.id)).rejects.toThrow('unknown outcome'); expect(pushListingToEtsy).toHaveBeenCalledTimes(1);
  });
  it('does not claim remote deletion succeeded or discard linked records', async () => {
    const listing = await getOrCreateMarketplaceListing('s', 'a'); fixture.store.get(`marketplaceListings/${listing.id}`).externalListingId = sku;
    const result = await runMarketplaceJob(listing.id, 'delete'); expect(result.success).toBe(false); expect(pushListingToAmazon).not.toHaveBeenCalled();
    await request(app).delete(`/admin/surfaces/listings/${listing.id}`).expect(409);
  });
});
