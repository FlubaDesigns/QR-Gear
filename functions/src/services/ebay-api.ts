/**
 * eBay Sell API service
 * Handles OAuth 2.0 token exchange and Inventory API listing operations.
 *
 * Requires environment variables (set in Firebase config or process.env):
 *   EBAY_APP_ID      — Application ID (Client ID) from eBay developer portal
 *   EBAY_CERT_ID     — Cert ID (Client Secret) from eBay developer portal
 *   EBAY_RUNAME      — eBay RuName (registered redirect URI name, not the URL itself)
 *   EBAY_REDIRECT_URI — Actual callback URL registered under the RuName
 *                       (https://qrgear.com/api/marketplace/ebay/oauth/callback)
 */

import { createHash } from 'crypto';
import type { EbaySetupOptions } from '../../../shared/surfaces';
import type { MarketplaceVariant } from './marketplace-variants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EbayCredentials {
  userId: string;
  username: string;
  refreshToken: string;
}

export interface EbayTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

export interface EbayListingProduct {
  title: string;
  description: string;
  price: number;
  currencyCode: string;
  quantity: number;
  condition: string; // 'NEW', 'LIKE_NEW', 'GOOD', etc.
  brand: string;
  imageUrls: string[];
  categoryId: string;
  listingFormat: 'FIXED_PRICE' | 'AUCTION';
  // Policies
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
  // Identifiers
  upc?: string;
  ean?: string;
  mpn?: string;
  // Optional aspects (item specifics)
  aspects?: Record<string, string[]>;
  bestOfferEnabled?: boolean;
  subtitle?: string;
  variants?: MarketplaceVariant[];
  packageWeightLbs?: number;
  packageDimensionsInches?: { length: number; width: number; height: number };
}

export interface EbayPushResult {
  success: boolean;
  sku: string;
  listingId?: string;
  offerId?: string;
  status?: string;
  error?: string;
  warnings?: string[];
  listingStatus?: 'active' | 'draft' | 'pending' | 'delisted';
  offers?: Array<{ sku: string; offerId: string }>;
  inventoryItemGroupKey?: string;
  remoteStatus?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_API_BASE = 'https://api.ebay.com';
const EBAY_MARKETPLACE_ID = 'EBAY_US';

const EBAY_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
  'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
].join(' ');

// ─── OAuth URL Builder ────────────────────────────────────────────────────────

/**
 * Build the eBay authorization URL.
 * The admin opens this URL to grant QR Gear's app access to their eBay seller account.
 * `state` is a random, expiring browser-bound nonce from the shared OAuth service.
 */
export function buildOAuthUrl(state: string): string {
  const appId = process.env.EBAY_APP_ID;
  const ruName = process.env.EBAY_RUNAME;

  if (!appId || !ruName) {
    throw new Error('eBay app credentials not configured. Set EBAY_APP_ID and EBAY_RUNAME.');
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: ruName,
    response_type: 'code',
    scope: EBAY_SCOPES,
    state,
  });

  return `https://auth.ebay.com/oauth2/authorize?${params.toString()}`;
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for access + refresh tokens.
 * Used in the OAuth callback after the seller authorizes the app.
 */
