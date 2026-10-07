import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const context = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ get db() { return context.db; } }));
vi.mock('../amazon-sp-api', () => ({ getAccessToken: vi.fn(async () => 'amazon-access') }));
vi.mock('../ebay-api', () => ({ getAccessToken: vi.fn(async () => 'ebay-access') }));
import { currentFees, feeContextKey, itemMargin, listingWithFees, refreshListingFees, retrieveMarketplaceFees } from '../marketplace-fees';
import { getAccessToken } from '../amazon-sp-api';
const fetchMock = vi.fn();
const surface = { masterProductId: 'i', sku: 'QRG-11111-I-000001', retailPrice: 30, currency: 'USD', enabledPlatforms: ['amazon', 'ebay', 'etsy'] };
const account = { platform: 'amazon', isActive: true, amazonConnected: true, amazonRefreshToken: 'seller-refresh', amazonSellerId: 'seller', amazonMarketplaceId: 'ATVPDKIKX0DER' };
const listing = { id: 'l', surfaceId: 's', accountId: 'a', productInstanceId: 'i', marketplaceSku: surface.sku, platform: 'amazon' };
const response = (data: any, status = 200) => new Response(JSON.stringify(data), { status });
let fixture: ReturnType<typeof database>;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock);
  fixture = database({ 'surfaces/s': surface, 'marketplaceAccounts/a': account, 'marketplaceListings/l': listing,
    'admin_catalog_instances/i': { resolved: { pricing: { subtotal: 10, customerPrice: 30 } } } }); context.db = fixture.db;
  fetchMock.mockImplementation(async (_url: string, options: any) => {
    const request = JSON.parse(options.body).FeesEstimateRequest;
    return response({ payload: { FeesEstimateResult: { Status: 'Success', FeesEstimateIdentifier: { SellerInputIdentifier: request.Identifier },
      FeesEstimate: { TotalFeesEstimate: { CurrencyCode: 'USD', Amount: 4.5 }, FeeDetailList: [{ FeeType: 'ReferralFee', FinalFee: { CurrencyCode: 'USD', Amount: 4.5 } }] } } } });
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('Marketplace fee ownership and margin', () => {
  it('requests the selected seller SKU/price, persists on its listing, and uses the amount in margin', async () => {
    const fees = await refreshListingFees('l');
    expect(getAccessToken).toHaveBeenCalledWith('seller-refresh');
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent(surface.sku));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body).FeesEstimateRequest;
    expect(payload).toMatchObject({ MarketplaceId: 'ATVPDKIKX0DER', IsAmazonFulfilled: false, PriceToEstimateFees: { ListingPrice: { Amount: 30, CurrencyCode: 'USD' } } });
    expect(fixture.store.get('marketplaceListings/l').fees).toEqual(fees);
    expect(fixture.store.get('marketplaceAccounts/a').fees).toBeUndefined();
    expect((await listingWithFees(fixture.store.get('marketplaceListings/l'))).estimatedMargin).toMatchObject({ amount: 15.5, percent: 51.67 });
  });
  it.each(['price', 'seller', 'disconnect', 'category'])('invalidates fees after a %s change', async change => {
    const fees = await refreshListingFees('l'); const s: any = structuredClone(surface), a: any = structuredClone(account);
    if (change === 'price') s.retailPrice = 31;
    if (change === 'seller') a.amazonSellerId = 'other';
    if (change === 'disconnect') a.amazonConnected = false;
    if (change === 'category') s.amazonProductType = 'MUG';
    const current = currentFees({ ...listing, fees }, s, a);
    expect(current?.status).toBe('stale'); expect(current?.amount).toBeNull(); expect(itemMargin(current, 10, 'USD')).toBeNull();
  });
  it('does not assign fees to another account or use the old account-wide percent', async () => {
    const fees = await retrieveMarketplaceFees(listing, surface, { ...account, feePercent: 99 });
    expect(fees.amount).toBe(4.5); expect(fees.accountId).toBe('a');
    expect(feeContextKey({ ...listing, accountId: 'other' }, surface, account)).not.toBe(fees.contextKey);
  });
  it('refuses stale writes when price changes during the provider request', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (...args: any[]) => { fixture.store.get('surfaces/s').retailPrice = 32; return original(...args); });
    await expect(refreshListingFees('l')).rejects.toThrow('Item changed'); expect(fixture.store.get('marketplaceListings/l').fees).toBeUndefined();
  });
  it.each([403, 429, 500])('stores unavailable, never zero, on provider HTTP %s', async status => {
    fetchMock.mockResolvedValue(response({}, status)); const fees = await refreshListingFees('l');
    expect(fees.status).toBe('unavailable'); expect(fees.amount).toBeNull(); expect(itemMargin(fees, 10, 'USD')).toBeNull();
  });
  it('rejects currency mismatch and another request identifier', async () => {
    fetchMock.mockResolvedValue(response({ payload: { FeesEstimateResult: { Status: 'Success', FeesEstimateIdentifier: { SellerInputIdentifier: 'wrong' }, FeesEstimate: { TotalFeesEstimate: { CurrencyCode: 'EUR', Amount: 4 } } } } }));
    const fees = await refreshListingFees('l'); expect(fees.status).toBe('unavailable'); expect(fees.amount).toBeNull();
  });
  it('keeps partial eBay listing charges separate from a per-sale margin', async () => {
    fetchMock.mockResolvedValue(response({ feeSummaries: [{ marketplaceId: 'EBAY_US', fees: [{ feeType: 'InsertionFee', amount: { currency: 'USD', value: '0.35' } }] }] }));
    const fees = await retrieveMarketplaceFees({ ...listing, platform: 'ebay', externalOfferId: 'offer-1' }, { ...surface, ebay: { priceOverride: 35 } },
      { platform: 'ebay', isActive: true, ebayConnected: true, ebayRefreshToken: 'ebay-refresh' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ offers: [{ offerId: 'offer-1' }] });
    expect(fees).toMatchObject({ status: 'partial', amount: 0.35, price: 35, scope: 'listing' }); expect(itemMargin(fees, 10, 'USD')).toBeNull();
  });
  it('does not invent Etsy estimates or zero product costs', async () => {
    const fees = await retrieveMarketplaceFees({ ...listing, platform: 'etsy' }, surface, { platform: 'etsy', isActive: true, etsyConnected: true, etsyRefreshToken: 'etsy-refresh' });
    expect(fees.status).toBe('unavailable'); expect(fetchMock).not.toHaveBeenCalled();
    const amazonFees = await refreshListingFees('l'); expect(itemMargin(amazonFees, undefined, 'USD')).toBeNull(); expect(itemMargin(amazonFees, 10, 'EUR')).toBeNull();
  });
});

