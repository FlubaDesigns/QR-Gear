import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { pushListingToEbay, checkEbayListing, getEbaySetupOptions, createEbayInventoryLocation, type EbayListingProduct } from '../ebay-api';
import { resolveMarketplaceVariants } from '../marketplace-variants';
import { database } from './composition-fixture';
const fetchMock = vi.fn();
const response = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const sku = 'QRG-11111-I-000001';
const credentials = { refreshToken: 'selected-seller', userId: 'seller', username: 'Seller' };
const product: EbayListingProduct = { title: 'Built shirt', description: 'Saved design', price: 35, currencyCode: 'USD', quantity: 0, condition: 'NEW', brand: 'QR Gear', imageUrls: ['https://images/shirt.png'], categoryId: '123', listingFormat: 'FIXED_PRICE', fulfillmentPolicyId: 'shipping', paymentPolicyId: 'payment', returnPolicyId: 'returns', merchantLocationKey: 'warehouse' };
let offers: Map<string, any>, inventory: Map<string, any>, groups: Map<string, any>, serial: number;
let lookupFailure: boolean, publishFailure: boolean, statusFailure: boolean, requiredAspect: boolean;
const offerFor = (id: string) => [...offers.values()].find(offer => offer.offerId === id);
beforeEach(() => {
  offers = new Map(); inventory = new Map(); groups = new Map(); serial = 0;
  lookupFailure = publishFailure = statusFailure = requiredAspect = false;
  vi.stubEnv('EBAY_APP_ID', 'test-app'); vi.stubEnv('EBAY_CERT_ID', 'test-secret'); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: string, init: any = {}) => {
    const url = new URL(input), path = url.pathname, body = init.body && init.headers?.['Content-Type'] === 'application/json' ? JSON.parse(init.body) : {};
    if (path.endsWith('/oauth2/token')) return response({ access_token: 'authorized' });
    if (path.includes('/sell/account/')) return response({ marketplaceId: 'EBAY_US', fulfillmentPolicies: [{ fulfillmentPolicyId: 'shipping', name: 'Shipping' }], paymentPolicies: [{ paymentPolicyId: 'payment', name: 'Payment' }], returnPolicies: [{ returnPolicyId: 'returns', name: 'Returns' }] });
    if (path === '/sell/inventory/v1/location') return response({ locations: [{ merchantLocationKey: 'warehouse', merchantLocationStatus: 'ENABLED', name: 'Warehouse' }] });
    if (path.includes('/location/')) return response({ merchantLocationStatus: 'ENABLED' });
    if (path.endsWith('/get_default_category_tree_id')) return response({ categoryTreeId: '0' });
    if (path.endsWith('/get_category_suggestions')) return response({ categorySuggestions: [{ category: { categoryId: '123', categoryName: 'Shirts' } }] });
    if (path.endsWith('/get_item_aspects_for_category')) return response({ aspects: [
      ...['Size', 'Color'].map(name => ({ localizedAspectName: name, aspectConstraint: { aspectEnabledForVariations: true, aspectMode: 'FREE_TEXT' } })),
      ...(requiredAspect ? [{ localizedAspectName: 'Department', aspectConstraint: { aspectRequired: true, aspectMode: 'SELECTION_ONLY' }, aspectValues: [{ localizedValue: 'Unisex Adults' }] }] : []),
    ] });
    if (path.includes('/inventory_item/')) { inventory.set(decodeURIComponent(path.split('/').pop()!), body); return new Response(null, { status: 204 }); }
    if (path.includes('/inventory_item_group/')) { groups.set(decodeURIComponent(path.split('/').pop()!), body); return new Response(null, { status: 204 }); }
    if (path.endsWith('/offer') && (!init.method || init.method === 'GET')) {
      if (lookupFailure) return response({ errors: [{ errorId: 99, message: 'Lookup unavailable' }] }, 503);
      const found = offers.get(url.searchParams.get('sku')!); return found ? response({ offers: [found] }) : response({ errors: [{ errorId: 25713 }] }, 404);
    }
    if (path.endsWith('/offer') && init.method === 'POST') { const offer = { ...body, offerId: `offer-${++serial}`, status: 'UNPUBLISHED' }; offers.set(body.sku, offer); return response({ offerId: offer.offerId }); }
    if (path.endsWith('/publish') || path.endsWith('/publish_by_inventory_item_group')) {
      const targets = body.inventoryItemGroupKey ? groups.get(body.inventoryItemGroupKey).variantSKUs.map((key: string) => offers.get(key)) : [offerFor(path.split('/').slice(-2)[0])];
      for (const offer of targets) Object.assign(offer, { status: 'PUBLISHED', listing: { listingId: 'live-id', listingStatus: 'ACTIVE' } });
      if (publishFailure) throw new Error('Response lost after eBay published');
      return response({ listingId: 'live-id' });
    }
    if (path.endsWith('/withdraw') || path.endsWith('/withdraw_by_inventory_item_group')) {
      const targets = body.inventoryItemGroupKey ? groups.get(body.inventoryItemGroupKey).variantSKUs.map((key: string) => offers.get(key)) : [offerFor(path.split('/').slice(-2)[0])];
      for (const offer of targets) Object.assign(offer, { status: 'UNPUBLISHED', listing: { listingId: 'live-id', listingStatus: 'ENDED' } });
      return response({ listingId: 'live-id' });
    }
    if (path.includes('/offer/')) {
      const offer = offerFor(decodeURIComponent(path.split('/').pop()!));
      if (!offer) return response({ errors: [{ message: 'Missing offer' }] }, 404);
      if (init.method === 'PUT') { Object.assign(offer, body); return new Response(null, { status: 204 }); }
      if (statusFailure) return response({ errors: [{ message: 'Status unavailable' }] }, 503);
      return response(offer);
    }
    throw new Error(`Unexpected request ${init.method} ${path}`);
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('loads policies for the connected seller and category requirements from eBay', async () => {
  const options = await getEbaySetupOptions(credentials, '123', 'shirt');
  expect(options.locations[0].merchantLocationKey).toBe('warehouse'); expect(options.categories[0].categoryId).toBe('123');
  expect(fetchMock.mock.calls[0][1].body).toContain('refresh_token=selected-seller');
});
it('blocks missing seller details and required aspects before inventory changes', async () => {
  expect((await pushListingToEbay(credentials, { ...product, paymentPolicyId: '' }, sku)).error).toContain('policies');
  requiredAspect = true;
  expect((await pushListingToEbay(credentials, product, sku)).error).toContain('Department');
  expect(inventory.size).toBe(0); expect(offers.size).toBe(0);
});
it('fails an ambiguous or unsuccessful lookup before external writes', async () => {
  lookupFailure = true;
  expect((await pushListingToEbay(credentials, product, sku)).error).toContain('lookup failed');
  expect(inventory.size).toBe(0); expect(offers.size).toBe(0);
});
it('publishes one SKU, retains zero quantity, and confirms actual remote status', async () => {
  const persist = vi.fn(), prepared = vi.fn();
  const result = await pushListingToEbay(credentials, { ...product, bestOfferEnabled: true, subtitle: 'Saved subtitle' }, sku, persist, {}, prepared);
  expect(result.listingStatus).toBe('active'); expect(result.listingId).toBe('live-id');
  expect(inventory.get(sku).availability.shipToLocationAvailability.quantity).toBe(0);
  expect(inventory.get(sku).product.subtitle).toBe('Saved subtitle');
  expect(offers.get(sku).listingPolicies.bestOfferTerms.bestOfferEnabled).toBe(true);
  expect(offers.get(sku).quantityLimitPerBuyer).toBeUndefined(); expect(prepared).toHaveBeenCalledOnce();
  expect(persist).toHaveBeenCalledWith('offer-1', expect.objectContaining({ offers: [{ sku, offerId: 'offer-1' }] }));
});
it('retries an uncertain publish without creating or publishing a duplicate', async () => {
  publishFailure = true; const identities: any[] = [];
  const first = await pushListingToEbay(credentials, product, sku, async (_id, identity) => { identities.push(identity); });
  expect(first.success).toBe(false); expect(offers.size).toBe(1); publishFailure = false;
  fetchMock.mockClear();
  const second = await pushListingToEbay(credentials, product, sku, undefined, identities[identities.length - 1]);
  expect(second.listingStatus).toBe('active'); expect(offers.size).toBe(1);
  expect(fetchMock.mock.calls.some(([path, init]) => path.endsWith('/publish') && init.method === 'POST')).toBe(false);
});
it('publishes only saved variation combinations together and ends the entire group', async () => {
  const variants = [{ variantKey: '0501', sku: `${sku}:0501`, size: 'L', color: 'Black' }, { variantKey: '0602', sku: `${sku}:0602`, size: 'XL', color: 'White' }];
  const result = await pushListingToEbay(credentials, { ...product, variants }, sku);
  expect(result.listingStatus).toBe('active'); expect(offers.size).toBe(2);
  const group = groups.get(sku); expect(group.variantSKUs).toEqual(variants.map(row => row.sku));
  expect(group.aspects.Size).toBeUndefined(); expect(group.variesBy.specifications).toContainEqual({ name: 'Size', values: ['L', 'XL'] });
  expect(inventory.get(variants[0].sku).product.aspects.Color).toEqual(['Black']);
  const ended = await checkEbayListing(credentials, { offers: result.offers, inventoryItemGroupKey: sku, externalListingId: 'live-id' }, sku, true);
  expect(ended.listingStatus).toBe('delisted'); expect(ended.listingId).toBe('live-id');
  expect([...offers.values()].every(offer => offer.status === 'UNPUBLISHED')).toBe(true);
});
it('does not infer an ended or active result when eBay status cannot be read', async () => {
  const published = await pushListingToEbay(credentials, product, sku); statusFailure = true;
  const result = await checkEbayListing(credentials, { offers: published.offers, externalListingId: 'live-id' }, sku, true);
  expect(result.success).toBe(false); expect(result.listingStatus).toBeUndefined();
  expect(offers.get(sku).status).toBe('PUBLISHED');
});
it('refuses offers belonging to another SKU when checking or ending a listing', async () => {
  await pushListingToEbay(credentials, product, sku);
  const result = await checkEbayListing(credentials, { offers: [{ sku: 'different-item', offerId: 'offer-1' }] }, sku, true);
  expect(result.error).toContain('identity'); expect(offers.get(sku).status).toBe('PUBLISHED');
});
it('resolves existing canonical variant combinations without inventing child QRG identities or combinations', async () => {
  const { db } = database({ 'master_catalog/qrg_11111': { isActive: true, qrgVariants: { '0501': { sizeLabel: 'L', colorLabel: 'Black' }, '0602': { sizeLabel: 'XL', colorLabel: 'White' } } } });
  const normalized: any = { sku, sourceMasterId: 'qrg_11111', selectionErrors: [], options: [], colors: ['Black', 'White'], sizes: ['L', 'XL'] };
  const rows = await resolveMarketplaceVariants(normalized, db);
  expect(rows).toHaveLength(2); expect(rows[0].sku).toBe(`${sku}:0501`);
  await expect(resolveMarketplaceVariants({ ...normalized, colors: ['Unavailable'] }, db)).rejects.toThrow('No saved');
  await expect(resolveMarketplaceVariants({ ...normalized, sourceMasterId: 'qrg_11112' }, db)).rejects.toThrow('identity');
});

it('blocks size/color labels that would collapse two canonical variants', async () => {
  const result = await pushListingToEbay(credentials, { ...product, variants: [{ variantKey: 'a', sku: 'a', size: 'L', color: 'Black' }, { variantKey: 'b', sku: 'b', size: 'L', color: 'Black' }] }, sku);
  expect(result.error).toContain('collapse'); expect(inventory.size).toBe(0);
});
it('does not offer a variant unavailable from the built product’s selected supplier', async () => {
  const { db } = database({ 'master_catalog/qrg_11111': { isActive: true, qrgVariants: { '0501': { sizeLabel: 'L', colorLabel: 'Black', providerVariants: { printful: { variantId: '1' } } } } } });
  const normalized: any = { sku, sourceMasterId: 'qrg_11111', selectionErrors: [], options: [], colors: ['Black'], sizes: ['L'], fulfillmentProvider: 'printify' };
  await expect(resolveMarketplaceVariants(normalized, db)).rejects.toThrow('fulfillment provider');
});
it('reuses a verified warehouse after an uncertain location-creation response', async () => {
  let saved: any = null, writes = 0;
  fetchMock.mockImplementation(async (path: string, init: any) => {
    if (path.endsWith('/oauth2/token')) return response({ access_token: 'authorized' });
    if (init.method === 'POST') { saved = JSON.parse(init.body); writes++; throw new Error('Response lost'); }
    return saved ? response(saved) : response({ errors: [{ message: 'Not found' }] }, 404);
  });
  const input = { name: 'Print location', postalCode: '12345', country: 'US' };
  await expect(createEbayInventoryLocation(credentials, 'account', input)).rejects.toThrow('Response lost');
  const result = await createEbayInventoryLocation(credentials, 'account', input);
  expect(result.merchantLocationKey).toMatch(/^qrgear-/); expect(writes).toBe(1);
});