export async function exchangeAuthCodeForTokens(code: string): Promise<EbayTokenResponse> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  const ruName = process.env.EBAY_RUNAME;

  if (!appId || !certId || !ruName) {
    throw new Error('eBay app credentials not configured. Set EBAY_APP_ID, EBAY_CERT_ID, and EBAY_RUNAME.');
  }

  const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: ruName,
  });

  const resp = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`eBay token exchange failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<EbayTokenResponse>;
}

/**
 * Get a short-lived access token from a stored refresh token.
 * eBay user access tokens expire after 2 hours; call this fresh before each API request.
 */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (!appId || !certId) {
    throw new Error('eBay app credentials not configured. Set EBAY_APP_ID and EBAY_CERT_ID.');
  }

  const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: EBAY_SCOPES,
  });

  const resp = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`eBay token refresh failed (${resp.status}): ${text}`);
  }

  const data = await resp.json() as EbayTokenResponse;
  return data.access_token;
}

// ─── User Info ────────────────────────────────────────────────────────────────

/**
 * Fetch the eBay user's username and userId after OAuth completes.
 */
export async function getEbayUserInfo(accessToken: string): Promise<{ userId: string; username: string }> {
  const resp = await fetch(`${EBAY_API_BASE}/commerce/identity/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Could not retrieve eBay user info (${resp.status}): ${text}`);
  }

  const data = await resp.json() as any;
  const userId: string = data?.userId || '';
  const username: string = data?.username || '';

  if (!userId && !username) {
    throw new Error('eBay user info response missing userId and username.');
  }

  return { userId, username };
}

// One transport owns authenticated eBay calls; no automatic mutation retries.
async function ebayRequest(token: string, path: string, method = 'GET', body?: unknown): Promise<any> {
  const response = await fetch(`${EBAY_API_BASE}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Language': 'en-US', 'Accept-Language': 'en-US' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000),
  });
  const text = await response.text();
  let data: any = {};
  if (text) { try { data = JSON.parse(text); } catch { throw new Error(`eBay returned an unreadable response (${response.status}).`); } }
  if (!response.ok) throw Object.assign(new Error(data.errors?.map((error: any) => error.longMessage || error.message).join(' • ') || `eBay request failed (${response.status}).`), { status: response.status, ebayErrors: data.errors });
  return data;
}

async function taxonomyToken(): Promise<string> {
  const id = process.env.EBAY_APP_ID, secret = process.env.EBAY_CERT_ID;
  if (!id || !secret) throw new Error('eBay app credentials are not configured.');
  const response = await fetch(EBAY_TOKEN_URL, { method: 'POST', headers: {
    Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded',
  }, body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }).toString(), signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`eBay category authorization failed (${response.status}).`);
  const data = await response.json() as any;
  if (!data.access_token) throw new Error('eBay category authorization returned no access token.');
  return data.access_token;
}

async function categoryOptions(categoryId: string, query: string) {
  const token = await taxonomyToken();
  const tree = await ebayRequest(token, '/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US');
  if (!tree.categoryTreeId) throw new Error('eBay did not return its category tree.');
  const root = `/commerce/taxonomy/v1/category_tree/${encodeURIComponent(tree.categoryTreeId)}`;
  const [suggestions, requirements]: any[] = await Promise.all([
    query ? ebayRequest(token, `${root}/get_category_suggestions?q=${encodeURIComponent(query)}`) : {},
    categoryId ? ebayRequest(token, `${root}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`) : {},
  ]);
  return {
    categories: (suggestions.categorySuggestions || []).map((row: any) => ({ categoryId: String(row.category.categoryId), categoryName: row.category.categoryName })),
    aspects: (requirements.aspects || []).map((row: any) => ({ name: row.localizedAspectName, required: row.aspectConstraint?.aspectRequired === true,
      variation: row.aspectConstraint?.aspectEnabledForVariations === true, mode: row.aspectConstraint?.aspectMode || '', values: (row.aspectValues || []).map((value: any) => value.localizedValue) })),
  };
}

export async function getEbaySetupOptions(credentials: EbayCredentials, categoryId = '', query = ''): Promise<EbaySetupOptions> {
  const token = await getAccessToken(credentials.refreshToken);
  const policies = await Promise.all(['fulfillment', 'payment', 'return'].map(type => ebayRequest(token, `/sell/account/v1/${type}_policy?marketplace_id=EBAY_US`)));
  const locations: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await ebayRequest(token, `/sell/inventory/v1/location?limit=100&offset=${offset}`);
    if (!Array.isArray(page.locations)) throw new Error('eBay returned invalid inventory locations.');
    locations.push(...page.locations.filter((row: any) => row.merchantLocationStatus === 'ENABLED').map((row: any) => ({ merchantLocationKey: row.merchantLocationKey, name: row.name || row.merchantLocationKey })));
    if (!page.next) break;
    if (!page.locations.length) throw new Error('eBay location pagination returned an empty page.');
  }
  return { fulfillmentPolicies: policies[0].fulfillmentPolicies || [], paymentPolicies: policies[1].paymentPolicies || [], returnPolicies: policies[2].returnPolicies || [], locations, ...await categoryOptions(categoryId, query) };
}

