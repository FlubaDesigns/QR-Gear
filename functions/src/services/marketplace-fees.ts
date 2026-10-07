import { createHash, randomUUID } from 'crypto';
import { db } from '../core';
import { MARKETPLACE_LISTINGS_COLLECTION, MARKETPLACE_ACCOUNTS_COLLECTION, SURFACES_COLLECTION } from '../constants';
import { getAccessToken as amazonToken } from './amazon-sp-api';
import { getAccessToken as ebayToken } from './ebay-api';
import { computePricingSnapshot, marketplaceSalePrice, type MarketplaceFees } from '../../../shared/surfaces';

export function feeContextKey(listing: any, surface: any, account: any): string {
  return createHash('sha256').update(JSON.stringify({
    accountId: listing.accountId, platform: listing.platform, product: surface.masterProductId,
    sku: surface.sku, price: marketplaceSalePrice(surface as any, listing.platform), currency: surface.currency || 'USD',
    marketplace: account.amazonMarketplaceId || '', seller: account.amazonSellerId || account.ebayUserId || account.etsyShopId || '',
    connected: account[`${listing.platform}Connected`] === true, connectedAt: account[`${listing.platform}ConnectedAt`] || '',
    active: account.isActive === true, enabled: surface.enabledPlatforms?.includes(listing.platform) === true,
    // Category/attributes/shipping policies can change the estimate without changing price.
    amazonProductType: surface.amazonProductType || '', ebay: surface.ebay || {},
    externalOfferId: listing.externalOfferId || '',
  })).digest('hex');
}

function money(value: any, currency: string): number {
  const amount = value?.Amount ?? value?.value;
  const code = value?.CurrencyCode ?? value?.currency;
  if ((typeof amount !== 'number' && typeof amount !== 'string') || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0 || code !== currency) {
    throw new Error('Marketplace returned an invalid fee amount or a different currency.');
  }
  return Number(amount);
}

export async function retrieveMarketplaceFees(listing: any, surface: any, account: any): Promise<MarketplaceFees> {
  const price = marketplaceSalePrice(surface as any, listing.platform), currency = surface.currency || 'USD';
  const fees: MarketplaceFees = { status: 'unavailable', source: 'none', scope: 'per_sale', amount: null,
    price, currency, sku: surface.sku || '', accountId: listing.accountId, contextKey: feeContextKey(listing, surface, account),
    retrievedAt: new Date().toISOString(), components: [] };
  try {
    if (account.platform !== listing.platform || !account.isActive || !account[`${listing.platform}Connected`] || !account[`${listing.platform}RefreshToken`]) throw new Error('Connect this marketplace account before retrieving fees.');
    if (!surface.enabledPlatforms?.includes(listing.platform)) throw new Error('Enable this marketplace on the item first.');
    if (!surface.sku || listing.marketplaceSku !== surface.sku || listing.productInstanceId !== surface.masterProductId) throw new Error('Listing and product identity do not match.');
    if (!Number.isFinite(price) || price <= 0) throw new Error('Set a positive selling price before retrieving fees.');
    if (listing.platform === 'amazon') {
      fees.source = 'amazon_product_fees';
      if (!account.amazonSellerId || !account.amazonMarketplaceId) throw new Error('Reconnect Amazon to verify the seller and marketplace.');
      const token = await amazonToken(account.amazonRefreshToken);
      const identifier = randomUUID();
      const resp = await fetch(`https://sellingpartnerapi-na.amazon.com/products/fees/v0/listings/${encodeURIComponent(surface.sku)}/feesEstimate`, {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', 'x-amz-access-token': token },
        body: JSON.stringify({ FeesEstimateRequest: { MarketplaceId: account.amazonMarketplaceId, Identifier: identifier,
          IsAmazonFulfilled: false, PriceToEstimateFees: { ListingPrice: { CurrencyCode: currency, Amount: price } } } }),
      });
      if (!resp.ok) throw new Error(`Amazon fees unavailable (HTTP ${resp.status}). Check seller authorization and SKU, then retry.`);
      const data: any = await resp.json(), result = data?.payload?.FeesEstimateResult;
      if (result?.Status !== 'Success') throw new Error('Amazon could not estimate this SKU. It may need to be accepted in the seller catalog first.');
      if (result.FeesEstimateIdentifier?.SellerInputIdentifier !== identifier) throw new Error('Amazon returned a fee estimate for a different request.');
      const estimate = result.FeesEstimate;
      fees.amount = money(estimate?.TotalFeesEstimate, currency);
      fees.components = (estimate.FeeDetailList || []).map((item: any) => ({ name: item.FeeType, amount: money(item.FinalFee, currency) }));
      fees.status = 'estimated';
      fees.reason = 'Per sale estimate for seller fulfillment and the item price; excludes buyer shipping charges and actual settlement adjustments.';
    } else if (listing.platform === 'ebay') {
      fees.source = 'ebay_listing_fees'; fees.scope = 'listing';
      if (!listing.externalOfferId) throw new Error('eBay listing fees become available when its offer is prepared for publishing.');
      const token = await ebayToken(account.ebayRefreshToken);
      const resp = await fetch('https://api.ebay.com/sell/inventory/v1/offer/get_listing_fees', {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // One offer only: eBay otherwise aggregates fees across offers.
        body: JSON.stringify({ offers: [{ offerId: listing.externalOfferId }] }),
      });
      if (!resp.ok) throw new Error(`eBay listing fees unavailable (HTTP ${resp.status}). This API requires an unpublished offer.`);
      const data: any = await resp.json();
      if (!Array.isArray(data.feeSummaries) || data.feeSummaries.length !== 1 || data.feeSummaries[0].marketplaceId !== 'EBAY_US') throw new Error('eBay did not return fees for this offer marketplace.');
      const entries = data.feeSummaries[0].fees;
      if (!Array.isArray(entries) || entries.length === 0) throw new Error('eBay did not return a listing fee breakdown.');
      fees.components = entries.map((entry: any) => ({ name: entry.feeType, amount: money(entry.amount, currency) }));
      fees.amount = Math.round(fees.components.reduce((total, entry) => total + entry.amount, 0) * 100) / 100;
      fees.status = 'partial'; fees.reason = 'Listing charges only, not a per-sale fee. Final-value, payment and other sale fees are not included; margin unavailable.';
    } else {
      fees.source = 'etsy';
      throw new Error('Etsy does not provide a complete pre-sale fee estimate here. Actual payment/ledger fee import is not connected yet.');
    }
  } catch (error: any) {
    fees.status = 'unavailable'; fees.amount = null; fees.components = [];
    // Provider error text can contain credentials; only errors authored above leave this module.
    fees.reason = /^(Connect |Enable |Listing and |Set a |Reconnect |Amazon fees |Amazon could |Amazon returned |eBay |Etsy |Marketplace returned)/.test(error.message || '')
      ? error.message : 'Could not retrieve marketplace fees. Check the connection and retry.';
    console.warn('[Marketplace fees]', listing.id, fees.reason);
  }
  return fees;
}

