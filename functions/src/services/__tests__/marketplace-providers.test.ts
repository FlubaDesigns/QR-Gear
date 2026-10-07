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
describe('Marketplace provider request regressions (mocked HTTP only)', () => {
  it('Etsy saves rotated credentials and the draft ID before image failure', async () => {
    const events: string[] = [];
    fetchMock.mockResolvedValueOnce(response({ access_token: 'fresh', refresh_token: 'rotated' })).mockResolvedValueOnce(response({ listing_id: 123 })).mockResolvedValueOnce(response({ products: [{ property_values: [], offerings: [{ readiness_state_id: 4 }] }] })).mockResolvedValueOnce(response({})).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const result = await pushListingToEtsy({ refreshToken: 'selected', accessToken: '', shopId: 'shop', shopName: '', userId: '' }, { ...common, tags: [], taxonomyId: 1, shippingProfileId: 2, whoMade: 'i_did', whenMade: 'made_to_order' }, {
      onRefreshToken: async token => { events.push(token); }, onBeforeCreate: async () => { events.push('creating'); }, onListingCreated: async id => { events.push(String(id)); },
    });
    expect(events).toEqual(['rotated', 'creating', '123']); expect(result.success).toBe(false); expect(result.state).toBe('draft'); expect(result.listingId).toBe(123);
  });
  it('Etsy updates a known draft instead of creating another listing', async () => {
    fetchMock.mockResolvedValueOnce(response({ access_token: 'fresh', refresh_token: 'rotated' })).mockResolvedValueOnce(response({ listing_id: 123 })).mockResolvedValueOnce(response({ products: [{ property_values: [], offerings: [{ readiness_state_id: 4 }] }] })).mockResolvedValueOnce(response({})).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const beforeCreate = vi.fn();
    await pushListingToEtsy({ refreshToken: 'selected', accessToken: '', shopId: 'shop', shopName: '', userId: '' }, { ...common, tags: [], taxonomyId: 1, shippingProfileId: 2, whoMade: 'i_did', whenMade: 'made_to_order' }, {
      existingListingId: 123, onRefreshToken: async () => {}, onBeforeCreate: beforeCreate, onListingCreated: async () => {},
    });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body).products[0].offerings[0]).toEqual({ price: 29, quantity: 0, is_enabled: true, readiness_state_id: 4 });
    expect(beforeCreate).not.toHaveBeenCalled(); expect(fetchMock.mock.calls[1][0]).toContain('/listings/123'); expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
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