/** Seller-requested location creation; stable key makes an uncertain response safe to retry. */
export async function createEbayInventoryLocation(credentials: EbayCredentials, accountId: string, input: { name: string; postalCode: string; country: string }) {
  const name = input.name?.trim(), postalCode = input.postalCode?.trim(), country = input.country?.trim().toUpperCase();
  if (!name || name.length > 100 || !postalCode || postalCode.length > 20 || !/^[A-Z]{2}$/.test(country || '')) throw new Error('Enter a location name, postal code and two-letter country code.');
  const key = `qrgear-${createHash('sha256').update(JSON.stringify([accountId, name, postalCode, country])).digest('hex').slice(0, 24)}`;
  const token = await getAccessToken(credentials.refreshToken), path = `/sell/inventory/v1/location/${key}`;
  let existing: any;
  try { existing = await ebayRequest(token, path); }
  catch (error: any) { if (error.status !== 404) throw error; }
  if (!existing) {
    await ebayRequest(token, path, 'POST', { name, merchantLocationStatus: 'ENABLED', locationTypes: ['WAREHOUSE'], location: { address: { postalCode, country } } });
    existing = await ebayRequest(token, path);
  }
  if (existing.merchantLocationStatus !== 'ENABLED' || existing.location?.address?.postalCode !== postalCode || existing.location?.address?.country !== country) throw new Error('eBay location details could not be verified. Reload locations before trying again.');
  return { merchantLocationKey: key };
}

export function ebayProductErrors(product: EbayListingProduct): string[] {
  const errors: string[] = [];
  if (!product.categoryId) errors.push('Choose an eBay category.');
  if (!product.fulfillmentPolicyId || !product.paymentPolicyId || !product.returnPolicyId || !product.merchantLocationKey) errors.push('Choose shipping, payment, return policies and an inventory location for this seller.');
  if (product.listingFormat !== 'FIXED_PRICE') errors.push('This eBay Inventory connection supports fixed-price listings.');
  if (!product.title?.trim() || product.title.length > 80) errors.push('eBay titles must contain 1–80 characters.');
  if (!product.description?.trim()) errors.push('A description is required.');
  if (!product.imageUrls.length || product.imageUrls.some(url => !url.startsWith('https://'))) errors.push('At least one HTTPS product image is required.');
  if (!Number.isFinite(product.price) || product.price <= 0) errors.push('Set a positive item price.');
  if (!Number.isInteger(product.quantity) || product.quantity < 0) errors.push('Set a non-negative whole-number quantity per variant.');
  if (product.currencyCode !== 'USD') errors.push('The eBay US connection requires USD prices.');
  return errors;
}

/** Provider requirements are checked before any inventory or offer writes. */
async function validateEbayRequirements(token: string, product: EbayListingProduct) {
  const errors = ebayProductErrors(product);
  if (errors.length) throw new Error(errors.join(' '));
  await Promise.all([
    ...[['fulfillment', product.fulfillmentPolicyId], ['payment', product.paymentPolicyId], ['return', product.returnPolicyId]].map(async ([type, id]) => {
      const policy = await ebayRequest(token, `/sell/account/v1/${type}_policy/${encodeURIComponent(id!)}`);
      if (policy.marketplaceId !== EBAY_MARKETPLACE_ID) throw new Error(`The ${type} policy does not belong to eBay US.`);
    }),
    (async () => { const location = await ebayRequest(token, `/sell/inventory/v1/location/${encodeURIComponent(product.merchantLocationKey!)}`);
      if (location.merchantLocationStatus !== 'ENABLED') throw new Error('The selected inventory location is not enabled.'); })(),
  ]);
  const metadata = await categoryOptions(product.categoryId, '');
  const rows: Array<Record<string, string[]>> = product.variants?.length ? product.variants.map(variant => ({ ...product.aspects, Size: [variant.size], Color: [variant.color] })) : [product.aspects || {}];
  if (new Set(rows.map(row => `${row.Size?.[0]}\0${row.Color?.[0]}`)).size !== rows.length) errors.push('eBay size/color mappings collapse different product variants. Choose distinct values.');
  const pivot = ['Size', 'Color'].filter(name => new Set(rows.map(row => row[name]?.[0])).size > 1);
  for (const aspect of metadata.aspects) {
    for (const row of rows) {
      const values = row[aspect.name] || (aspect.name === 'Brand' ? [product.brand] : []);
      if (aspect.required && (!values.length || values.some((value: string) => !value?.trim()))) errors.push(`eBay requires ${aspect.name}.`);
      if (aspect.mode === 'SELECTION_ONLY' && values.some((value: string) => !aspect.values.includes(value))) errors.push(`Choose an eBay-supported value for ${aspect.name}.`);
    }
  }
  for (const name of pivot) if (!metadata.aspects.some((aspect: any) => aspect.name === name && aspect.variation)) errors.push(`This category does not permit ${name} variations.`);
  if (errors.length) throw new Error([...new Set(errors)].join(' '));
}

