import { marketplaceSalePrice } from '../../../shared/surfaces';
import { pushListingToAmazon } from './amazon-sp-api';
import { pushListingToEbay } from './ebay-api';
import { pushListingToEtsy } from './etsy-api';
import type { MarketplacePlatform } from '../constants';

export interface PublishResult {
  success: boolean;
  sku: string;
  listingStatus: 'pending' | 'draft' | 'active' | 'error';
  externalListingId?: string;
  externalUrl?: string;
  error?: string;
  [key: string]: unknown;
}

/** One account-aware dispatcher for both Push and Jobs. Never uses global seller tokens. */
export async function publishMarketplaceListing(
  platform: MarketplacePlatform,
  surface: Record<string, any>,
  account: Record<string, any>,
  listing: Record<string, any>,
  persist: {
    etsyCreateAttempt: () => Promise<void>;
    etsyToken: (refreshToken: string) => Promise<void>;
    externalListing: (externalListingId: string) => Promise<void>;
    ebayOffer?: (offerId: string) => Promise<void>;
  },
): Promise<PublishResult> {
  if (account.platform !== platform || !account.isActive) throw new Error('Marketplace account is inactive or does not match this listing.');
  if (!surface.enabledPlatforms?.includes(platform)) throw new Error('Enable this marketplace on the surface before publishing.');
  if (!account[`${platform}Connected`] || !account[`${platform}RefreshToken`]) throw new Error(`Connect this ${platform} account before publishing.`);
  const price = marketplaceSalePrice(surface as any, platform);
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error('Set a positive retail price before publishing.');
  if (!surface.title?.trim() || !surface.description?.trim() || !surface.images?.length) throw new Error('Title, description and product images are required before publishing.');
  const sku: string = surface.sku;
  const quantity = platform === 'ebay' ? surface.ebay?.quantity ?? 100 : 100;
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantity must be a non-negative whole number.');
  const common = { title: surface.title, description: surface.description, price, currencyCode: surface.currency || 'USD', quantity,
    imageUrls: surface.images.map((image: any) => typeof image === 'string' ? image : image?.url).filter(Boolean) };
  if (platform === 'amazon') {
    if (!account.amazonSellerId) throw new Error('Reconnect Amazon to record your Seller ID.');
    const result = await pushListingToAmazon({ sellerId: account.amazonSellerId, marketplaceId: account.amazonMarketplaceId || 'ATVPDKIKX0DER', refreshToken: account.amazonRefreshToken }, {
      ...common, bulletPoints: surface.bulletPoints || [], keywords: surface.keywords || surface.tags || [],
      condition: 'new_new', brandName: surface.brand || 'QR Gear', productType: surface.amazonProductType || 'SHIRT',
    }, sku);
    // An accepted submission is not proof that Amazon made the listing buyable.
    return { ...result, listingStatus: result.success ? 'pending' : 'error', ...(result.success ? { externalListingId: sku } : {}) };
  }
  if (platform === 'ebay') {
    const eb = surface.ebay || {};
    if (!eb.categoryId) throw new Error('Set the eBay category ID on the surface before publishing.');
    const raw = typeof eb.itemSpecifics === 'string' ? JSON.parse(eb.itemSpecifics) : eb.itemSpecifics || {};
    const aspects = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : [String(value)]]));
    const result = await pushListingToEbay({ userId: account.ebayUserId || '', username: account.ebayUsername || '', refreshToken: account.ebayRefreshToken }, {
      ...common, condition: eb.conditionId === '1000' ? 'NEW' : eb.conditionId || 'NEW', brand: eb.brand || surface.brand || 'QR Gear',
      categoryId: String(eb.categoryId), listingFormat: eb.listingFormat || 'FIXED_PRICE',
      fulfillmentPolicyId: eb.shippingPolicyId || undefined, paymentPolicyId: eb.paymentPolicyId || undefined,
      returnPolicyId: eb.returnsPolicyId || undefined, merchantLocationKey: eb.merchantLocationKey || undefined,
      upc: eb.upc || undefined, ean: eb.ean || undefined, mpn: eb.mpn || undefined, aspects,
      bestOfferEnabled: eb.bestOfferEnabled === true, subtitle: eb.subtitle || undefined,
    }, sku, persist.ebayOffer);
    return { ...result, listingStatus: result.success ? 'active' : 'error', ...(result.listingId ? { externalListingId: result.listingId, externalUrl: `https://www.ebay.com/itm/${result.listingId}` } : {}) };
  }
  const options = listing.publishOptions || {};
  for (const key of ['taxonomyId', 'shippingProfileId']) {
    if (!Number.isSafeInteger(options[key]) || options[key] <= 0) throw new Error(`Set Etsy ${key} using Push to Etsy before publishing or retrying.`);
  }
  if (!account.etsyShopId) throw new Error('Reconnect Etsy to record your Shop ID.');
  const result = await pushListingToEtsy({ accessToken: '', refreshToken: account.etsyRefreshToken, shopId: account.etsyShopId, shopName: account.etsyShopName || '', userId: account.etsyUserId || '' }, {
    ...common, tags: surface.tags || [], taxonomyId: options.taxonomyId, shippingProfileId: options.shippingProfileId,
    returnPolicyId: options.returnPolicyId, whoMade: options.whoMade || 'i_did', whenMade: options.whenMade || 'made_to_order', sku,
  }, {
    existingListingId: listing.externalListingId ? Number(listing.externalListingId) : undefined,
    onRefreshToken: persist.etsyToken,
    onBeforeCreate: persist.etsyCreateAttempt,
    onListingCreated: id => persist.externalListing(String(id)),
  });
  return { ...result, sku, listingStatus: result.state === 'active' ? 'active' : result.listingId ? 'draft' : 'error',
    ...(result.listingId ? { externalListingId: String(result.listingId), externalUrl: result.url } : {}) };
}
