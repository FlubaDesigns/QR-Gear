import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSellerMarketplaceIds } from '../amazon-sp-api';
import { pushListingToEtsy, getEtsyShopInfo } from '../etsy-api';
const fetchMock = vi.fn();
const response = (value: any, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const common = { title: 'Saved product', description: 'Description', price: 29, currencyCode: 'USD', quantity: 0, imageUrls: ['https://images/a.jpg'] };
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); fetchMock.mockImplementation(() => { throw new Error('Unexpected external request'); });
  for (const key of ['ETSY_KEYSTRING', 'ETSY_SHARED_SECRET', 'EBAY_APP_ID', 'EBAY_CERT_ID', 'AMAZON_SP_CLIENT_ID', 'AMAZON_SP_CLIENT_SECRET']) vi.stubEnv(key, 'test-app');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const credentials = { refreshToken: 'selected', accessToken: '', shopId: '456', shopName: '', userId: '' };
const product = { ...common, quantity: 5, tags: [], taxonomyId: 1, shippingProfileId: 2, readinessStateId: 4,
  whoMade: 'someone_else' as const, whenMade: 'made_to_order' as const, autoRenew: false, productionPartnerIds: [], sku: 'QRG-11111-I-000001', variants: [] };
function etsyHttp(imageFailure = true, otherShop = false) {
  fetchMock.mockImplementation(async (url: string, init: any = {}) => {
    if (url.includes('/oauth/token')) return response({ access_token: 'fresh', refresh_token: 'rotated' });
    if (url.includes('/seller-taxonomy/')) return response({ results: [{ id: 1, name: 'Shirts', children: [] }] });
    if (url.includes('/shipping-profiles')) return response({ results: [{ shipping_profile_id: 2, title: 'Shipping' }] });
    if (url.includes('/readiness-state-definitions')) return response({ results: [{ readiness_state_id: 4, readiness_state: 'made_to_order', min_processing_time: 2, max_processing_time: 4 }] });
    if (url.includes('/policies/return') || url.includes('/production-partners')) return response({ results: [] });
    if (url.endsWith('/shops/456')) return response({ currency_code: 'USD' });
    if (url.endsWith('/inventory')) return response(init.method === 'PUT' ? {} : { products: [{ sku: product.sku, property_values: [] }] });
    if (url === 'https://images/a.jpg') return new Response(imageFailure ? null : new Uint8Array([1, 2]), { status: imageFailure ? 404 : 200, headers: { 'Content-Type': 'image/jpeg' } });
    if (url.endsWith('/images')) return response({ listing_image_id: 77 });
    if (url.includes('/listings')) return response({ listing_id: 123, shop_id: otherShop ? 999 : 456, state: 'active' });
    throw new Error('Unexpected external request');
  });
}
describe('Etsy provider writes (mocked HTTP only)', () => {
  it('saves rotated credentials and the draft ID before image failure without claiming success', async () => {
    etsyHttp(); const events: string[] = [];
    const result = await pushListingToEtsy(credentials, product, {
      onRefreshToken: async token => { events.push(token); }, onBeforeCreate: async () => { events.push('creating'); }, onListingCreated: async id => { events.push(String(id)); },
    });
    expect(events).toEqual(['rotated', 'creating', '123']); expect(result.success).toBe(false); expect(result.state).toBeUndefined(); expect(result.listingId).toBe(123);
    const create = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/listings') && init.method === 'POST')!;
    expect(create[1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(new URLSearchParams(create[1].body).get('who_made')).toBe('someone_else');
  });
  it('updates a known draft instead of creating another and preserves zero inventory', async () => {
    etsyHttp(); const beforeCreate = vi.fn();
    await pushListingToEtsy(credentials, { ...product, quantity: 0 }, {
      existingListingId: 123, onRefreshToken: async () => {}, onBeforeCreate: beforeCreate, onListingCreated: async () => {},
    });
    const put = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/inventory') && init.method === 'PUT')!;
    expect(JSON.parse(put[1].body).products[0].offerings[0]).toEqual({ price: 29, quantity: 0, is_enabled: true, readiness_state_id: 4 }); expect(beforeCreate).not.toHaveBeenCalled();
  });
  it('sends only saved combinations and confirms activation after every image succeeds', async () => {
    etsyHttp(false);
    const variants = [{ variantKey: '0501', sku: `${product.sku}:0501`, size: 'L', color: 'Black' }, { variantKey: '0602', sku: `${product.sku}:0602`, size: 'XL', color: 'White' }];
    const result = await pushListingToEtsy(credentials, { ...product, variants }, { onRefreshToken: async () => {}, onBeforeCreate: async () => {}, onListingCreated: async () => {} });
    expect(result.success).toBe(true);
    const put = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/inventory') && init.method === 'PUT')!;
    const inventory = JSON.parse(put[1].body);
    expect(inventory.products.map((row: any) => row.sku)).toEqual(variants.map(row => row.sku));
    expect(inventory.products[1].property_values.map((row: any) => row.values[0])).toEqual(['XL', 'White']);
  });
  it('refuses to overwrite another shop listing', async () => {
    etsyHttp(false, true);
    const result = await pushListingToEtsy(credentials, product, { existingListingId: 123, onRefreshToken: async () => {}, onBeforeCreate: async () => {}, onListingCreated: async () => {} });
    expect(result.error).toContain('connected shop');
    expect(fetchMock.mock.calls.some(([url, init]) => url.includes('/listings') && ['POST', 'PATCH', 'PUT'].includes(init.method))).toBe(false);
  });
});

it('verifies Amazon participation without inventing a seller ID from the response', async () => {
  fetchMock.mockResolvedValueOnce(response({ payload: [
    { marketplace: { id: 'ATVPDKIKX0DER' }, participation: { isParticipating: true, hasSuspendedListings: false } },
    { marketplace: { id: 'inactive' }, participation: { isParticipating: false } },
  ] }));
  expect(await getSellerMarketplaceIds('authorized')).toEqual(['ATVPDKIKX0DER']);
  expect(fetchMock.mock.calls[0][1].headers['x-amz-access-token']).toBe('authorized');
});
it('gets the Etsy shop for the authenticated user and sends the required API key pair', async () => {
  fetchMock.mockResolvedValueOnce(response({ shop_id: 456, shop_name: 'MyShop' }));
  expect(await getEtsyShopInfo('123.authorized')).toEqual({ userId: '123', shopId: '456', shopName: 'MyShop' });
  expect(fetchMock.mock.calls[0][0]).toContain('/users/123/shops');
  expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('test-app:test-app');
});