async function offersForSku(token: string, sku: string): Promise<any[]> {
  try {
    const data = await ebayRequest(token, `/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=EBAY_US&format=FIXED_PRICE`);
    if (!Array.isArray(data.offers)) throw new Error('eBay returned an invalid offer list.');
    const offers = data.offers.filter((offer: any) => offer.sku === sku && offer.marketplaceId === EBAY_MARKETPLACE_ID && offer.format === 'FIXED_PRICE');
    if (offers.length !== data.offers.length || offers.length > 1 || data.next) throw new Error('Ambiguous eBay offers; reconcile this SKU before publishing.');
    return offers;
  } catch (error: any) {
    if (error.status === 404 && error.ebayErrors?.some((entry: any) => entry.errorId === 25713)) return [];
    throw new Error(`Existing offer lookup failed: ${error.message}`);
  }
}

function offerState(offers: any[]): { listingStatus: 'active' | 'draft' | 'pending' | 'delisted'; listingId?: string; remoteStatus: string } {
  if (!offers.length) return { listingStatus: 'draft', remoteStatus: 'NO_OFFER' };
  const ids = [...new Set(offers.map(offer => offer.listing?.listingId).filter(Boolean))] as string[];
  if (ids.length > 1) throw new Error('eBay returned multiple listings for this item.');
  const active = offers.every(offer => offer.status === 'PUBLISHED' && offer.listing?.listingStatus === 'ACTIVE');
  const ended = offers.every(offer => offer.status === 'UNPUBLISHED' || offer.listing?.listingStatus === 'ENDED');
  return { listingStatus: active && ids.length === 1 ? 'active' : ended ? (ids.length ? 'delisted' : 'draft') : 'pending',
    ...(ids[0] ? { listingId: ids[0] } : {}), remoteStatus: [...new Set(offers.map(offer => `${offer.status}/${offer.listing?.listingStatus || 'UNKNOWN'}`))].join(', ') };
}

export interface EbayListingIdentity {
  offers?: Array<{ sku: string; offerId: string }>;
  inventoryItemGroupKey?: string;
  externalListingId?: string;
}

async function readOffers(token: string, identity: EbayListingIdentity, sku: string) {
  if (!identity.offers?.length) return offersForSku(token, sku);
  return Promise.all(identity.offers.map(async row => {
    const offer = await ebayRequest(token, `/sell/inventory/v1/offer/${encodeURIComponent(row.offerId)}`);
    if (offer.sku !== row.sku || offer.marketplaceId !== EBAY_MARKETPLACE_ID || offer.format !== 'FIXED_PRICE') throw new Error('eBay offer identity does not match this listing.');
    return offer;
  }));
}