it('never uses one variation’s fees as the fee for the entire variation group', async () => {
  const fees = await retrieveMarketplaceFees({ ...listing, platform: 'ebay', externalOfferId: 'offer', ebayOffers: [{ sku: 'first', offerId: 'offer' }, { sku: 'second', offerId: 'other' }] }, surface, { platform: 'ebay', isActive: true, ebayConnected: true, ebayRefreshToken: 'selected' });
  expect(fees.status).toBe('unavailable'); expect(fees.amount).toBeNull(); expect(fees.reason).toContain('variation-group'); expect(fetchMock).not.toHaveBeenCalled();
});

it('attaches Amazon estimates to individual child SKUs without adding them into a group sale fee', async () => {
  const row = fixture.store.get('marketplaceListings/l');
  row.amazonItems = [{ sku: surface.sku, parent: true }, { sku: `${surface.sku}:0101`, variantKey: '0101' }, { sku: `${surface.sku}:0202`, variantKey: '0202' }];
  const fees = await refreshListingFees('l');
  expect(fees.amount).toBeNull(); expect(fees.status).toBe('partial'); expect(fees.variants?.map(item => item.amount)).toEqual([4.5, 4.5]);
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([expect.stringContaining(encodeURIComponent(`${surface.sku}:0101`)), expect.stringContaining(encodeURIComponent(`${surface.sku}:0202`))]));
  expect(itemMargin(fees, 10, 'USD')).toBeNull();
  const stale = currentFees({ ...row, fees }, { ...surface, retailPrice: 31 }, account);
  expect(stale?.variants?.every((item: any) => item.status === 'stale' && item.amount === null)).toBe(true);
});
it('preserves one child fee when another child estimate fails', async () => {
  const row = fixture.store.get('marketplaceListings/l');
  row.amazonItems = [{ sku: surface.sku, parent: true }, { sku: `${surface.sku}:0101` }, { sku: `${surface.sku}:0202` }];
  const original = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation((url, options) => String(url).includes('0202') ? response({}, 403) : original(url, options));
  const fees = await refreshListingFees('l');
  expect(fees.variants?.[0].amount).toBe(4.5); expect(fees.variants?.[1].amount).toBeNull(); expect(fees.status).toBe('partial');
});
