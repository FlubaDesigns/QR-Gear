import { requireLiveCommerce } from '../runtime-config';
import { validateEtsySettings } from '../../../shared/etsy';
import { marketplaceSalePrice } from '../../../shared/surfaces';
import { pushListingToAmazon, checkAmazonListing, amazonCredentials, amazonProductFromSurface } from './amazon-sp-api';
import { pushListingToEbay, checkEbayListing, type EbayListingIdentity } from './ebay-api';
import type { MarketplaceVariant } from './marketplace-variants';
import { pushListingToEtsy, checkEtsyListing, etsyCredentials } from './etsy-api';
import type { MarketplacePlatform } from '../constants';

export interface PublishResult {
  success: boolean;
  sku: string;
  listingStatus: 'pending' | 'draft' | 'active' | 'error' | 'delisted';
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
    amazonItems?: (items: import('../../../shared/surfaces').AmazonListingItem[]) => Promise<void>;
    amazonRemoval?: () => Promise<void>;
    ebayPrepared?: () => Promise<void>;
    ebayOffer?: (offerId: string, identity?: EbayListingIdentity) => Promise<void>;
  },
  variants: MarketplaceVariant[] = [],
  action = 'create',
): Promise<PublishResult> {
  requireLiveCommerce('Marketplace publishing');
  if (account.platform !== platform || !account.isActive) throw new Error('Marketplace account is inactive or does not match this listing.');
  if (!account[`${platform}Connected`] || !account[`${platform}RefreshToken`]) throw new Error(`Connect this ${platform} account before publishing.`);
  if (platform === 'etsy' && ['check_status', 'delete'].includes(action)) {
    return checkEtsyListing(etsyCredentials(account), listing.externalListingId, listing.marketplaceSku, action === 'delete', persist.etsyToken);
  }
  if (platform === 'amazon' && ['check_status', 'delete'].includes(action)) {
    return await checkAmazonListing(amazonCredentials(account), listing.marketplaceSku,
      listing.amazonItems || (listing.externalListingId === listing.marketplaceSku ? [{ sku: listing.marketplaceSku }] : []),
      action === 'delete', listing.amazonRemovalRequested, persist.amazonRemoval) as PublishResult;
  }
  if (platform === 'ebay' && ['check_status', 'delete'].includes(action)) {
    const result = await checkEbayListing({ userId: account.ebayUserId || '', username: account.ebayUsername || '', refreshToken: account.ebayRefreshToken }, {
      offers: listing.ebayOffers || (listing.externalOfferId ? [{ sku: listing.marketplaceSku, offerId: listing.externalOfferId }] : []),
      inventoryItemGroupKey: listing.ebayInventoryItemGroupKey, externalListingId: listing.externalListingId,
    }, listing.marketplaceSku, action === 'delete');
    return { ...result, listingStatus: result.success ? result.listingStatus! : 'error', ...(result.listingId ? { externalListingId: result.listingId, externalUrl: `https://www.ebay.com/itm/${result.listingId}` } : {}) };
  }
  if (!surface.enabledPlatforms?.includes(platform)) throw new Error('Enable this marketplace on the surface before publishing.');
  const price = marketplaceSalePrice(surface as any, platform);
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error('Set a positive retail price before publishing.');
  if (!surface.title?.trim() || !surface.description?.trim() || !surface.images?.length) throw new Error('Title, description and product images are required before publishing.');
  const sku: string = surface.sku;
  const quantity = platform === 'ebay' ? surface.ebay?.quantity ?? 100 : 100;
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantity must be a non-negative whole number.');
  const common = { title: surface.title, description: surface.description, price, currencyCode: surface.currency || 'USD', quantity,
    imageUrls: surface.images.map((image: any) => typeof image === 'string' ? image : image?.url).filter(Boolean) };
  if (platform === 'amazon') {
    if (listing.amazonRemovalRequested && listing.remoteStatus !== 'Removed') throw new Error('Check Amazon status until removal is confirmed before publishing again.');
    const result = await pushListingToAmazon(amazonCredentials(account), amazonProductFromSurface(surface), sku,
      listing.publishOptions?.amazon, variants, persist.amazonItems, listing.remoteStatus === 'Removed' ? [] : listing.amazonItems || []);
    return { ...result, ...(result.success ? { externalListingId: sku } : {}) };
  }

  if (platform === 'ebay') {
    if (variants.length > 250) throw new Error('eBay supports at most 250 variations per listing. Reduce the selected variants.');
    const eb = surface.ebay || {};
    const seller = listing.publishOptions?.ebay || {};
    if (!eb.categoryId) throw new Error('Set the eBay category ID on the surface before publishing.');
    const raw = typeof eb.itemSpecifics === 'string' ? JSON.parse(eb.itemSpecifics) : eb.itemSpecifics || {};
    const aspects = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value.map(String) : [String(value)]]));
    const result = await pushListingToEbay({ userId: account.ebayUserId || '', username: account.ebayUsername || '', refreshToken: account.ebayRefreshToken }, {
      ...common, condition: eb.conditionId === '1000' ? 'NEW' : eb.conditionId || 'NEW', brand: eb.brand || surface.brand || 'QR Gear',
      categoryId: String(eb.categoryId), listingFormat: eb.listingFormat || 'FIXED_PRICE',
      fulfillmentPolicyId: seller.fulfillmentPolicyId, paymentPolicyId: seller.paymentPolicyId,
      returnPolicyId: seller.returnPolicyId, merchantLocationKey: seller.merchantLocationKey,
      upc: eb.upc || undefined, ean: eb.ean || undefined, mpn: eb.mpn || undefined, aspects,
      bestOfferEnabled: eb.bestOfferEnabled === true, subtitle: eb.subtitle || undefined,
      variants: variants.map(variant => ({ ...variant, size: seller.variationValues?.Size?.[variant.size] || variant.size, color: seller.variationValues?.Color?.[variant.color] || variant.color })), packageWeightLbs: eb.packageWeightLbs, packageDimensionsInches: eb.packageDimensionsInches,
    }, sku, persist.ebayOffer, { offers: listing.ebayOffers || (listing.externalOfferId ? [{ sku, offerId: listing.externalOfferId }] : []), inventoryItemGroupKey: listing.ebayInventoryItemGroupKey, externalListingId: listing.externalListingId }, persist.ebayPrepared);
    return { ...result, listingStatus: result.success ? result.listingStatus || 'pending' : 'error', ...(result.listingId ? { externalListingId: result.listingId, externalUrl: `https://www.ebay.com/itm/${result.listingId}` } : {}) };
  }
  const settings = validateEtsySettings(listing.publishOptions);
  const result = await pushListingToEtsy(etsyCredentials(account), {
    ...common, ...settings, tags: surface.tags || [], sku, variants,
  }, {
    existingListingId: listing.externalListingId ? Number(listing.externalListingId) : undefined,
    onRefreshToken: persist.etsyToken, onBeforeCreate: persist.etsyCreateAttempt,
    onListingCreated: id => persist.externalListing(String(id)),
  });
  return { ...result, sku, listingStatus: result.success ? (result.state === 'active' ? 'active' : 'delisted') : 'error',
    ...(result.listingId ? { externalListingId: String(result.listingId), externalUrl: result.url } : {}) };
}