export async function checkEbayListing(credentials: EbayCredentials, identity: EbayListingIdentity, sku: string, end = false): Promise<EbayPushResult> {
  try {
    const token = await getAccessToken(credentials.refreshToken);
    let offers = await readOffers(token, identity, sku);
    if (!offers.length && identity.externalListingId) throw new Error('The saved external listing could not be resolved. No remote status was assumed.');
    if (end && offers.some(offer => offer.status === 'PUBLISHED')) {
      if (identity.inventoryItemGroupKey) await ebayRequest(token, '/sell/inventory/v1/offer/withdraw_by_inventory_item_group', 'POST', { inventoryItemGroupKey: identity.inventoryItemGroupKey, marketplaceId: EBAY_MARKETPLACE_ID });
      else {
        if (offers.length !== 1) throw new Error('A variation group is required to end multiple offers.');
        await ebayRequest(token, `/sell/inventory/v1/offer/${encodeURIComponent(offers[0].offerId)}/withdraw`, 'POST', {});
      }
      offers = await readOffers(token, { ...identity, offers: offers.map(offer => ({ sku: offer.sku, offerId: offer.offerId })) }, sku);
    }
    const state = offerState(offers);
    if (end && (state.listingStatus === 'active' || state.listingStatus === 'pending')) throw new Error('eBay has not confirmed that this listing ended. Refresh its status before retrying.');
    return { success: true, sku, ...state, ...(end || (identity.externalListingId && state.listingStatus === 'draft') ? { listingStatus: 'delisted' as const } : {}), offers: offers.map(offer => ({ sku: offer.sku, offerId: offer.offerId })), inventoryItemGroupKey: identity.inventoryItemGroupKey };
  } catch (error: any) { return { success: false, sku, error: error.message }; }
}

/** Reuses saved offers; creates a group from real canonical combinations and verifies the result. */
export async function pushListingToEbay(
  credentials: EbayCredentials, product: EbayListingProduct, sku: string,
  onOfferReady?: (offerId: string, identity?: EbayListingIdentity) => Promise<void>,
  identity: EbayListingIdentity = {},
  onPrepared?: () => Promise<void>,
): Promise<EbayPushResult> {
  const saved: Array<{ sku: string; offerId: string }> = [...(identity.offers || [])];
  try {
    const token = await getAccessToken(credentials.refreshToken);
    await validateEbayRequirements(token, product);
    const variants = product.variants || [];
    const rows: Array<{ sku: string; product: EbayListingProduct }> = variants.length ? variants.map(variant => ({ sku: variant.sku, product: { ...product, aspects: { ...product.aspects, Size: [variant.size], Color: [variant.color] } } })) : [{ sku, product }];
    const groupKey = rows.length > 1 || identity.inventoryItemGroupKey ? identity.inventoryItemGroupKey || sku : undefined;
    if (identity.offers?.some(offer => !rows.some(row => row.sku === offer.sku))) {
      const previous = await readOffers(token, identity, sku);
      if (previous.some(offer => offer.status !== 'UNPUBLISHED' && offer.listing?.listingStatus !== 'ENDED')) throw new Error('The saved variant set changed. End the existing listing before changing its marketplace variants.');
      // Previous offers stay unpublished and recorded in job history. Reuse surviving SKUs.
      saved.splice(0, saved.length, ...saved.filter(offer => rows.some(row => row.sku === offer.sku)));
    }
    // Resolve every existing offer before any writes, preventing duplicates after an uncertain outcome.
    const existing = await Promise.all(rows.map(async row => (await offersForSku(token, row.sku))[0]));
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      await ebayRequest(token, `/sell/inventory/v1/inventory_item/${encodeURIComponent(row.sku)}`, 'PUT', buildInventoryItemPayload(row.product));
      const offer = existing[index];
      const payload = buildOfferPayload(row.product, row.sku);
      const result = await ebayRequest(token, `/sell/inventory/v1/offer${offer ? `/${encodeURIComponent(offer.offerId)}` : ''}`, offer ? 'PUT' : 'POST', payload);
      const offerId = offer?.offerId || result.offerId;
      if (!offerId) throw new Error('eBay did not return an offer ID. Check its status before retrying.');
      const savedIndex = saved.findIndex(entry => entry.sku === row.sku);
      if (savedIndex >= 0) saved[savedIndex] = { sku: row.sku, offerId };
      else saved.push({ sku: row.sku, offerId });
      // Durable identity before publishing; fee retrieval is separate from persistence.
      if (onOfferReady) await onOfferReady(offerId, { offers: [...saved], inventoryItemGroupKey: groupKey });
    }
    if (groupKey) {
      const specifications = ['Size', 'Color'].map(name => ({ name, values: [...new Set(rows.flatMap(row => row.product.aspects?.[name] || []))] })).filter(spec => spec.values.length > 1 || (rows.length === 1 && spec.values.length === 1));
      if (!specifications.length) throw new Error('A variation group needs at least one varying size or color.');
      const aspects: Record<string, string[]> = { Brand: [product.brand], ...product.aspects };
      for (const spec of specifications) delete aspects[spec.name];
      for (const name of ['Size', 'Color']) if (!specifications.some(spec => spec.name === name)) aspects[name] = rows[0].product.aspects?.[name] || [];
      await ebayRequest(token, `/sell/inventory/v1/inventory_item_group/${encodeURIComponent(groupKey)}`, 'PUT', { title: product.title, description: product.description, imageUrls: product.imageUrls, aspects, variantSKUs: rows.map(row => row.sku), variesBy: { specifications } });
    }
    const allAlreadyPublished = existing.every(offer => offer?.status === 'PUBLISHED');
    if (!allAlreadyPublished) {
      if (onPrepared) await onPrepared();
      const result = groupKey
        ? await ebayRequest(token, '/sell/inventory/v1/offer/publish_by_inventory_item_group', 'POST', { inventoryItemGroupKey: groupKey, marketplaceId: EBAY_MARKETPLACE_ID })
        : await ebayRequest(token, `/sell/inventory/v1/offer/${encodeURIComponent(saved[0].offerId)}/publish`, 'POST', {});
      if (!result.listingId) throw new Error('eBay returned no listing ID. Check its status before retrying.');
    }
    return await checkEbayListing(credentials, { offers: saved, inventoryItemGroupKey: groupKey }, sku);
  } catch (error: any) { return { success: false, sku, offers: saved, error: error.message }; }
}