/** Never silently reuse an estimate after price, seller or product context changes. */
export function currentFees(listing: any, surface: any, account: any): MarketplaceFees | undefined {
  if (!listing.fees) return undefined;
  if (listing.fees.contextKey !== feeContextKey(listing, surface, account)) return { ...listing.fees, status: 'stale', amount: null, reason: 'Item or account changed. Refresh fees.' };
  return listing.fees;
}

export function itemMargin(fees: MarketplaceFees | undefined, productCost: unknown, currency: string) {
  if (fees?.status !== 'estimated' || fees.scope !== 'per_sale' || fees.amount == null || fees.currency !== currency ||
      typeof productCost !== 'number' || !Number.isFinite(productCost) || productCost < 0 || fees.price <= 0) return null;
  const snapshot = computePricingSnapshot({ salePrice: fees.price, productCost, platformFeeAmount: fees.amount, currency });
  return { amount: snapshot.grossProfitAmount, percent: Math.round(snapshot.grossProfitAmount / fees.price * 10000) / 100, productCost, currency };
}

async function readFeeContext(listing: any) {
  const [surfaceDoc, accountDoc] = await Promise.all([
    db.collection(SURFACES_COLLECTION).doc(listing.surfaceId).get(), db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(listing.accountId).get(),
  ]);
  if (!surfaceDoc.exists || !accountDoc.exists) throw new Error('Listing surface or account no longer exists.');
  return { surface: surfaceDoc.data()!, account: accountDoc.data()! };
}
export async function refreshListingFees(listingId: string) {
  const ref = db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId), snap = await ref.get();
  if (!snap.exists) throw new Error('Listing not found.');
  const listing = { ...snap.data()!, id: listingId }, { surface, account } = await readFeeContext(listing);
  const fees = await retrieveMarketplaceFees(listing, surface, account);
  await db.runTransaction(async tx => {
    const latest = await tx.get(ref);
    if (!latest.exists) throw new Error('Listing was removed during fee retrieval.');
    const data = latest.data()!;
    const latestSurface = await tx.get(db.collection(SURFACES_COLLECTION).doc(data.surfaceId));
    const latestAccount = await tx.get(db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(data.accountId));
    if (!latestSurface.exists || !latestAccount.exists || fees.contextKey !== feeContextKey(data, latestSurface.data(), latestAccount.data())) throw new Error('Item changed during fee retrieval. Retry.');
    tx.update(ref, { fees, updatedAt: new Date().toISOString() });
  });
  return fees;
}

export async function listingWithFees(listing: any) {
  const { surface, account } = await readFeeContext(listing), fees = currentFees(listing, surface, account);
  const product = await db.collection('admin_catalog_instances').doc(surface.masterProductId).get();
  const instance = product.data();
  // The builder pricing subtotal is the existing canonical product cost, before markup.
  let pricing = instance?.resolved?.pricing;
  if (!pricing && instance?.currentPacketId) pricing = (await db.collection('productPackets').doc(instance.currentPacketId).get()).data()?.pricing;
  return { ...listing, price: marketplaceSalePrice(surface as any, listing.platform), currency: surface.currency || 'USD', fees,
    estimatedMargin: itemMargin(fees, pricing?.subtotal, pricing?.currency || 'USD') };
}
