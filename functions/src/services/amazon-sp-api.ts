import { amazonManagedAttribute } from '../../../shared/surfaces';
import { createHash } from 'crypto';
import type { AmazonSellerSettings, AmazonListingItem } from '../../../shared/surfaces';
import type { MarketplaceVariant } from './marketplace-variants';
/**
 * Amazon SP-API service
 * Handles LWA token exchange and SP-API listing operations.
 *
 * Requires environment variables (set in Firebase config or process.env):
 *   AMAZON_SP_CLIENT_ID      — LWA Client ID for the QR Gear developer app
 *   AMAZON_SP_CLIENT_SECRET  — LWA Client Secret for the QR Gear developer app
 *   AMAZON_SP_APP_ID         — Seller Central App ID (amzn1.sellerapps.app.XXX)
 *   AMAZON_SP_REDIRECT_URI   — OAuth callback URI (https://qrgear.com/api/marketplace/amazon/oauth/callback)
 */

// Node 20 has native fetch — no import needed.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmazonCredentials {
  sellerId: string;
  marketplaceId: string;   // e.g. ATVPDKIKX0DER for US
  refreshToken: string;
}

export interface AmazonTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface AmazonListingProduct {
  title: string;
  description: string;
  bulletPoints: string[];
  keywords: string[];
  price: number;
  currencyCode: string;
  quantity: number;
  condition: 'new_new' | 'used_good' | 'used_like_new';
  brandName: string;
  imageUrls: string[];
  productType?: string;
}

export interface AmazonPushResult {
  success: boolean;
  sku: string;
  asin?: string;
  submissionId?: string;
  status?: string;
  issues?: AmazonIssue[];
  error?: string;
}

interface AmazonIssue {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  attributeName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const SP_API_BASE_NA = 'https://sellingpartnerapi-na.amazon.com';

// ─── LWA Token Exchange ───────────────────────────────────────────────────────

/**
 * Exchange an authorization code for access + refresh tokens.
 * Used in the OAuth callback after the seller authorizes the app.
 */
export async function exchangeAuthCodeForTokens(code: string): Promise<AmazonTokenResponse> {
  const clientId = process.env.AMAZON_SP_CLIENT_ID;
  const clientSecret = process.env.AMAZON_SP_CLIENT_SECRET;
  const redirectUri = process.env.AMAZON_SP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Amazon SP-API app credentials not configured. Set AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET, and AMAZON_SP_REDIRECT_URI.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const resp = await fetch(LWA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(), signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) {
    throw new Error(`Amazon authorization exchange failed (HTTP ${resp.status}). Reconnect this seller.`);
  }

  return resp.json() as Promise<AmazonTokenResponse>;
}

/**
 * Get a short-lived access token from a stored refresh token.
 * Access tokens expire after 1 hour; call this fresh before each SP-API request.
 */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.AMAZON_SP_CLIENT_ID;
  const clientSecret = process.env.AMAZON_SP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Amazon SP-API app credentials not configured. Set AMAZON_SP_CLIENT_ID and AMAZON_SP_CLIENT_SECRET.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(LWA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(), signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) {
    throw new Error(`Amazon token refresh failed (HTTP ${resp.status}). Reconnect this seller.`);
  }

  const data = await resp.json() as AmazonTokenResponse;
  if (!data.access_token) throw new Error('Amazon did not return an access token. Reconnect this seller.');
  return data.access_token;
}

// ─── OAuth URL Builder ────────────────────────────────────────────────────────

/**
 * Build the Seller Central authorization URL.
 * The admin opens this URL to authorize QR Gear's SP-API app on their account.
 * `state` is the one-use browser-bound nonce owned by marketplace-oauth.
 */
export function buildOAuthUrl(state: string): string {
  const appId = process.env.AMAZON_SP_APP_ID;
  const redirectUri = process.env.AMAZON_SP_REDIRECT_URI;

  if (!appId || !redirectUri) {
    throw new Error('Amazon SP-API app not configured. Set AMAZON_SP_APP_ID and AMAZON_SP_REDIRECT_URI.');
  }

  const params = new URLSearchParams({
    application_id: appId,
    state,
    redirect_uri: redirectUri,
    version: 'beta',
  });

  return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
}