function buildInventoryItemPayload(product: EbayListingProduct): Record<string, any> {
  const productData: Record<string, any> = { title: product.title, description: product.description,
    aspects: { Brand: [product.brand], ...product.aspects }, imageUrls: product.imageUrls };
  if (product.subtitle) productData.subtitle = product.subtitle;
  if (product.upc) productData.upc = [product.upc];
  if (product.ean) productData.ean = [product.ean];
  if (product.mpn) productData.mpn = product.mpn;
  return { availability: { shipToLocationAvailability: { quantity: product.quantity } }, condition: mapConditionToEbay(product.condition), product: productData,
    ...(product.packageWeightLbs || product.packageDimensionsInches ? { packageWeightAndSize: {
      ...(product.packageWeightLbs ? { weight: { value: product.packageWeightLbs, unit: 'POUND' } } : {}),
      ...(product.packageDimensionsInches ? { dimensions: { ...product.packageDimensionsInches, unit: 'INCH' } } : {}),
    } } : {}),
  };
}

function buildOfferPayload(product: EbayListingProduct, sku: string): Record<string, any> {
  return { sku, marketplaceId: EBAY_MARKETPLACE_ID, format: 'FIXED_PRICE', listingDuration: 'GTC', availableQuantity: product.quantity,
    categoryId: product.categoryId, listingDescription: product.description, merchantLocationKey: product.merchantLocationKey,
    listingPolicies: { fulfillmentPolicyId: product.fulfillmentPolicyId, paymentPolicyId: product.paymentPolicyId, returnPolicyId: product.returnPolicyId,
      bestOfferTerms: { bestOfferEnabled: product.bestOfferEnabled === true } },
    pricingSummary: { price: { currency: product.currencyCode, value: product.price.toFixed(2) } },
  };
}

function mapConditionToEbay(condition: string): string {
  const map: Record<string, string> = { '1000': 'NEW', new: 'NEW', new_new: 'NEW', NEW: 'NEW', '1500': 'NEW_OTHER', '1750': 'NEW_WITH_DEFECTS', '3000': 'USED_EXCELLENT', '4000': 'USED_VERY_GOOD', '5000': 'USED_GOOD', '6000': 'USED_ACCEPTABLE', '2000': 'CERTIFIED_REFURBISHED', '2500': 'SELLER_REFURBISHED', used_good: 'USED_GOOD', used_like_new: 'LIKE_NEW', GOOD: 'USED_GOOD', LIKE_NEW: 'LIKE_NEW', ACCEPTABLE: 'USED_ACCEPTABLE' };
  if (!map[condition]) throw new Error('Choose a supported eBay item condition.');
  return map[condition];
}
