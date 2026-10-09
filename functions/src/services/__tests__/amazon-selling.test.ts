import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { amazonCredentials, getAmazonSetupOptions, pushListingToAmazon, checkAmazonListing, validateAmazonSettings, buildAmazonSubmissions } from '../amazon-sp-api';
const fetchMock = vi.fn();
const response = (value: any, status = 200) => new Response(JSON.stringify(value), { status });
const credentials = { sellerId: 'selected-seller', marketplaceId: 'ATVPDKIKX0DER', refreshToken: 'selected-refresh' };
const sku = 'QRG-11111-I-000001';
const product = { title: 'Saved shirt', description: 'Saved description', price: 29, currencyCode: 'USD', quantity: 99, imageUrls: ['https://images/a', 'https://images/b', 'https://images/c'], bulletPoints: [], keywords: [], condition: 'new_new' as const, brandName: '' };
const schema = { properties: Object.fromEntries(['item_name', 'product_description', 'main_product_image_locator', 'other_product_image_locator_1', 'other_product_image_locator_2', 'brand', 'color', 'shirt_size', 'condition_type', 'merchant_suggested_asin', 'purchasable_offer', 'fulfillment_availability', 'parentage_level', 'child_parent_sku_relationship'].map(name => [name, {}])) as Record<string, any>, required: ['brand'] };
schema.properties.variation_theme = { items: { properties: { name: { enum: ['SIZE/COLOR'] } } } };
const settings = { productType: 'SHIRT', quantity: 0, attributes: { brand: [{ value: 'Saved brand' }] }, variationTheme: 'SIZE/COLOR', parentAttributes: { brand: [{ value: 'Saved brand' }] }, variantAttributes: { '0101': { color: [{ value: 'Black' }], shirt_size: [{ size: 'large', size_system: 'us' }] }, '0202': { color: [{ value: 'White' }], shirt_size: [{ size: 'small', size_system: 'us' }] } } };
const variants = [{ sku: `${sku}:0101`, variantKey: '0101', size: 'L', color: 'Black' }, { sku: `${sku}:0202`, variantKey: '0202', size: 'S', color: 'White' }];
const raw = JSON.stringify(schema);
let writes: Array<{ url: string; body: any }>;
beforeEach(() => {
  writes = []; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('AMAZON_SP_CLIENT_ID', 'test'); vi.stubEnv('AMAZON_SP_CLIENT_SECRET', 'test');
  fetchMock.mockImplementation(async (input: any, init: any = {}) => {
    const url = String(input);
    if (url.includes('/auth/o2/token')) return response({ access_token: 'selected-access' });
    if (url.includes('/definitions/')) return response({ schema: { link: { resource: 'https://requirements.s3.amazonaws.com/schema' }, checksum: createHash('md5').update(raw).digest('base64') } });
    if (url.includes('requirements.s3.amazonaws.com')) return new Response(raw);
    if (url.includes('VALIDATION_PREVIEW')) return response({ status: 'VALID' });
    if (init.method === 'PUT') { writes.push({ url, body: JSON.parse(init.body) }); return response({ status: 'ACCEPTED' }); }
    throw new Error('Unexpected external request');
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Amazon selling with mocked SP-API', () => {
  it('loads seller-specific parent/child requirements and verifies the document checksum', async () => {
    const options = await getAmazonSetupOptions(credentials, 'SHIRT', '', true);
    expect(options.schema).toEqual(schema); expect(options.parentSchema).toEqual(schema);
    const urls = fetchMock.mock.calls.map(call => String(call[0]));
    expect(urls.some(url => url.includes('sellerId=selected-seller') && url.includes('parentageLevel=CHILD'))).toBe(true);
    expect(urls.some(url => url.includes('parentageLevel=PARENT'))).toBe(true);
    const schemaRequest = fetchMock.mock.calls.find(call => String(call[0]).includes('requirements.s3.amazonaws.com'))!;
    expect(schemaRequest[1].headers).toBeUndefined();
  });
  it('rejects damaged schemas and client-like redirect locations before publishing', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => String(input).includes('requirements.s3.amazonaws.com') ? new Response('{}') : original(input, init));
    await expect(getAmazonSetupOptions(credentials, 'SHIRT')).rejects.toThrow('integrity'); expect(writes).toHaveLength(0);
  });
  it('requires a verified US marketplace rather than defaulting missing seller metadata', () => {
    expect(() => amazonCredentials({ amazonSellerId: 'seller', amazonRefreshToken: 'token' })).toThrow('Amazon US');
  });
  it('publishes the parent then only real saved combinations, after previewing ALL and persisting identities', async () => {
    const events: string[] = [];
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) => { if (String(url).includes('VALIDATION_PREVIEW')) events.push('preview'); else if (init?.method === 'PUT') events.push('write'); return original(url, init); });
    const persist = vi.fn(async () => { events.push('persist'); });
    const result = await pushListingToAmazon(credentials, product, sku, settings, variants, persist);
    expect(result).toMatchObject({ success: true, listingStatus: 'pending', status: 'ACCEPTED' });
    expect(events).toEqual(['preview', 'preview', 'preview', 'persist', 'write', 'write', 'write']);
    expect(persist).toHaveBeenCalledWith([{ sku, parent: true }, { sku: `${sku}:0101`, variantKey: '0101', size: 'L', color: 'Black' }, { sku: `${sku}:0202`, variantKey: '0202', size: 'S', color: 'White' }]);
    expect(writes[0].body.attributes.purchasable_offer).toBeUndefined();
    expect(writes[1].body.attributes.child_parent_sku_relationship[0].parent_sku).toBe(sku);
    expect(writes[1].body.attributes.fulfillment_availability[0].quantity).toBe(0);
    expect(writes[1].body.attributes.purchasable_offer[0].our_price[0].schedule[0].value_with_tax).toBe(29);
    expect(writes[1].body.attributes.other_product_image_locator_2[0].media_location).toBe('https://images/c');
    expect(writes[2].body.attributes.color[0].value).toBe('White');
    expect(fetchMock.mock.calls.find(call => String(call[0]).includes('/auth/o2/token'))![1].body).toContain('refresh_token=selected-refresh');
  });
  it('never writes a partial family when one child fails preview', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => String(input).includes('VALIDATION_PREVIEW') && String(input).includes('0202') ? response({ status: 'INVALID', issues: [{ code: 'MISSING', message: 'Provide fabric', severity: 'ERROR' }] }) : original(input, init));
    const persist = vi.fn(); const result = await pushListingToAmazon(credentials, product, sku, settings, variants, persist);
    expect(result.success).toBe(false); expect(result.error).toContain('Provide fabric'); expect(persist).not.toHaveBeenCalled(); expect(writes).toHaveLength(0);
  });
  it('keeps all intended identities when a network outcome becomes unknown', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => init?.method === 'PUT' && !String(input).includes('VALIDATION_PREVIEW') ? Promise.reject(new Error('Connection lost')) : original(input, init));
    const persist = vi.fn(); const result = await pushListingToAmazon(credentials, product, sku, settings, variants, persist);
    expect(result.success).toBe(false); expect(persist.mock.calls[0][0]).toHaveLength(3);
  });
  it('refuses a changed selection that would abandon an existing child', async () => {
    const result = await pushListingToAmazon(credentials, product, sku, settings, variants, vi.fn(), [{ sku: `${sku}:9999`, variantKey: '9999' }]);
    expect(result.error).toContain('previous Amazon listing'); expect(writes).toHaveLength(0);
  });
  it('rejects setup attempts to override the canonical sale price or relationship', () => {
    expect(() => validateAmazonSettings({ ...settings, attributes: { purchasable_offer: [] } })).toThrow('cannot change');
    expect(() => validateAmazonSettings({ ...settings, quantity: -1 })).toThrow('quantity');
    expect(() => buildAmazonSubmissions(product, sku, { ...settings, variationTheme: 'MADE_UP' }, variants, { productTypes: [], schema, parentSchema: schema })).toThrow('supported');
  });
  it('does not mark a family active until every sellable child is BUYABLE', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => String(input).includes('/listings/') ? response({ summaries: [{ marketplaceId: credentials.marketplaceId, status: String(input).includes('0202') ? [] : ['BUYABLE'], asin: 'B012345678' }] }) : original(input, init));
    const result = await checkAmazonListing(credentials, sku, [{ sku, parent: true }, ...variants]);
    expect(result.listingStatus).toBe('pending'); expect(result.remoteStatus).toBe('1/2 variations buyable');
    expect(result.externalUrl).toBe('https://www.amazon.com/dp/B012345678');
  });
  it('keeps asynchronous removal pending until every SKU is absent and deletes children first', async () => {
    const events: string[] = [], original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => { if (init?.method === 'DELETE') { events.push(String(input)); return response({ status: 'ACCEPTED' }); } return String(input).includes('/listings/') ? response({ summaries: [{ marketplaceId: credentials.marketplaceId, status: ['BUYABLE'] }] }) : original(input, init); });
    const result = await checkAmazonListing(credentials, sku, [{ sku, parent: true }, ...variants], true, false, async () => { events.push('persist'); });
    expect(result.listingStatus).toBe('pending'); expect(result.remoteStatus).toContain('Removal processing');
    expect(events[0]).toBe('persist'); expect(events[1]).toContain('0101'); expect(events[3]).toContain(`${sku}?`);
    fetchMock.mockImplementation((input, init) => String(input).includes('/listings/') ? response({}, 404) : original(input, init));
    expect((await checkAmazonListing(credentials, sku, [{ sku, parent: true }, ...variants], false, true)).listingStatus).toBe('delisted');
  });
  it('surfaces later catalog issues and refuses removal of unrelated identities', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => String(input).includes('/listings/') ? response({ issues: [{ code: 'REJECTED', message: 'Brand approval required', severity: 'ERROR' }] }) : original(input, init));
    const result = await checkAmazonListing(credentials, sku, [{ sku }]);
    expect(result.success).toBe(false); expect(result.listingStatus).toBe('error'); expect(result.error).toContain('Brand approval');
    await expect(checkAmazonListing(credentials, sku, [{ sku: 'unrelated' }], true)).rejects.toThrow('identities');
  });
});