/** Verify the granted seller token against active marketplace participation. Seller ID comes from Amazon's OAuth callback. */
export async function getSellerMarketplaceIds(accessToken: string): Promise<string[]> {
  const resp = await fetch(`${SP_API_BASE_NA}/sellers/v1/marketplaceParticipations`, {
    headers: { 'x-amz-access-token': accessToken, 'User-Agent': 'QRGear/1.0 (Language=TypeScript)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`Amazon seller verification failed (${resp.status}).`);
  const data: any = await resp.json();
  const ids = (data?.payload || []).filter((p: any) => p.participation?.isParticipating === true && p.participation?.hasSuspendedListings !== true).map((p: any) => p.marketplace?.id).filter(Boolean);
  if (!ids.length) throw new Error('No active Amazon marketplaces found.');
  return ids;
}

// Product Type Definitions and Listings Items are the single Amazon publishing path.
// Amazon validates conditional schema requirements in VALIDATION_PREVIEW before any writes.
export const AMAZON_US = 'ATVPDKIKX0DER';
export function amazonCredentials(account: Record<string, any>): AmazonCredentials {
  if (!account.amazonSellerId || !account.amazonRefreshToken || account.amazonMarketplaceId !== AMAZON_US)
    throw new Error('Connect an Amazon US seller account before using Amazon Setup.');
  return { sellerId: account.amazonSellerId, refreshToken: account.amazonRefreshToken, marketplaceId: account.amazonMarketplaceId };
}
function requireUS(credentials: AmazonCredentials) {
  if (!credentials.sellerId || !credentials.refreshToken || credentials.marketplaceId !== AMAZON_US) throw new Error('This connection currently supports Amazon US.');
}
async function amazonRequest(token: string, path: string, method = 'GET', body?: unknown, missingOK = false, attempt = 0): Promise<any> {
  const response = await fetch(`${SP_API_BASE_NA}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'x-amz-access-token': token, 'User-Agent': 'QRGear/1.0 (Language=TypeScript)' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
  });
  if (response.status === 429 && attempt < 2) {
    const seconds = Math.min(5, Math.max(1, Number(response.headers.get('Retry-After')) || attempt + 1));
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return amazonRequest(token, path, method, body, missingOK, attempt + 1);
  }
  if (missingOK && response.status === 404) return null;
  if (!response.ok) throw new Error(`Amazon request failed (HTTP ${response.status}). ${response.status === 429 ? 'Amazon is limiting requests; retry shortly.' : 'Check seller authorization and retry.'}`);
  return response.json();
}
function itemPath(credentials: AmazonCredentials, sku: string) {
  return `/listings/2021-08-01/items/${encodeURIComponent(credentials.sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${credentials.marketplaceId}&issueLocale=en_US`;
}
export interface AmazonSetupOptions {
  productTypes: Array<{ name: string; displayName: string }>;
  schema?: Record<string, any>;
  parentSchema?: Record<string, any>;
}
async function definition(token: string, credentials: AmazonCredentials, productType: string, parentageLevel: string) {
  if (!/^[A-Z][A-Z0-9_]{0,99}$/.test(productType)) throw new Error('Choose an Amazon product type.');
  const params = new URLSearchParams({ marketplaceIds: credentials.marketplaceId, sellerId: credentials.sellerId, requirements: 'LISTING', requirementsEnforced: 'ENFORCED', productTypeVersion: 'LATEST', locale: 'en_US', parentageLevel });
  const result = await amazonRequest(token, `/definitions/2020-09-01/productTypes/${encodeURIComponent(productType)}?${params}`);
  // Only use the URL returned by Amazon; never accept schema locations from clients.
  const url = new URL(result.schema?.link?.resource);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.endsWith('.amazonaws.com')) throw new Error('Amazon returned an unsupported schema location.');
  const response = await fetch(url.toString(), { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Could not load Amazon product requirements. Retry.');
  const raw = await response.text();
  if (raw.length > 4000000 || createHash('md5').update(raw).digest('base64') !== result.schema.checksum) throw new Error('Amazon schema integrity check failed. Reload requirements.');
  const schema = JSON.parse(raw);
  if (!schema.properties || typeof schema.properties !== 'object') throw new Error('Amazon did not return product attributes.');
  return schema;
}
export async function getAmazonSetupOptions(credentials: AmazonCredentials, productType = '', query = '', hasVariants = false): Promise<AmazonSetupOptions> {
  requireUS(credentials);
  const token = await getAccessToken(credentials.refreshToken);
  const options: AmazonSetupOptions = { productTypes: [] };
  if (query.trim()) {
    const params = new URLSearchParams({ marketplaceIds: credentials.marketplaceId, keywords: query.slice(0, 100), locale: 'en_US', searchLocale: 'en_US' });
    const result = await amazonRequest(token, `/definitions/2020-09-01/productTypes?${params}`);
    options.productTypes = (result.productTypes || []).map((row: any) => ({ name: row.name, displayName: row.displayName || row.name }));
  }
  if (productType) {
    options.schema = await definition(token, credentials, productType, hasVariants ? 'CHILD' : 'NONE');
    if (hasVariants) options.parentSchema = await definition(token, credentials, productType, 'PARENT');
  }
  return options;
}

// These are always derived from saved product data or explicit quantity; setup cannot override them.
export function validateAmazonSettings(input: any): AmazonSellerSettings {
  if (!input || !/^[A-Z][A-Z0-9_]{0,99}$/.test(input.productType || '')) throw new Error('Choose an Amazon product type.');
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 0) throw new Error('Amazon quantity must be a non-negative whole number.');
  const object = (value: any) => value && typeof value === 'object' && !Array.isArray(value);
  if (!object(input.attributes) || (input.parentAttributes !== undefined && !object(input.parentAttributes)) || (input.variantAttributes !== undefined && !object(input.variantAttributes))) throw new Error('Invalid Amazon item details.');
  if (input.variationTheme !== undefined && (typeof input.variationTheme !== 'string' || input.variationTheme.length > 100)) throw new Error('Invalid Amazon variation theme.');
  for (const attrs of [input.attributes, input.parentAttributes || {}, ...Object.values(input.variantAttributes || {})] as any[]) {
    if (!object(attrs) || Object.keys(attrs).some(name => !/^[a-z][a-z0-9_]*$/.test(name) || amazonManagedAttribute(name))) throw new Error('Amazon item details cannot change the saved product identity, price, quantity or relationships.');
  }
  if (JSON.stringify(input).length > 200000) throw new Error('Amazon setup is too large.');
  return { productType: input.productType, quantity: input.quantity, attributes: input.attributes, parentAttributes: input.parentAttributes || {}, variantAttributes: input.variantAttributes || {}, ...(input.variationTheme ? { variationTheme: input.variationTheme } : {}) };
}
function supportedAttributes(attributes: Record<string, any>, schema: any) {
  for (const key of Object.keys(attributes)) if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) throw new Error(`Amazon no longer accepts ${key} for this product type. Update Amazon Setup.`);
  return attributes;
}
export function buildAmazonSubmissions(product: AmazonListingProduct, sku: string, settings: AmazonSellerSettings, variants: MarketplaceVariant[], options: AmazonSetupOptions) {
  if (!options.schema) throw new Error('Load Amazon product requirements first.');
  if (product.currencyCode !== 'USD') throw new Error('Amazon US requires a USD selling price.');
  const market = AMAZON_US;
  const text = (value: string) => [{ value, language_tag: 'en_US', marketplace_id: market }];
  const common: Record<string, any> = { item_name: text(product.title), product_description: text(product.description),
    main_product_image_locator: [{ media_location: product.imageUrls[0], marketplace_id: market }] };
  if (product.bulletPoints.length) common.bullet_point = product.bulletPoints.map(value => ({ value, language_tag: 'en_US', marketplace_id: market }));
  if (product.keywords.length) common.generic_keyword = text(product.keywords.join(' '));
  product.imageUrls.slice(1, 8).forEach((url, i) => { common[`other_product_image_locator_${i + 1}`] = [{ media_location: url, marketplace_id: market }]; });
  const offer = { purchasable_offer: [{ currency: 'USD', marketplace_id: market, audience: 'ALL', our_price: [{ schedule: [{ value_with_tax: product.price }] }] }],
    fulfillment_availability: [{ fulfillment_channel_code: 'DEFAULT', quantity: settings.quantity }] };
  const onlySupported = (attrs: any, schema: any) => Object.fromEntries(Object.entries(attrs).filter(([key]) => Object.prototype.hasOwnProperty.call(schema.properties, key)));
  const payload = (attributes: any) => ({ productType: settings.productType, requirements: 'LISTING', attributes });
  if (!variants.length) return [{ identity: { sku } as AmazonListingItem, payload: payload({ ...onlySupported(common, options.schema), ...supportedAttributes(settings.attributes, options.schema), ...offer }) }];
  if (!options.parentSchema) throw new Error('Amazon parent requirements are missing.');
  const themes = options.schema.properties.variation_theme?.items?.properties?.name?.enum || [];
  if (!settings.variationTheme || !themes.includes(settings.variationTheme)) throw new Error('Choose a supported Amazon variation theme.');
  for (const key of Object.keys(settings.variantAttributes || {})) if (!variants.some(v => v.variantKey === key)) throw new Error('Saved Amazon variant details no longer match the built product. Reload Amazon Setup.');
  const relationship = (parent: boolean) => ({ parentage_level: [{ value: parent ? 'parent' : 'child', marketplace_id: market }], variation_theme: [{ name: settings.variationTheme, marketplace_id: market }],
    ...(!parent ? { child_parent_sku_relationship: [{ child_relationship_type: 'variation', parent_sku: sku, marketplace_id: market }] } : {}) });
  const parent = { ...onlySupported(common, options.parentSchema), ...supportedAttributes(settings.parentAttributes || {}, options.parentSchema), ...relationship(true) };
  return [{ identity: { sku, parent: true } as AmazonListingItem, payload: payload(parent) }, ...variants.map(variant => {
    const attributes = { ...settings.attributes, ...settings.variantAttributes?.[variant.variantKey] };
    // Amazon's size structures vary by category. Explicit schema fields/mappings are required;
    // never guess apparel size systems or manufacture size/color combinations.
    return { identity: { sku: variant.sku, variantKey: variant.variantKey, size: variant.size, color: variant.color } as AmazonListingItem,
      payload: payload({ ...onlySupported(common, options.schema), ...supportedAttributes(attributes, options.schema), ...offer, ...relationship(false) }) };
  })];
}
function issueMessages(data: any): string[] {
  return (data.issues || []).filter((issue: any) => issue.severity === 'ERROR').map((issue: any) => `${issue.code}: ${issue.message}`);
}
export async function previewAmazonSubmissions(credentials: AmazonCredentials, submissions: ReturnType<typeof buildAmazonSubmissions>, token?: string) {
  const access = token || await getAccessToken(credentials.refreshToken);
  const errors: string[] = [];
  for (const row of submissions) {
    const data = await amazonRequest(access, `${itemPath(credentials, row.identity.sku)}&mode=VALIDATION_PREVIEW`, 'PUT', row.payload);
    const messages = issueMessages(data);
    if (data.status !== 'VALID' || messages.length) errors.push(`${row.identity.sku}: ${messages.join('; ') || 'Amazon did not confirm a valid submission.'}`);
  }
  return errors;
}
export async function pushListingToAmazon(credentials: AmazonCredentials, product: AmazonListingProduct, sku: string,
  settingsInput?: AmazonSellerSettings, variants: MarketplaceVariant[] = [],
  persist?: (items: AmazonListingItem[]) => Promise<void>, existing: AmazonListingItem[] = [],
): Promise<AmazonPushResult & { listingStatus: 'pending' | 'error'; amazonItems?: AmazonListingItem[] }> {
  try {
    requireUS(credentials);
    if (!persist) throw new Error('Amazon publishing requires durable listing tracking.');
    const settings = validateAmazonSettings(settingsInput);
    const options = await getAmazonSetupOptions(credentials, settings.productType, '', variants.length > 0);
    const submissions = buildAmazonSubmissions(product, sku, settings, variants, options);
    // A changed selection must not abandon still-selling child SKUs.
    if (existing.some(item => !submissions.some(row => row.identity.sku === item.sku))) throw new Error('Remove the previous Amazon listing before publishing a different variation selection.');
    const token = await getAccessToken(credentials.refreshToken);
    const errors = await previewAmazonSubmissions(credentials, submissions, token);
    if (errors.length) throw new Error(errors.join('\n'));
    const identities = submissions.map(row => row.identity);
    // Save EVERY intended SKU before the first write. Unknown outcomes remain reconcilable.
    await persist(identities);
    for (const row of submissions) {
      const data = await amazonRequest(token, itemPath(credentials, row.identity.sku), 'PUT', row.payload);
      const messages = issueMessages(data);
      if (data.status !== 'ACCEPTED' || messages.length) throw new Error(`${row.identity.sku}: ${messages.join('; ') || 'Amazon did not accept the listing.'}`);
    }
    return { success: true, sku, status: 'ACCEPTED', listingStatus: 'pending', amazonItems: identities };
  } catch (error: any) { return { success: false, sku, listingStatus: 'error', error: error.message }; }
}
export async function checkAmazonListing(credentials: AmazonCredentials, sku: string, items: AmazonListingItem[], remove = false, removalRequested = false,
  persistRemoval?: () => Promise<void>) {
  requireUS(credentials);
  if (!items.length || items.some(item => item.sku !== sku && !new RegExp(`^${sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\d{4,7}$`).test(item.sku))) throw new Error('No verified Amazon listing identities are available.');
  const token = await getAccessToken(credentials.refreshToken);
  if (remove) {
    if (!persistRemoval) throw new Error('Amazon removal requires durable listing tracking.');
    await persistRemoval();
    // Children first; the parent is a grouping record, not an independently sellable product.
    for (const item of [...items.filter(item => !item.parent), ...items.filter(item => item.parent)]) {
      const result = await amazonRequest(token, itemPath(credentials, item.sku), 'DELETE', undefined, true);
      if (result && (result.status !== 'ACCEPTED' || issueMessages(result).length)) throw new Error(`${item.sku}: ${issueMessages(result).join('; ') || 'Amazon did not accept removal.'}`);
    }
  }
  const checked: AmazonListingItem[] = [];
  for (const item of items) {
    const result = await amazonRequest(token, `${itemPath(credentials, item.sku)}&includedData=summaries,issues`, 'GET', undefined, true);
    const summary = result?.summaries?.find((row: any) => row.marketplaceId === credentials.marketplaceId);
    checked.push({ ...item, ...(summary?.asin ? { asin: summary.asin } : {}), status: !result ? 'NOT_FOUND' : summary?.status?.includes('BUYABLE') ? 'BUYABLE' : 'PROCESSING_OR_INACTIVE', issues: result ? issueMessages(result) : [] });
  }
  const deleting = remove || removalRequested;
  const missing = checked.every(item => item.status === 'NOT_FOUND');
  const errors = checked.flatMap(item => (item.issues || []).map(issue => `${item.sku}: ${issue}`));
  const buyable = checked.filter(item => !item.parent).every(item => item.status === 'BUYABLE');
  const listingStatus = deleting ? missing ? 'delisted' : 'pending' : errors.length ? 'error' : buyable ? 'active' : 'pending';
  const asin = checked.find(item => !item.parent && item.asin)?.asin;
  return { success: !errors.length || deleting, sku, listingStatus, amazonItems: checked, externalListingId: sku,
    ...(asin && /^[A-Z0-9]{10}$/.test(asin) ? { externalUrl: `https://www.amazon.com/dp/${asin}` } : {}),
    remoteStatus: deleting ? missing ? 'Removed' : 'Removal processing — check again' : `${checked.filter(item => !item.parent && item.status === 'BUYABLE').length}/${checked.filter(item => !item.parent).length} variations buyable`,
    ...(!deleting && errors.length ? { error: errors.join('\n') } : {}) };
}

/** Both setup preview and publishing use the same saved item data. */
export function amazonProductFromSurface(surface: Record<string, any>): AmazonListingProduct {
  if (!surface.enabledPlatforms?.includes('amazon')) throw new Error('Enable Amazon in Item Setup.');
  if (!surface.title?.trim() || !surface.description?.trim() || !surface.images?.length || !Number.isFinite(surface.retailPrice) || surface.retailPrice <= 0) throw new Error('Save a title, description, images and a positive selling price in Item Setup.');
  return { title: surface.title, description: surface.description, price: surface.retailPrice, currencyCode: surface.currency || 'USD',
    quantity: 0, imageUrls: surface.images.map((image: any) => typeof image === 'string' ? image : image.url).filter(Boolean),
    bulletPoints: surface.bulletPoints || [], keywords: surface.keywords || surface.tags || [], condition: 'new_new', brandName: surface.brand || '' };
}
