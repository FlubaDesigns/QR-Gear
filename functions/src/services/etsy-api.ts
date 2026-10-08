/**
 * Etsy Sell API service
 * Handles OAuth 2.0 (PKCE) token exchange and Listings API operations.
 *
 * Requires environment variables:
 *   ETSY_KEYSTRING     — API key / Client ID from developers.etsy.com
 *   ETSY_SHARED_SECRET — Shared Secret (required in v3 API request headers)
 *   ETSY_REDIRECT_URI  — OAuth callback URL
 *                        (https://qrgear.com/api/marketplace/etsy/oauth/callback)
 */

import * as crypto from 'crypto';
import { validateEtsySettings, type EtsySellerSettings, type EtsySetupOptions } from '../../../shared/etsy';
import type { MarketplaceVariant } from './marketplace-variants';

// Node 20 native fetch — no import needed.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EtsyCredentials {
  accessToken: string;
  refreshToken: string;
  shopId: string;
  shopName: string;
  userId: string;
}

export interface EtsyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface EtsyListingProduct extends EtsySellerSettings {
  title: string; description: string; price: number; currencyCode: string;
  tags: string[]; imageUrls: string[]; sku: string; variants: MarketplaceVariant[];
}

export interface EtsyPushResult {
  success: boolean;
  sku?: string;
  listingId?: number;
  state?: string;
  url?: string;
  imagesUploaded?: number;
  error?: string;
  warnings?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ETSY_API_BASE = 'https://openapi.etsy.com';
const ETSY_AUTH_URL = 'https://www.etsy.com/oauth/connect';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

const ETSY_SCOPES = 'listings_r listings_w shops_r';

function etsyApiKey(): string {
  const key = process.env.ETSY_KEYSTRING, secret = process.env.ETSY_SHARED_SECRET;
  if (!key || !secret) throw new Error('Etsy API key and shared secret are not configured.');
  return `${key}:${secret}`;
}

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random code verifier for PKCE.
 * 43–128 characters, URL-safe base64.
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url').slice(0, 128);
}

/**
 * Derive the code challenge from a verifier using SHA-256 + base64url.
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ─── OAuth URL Builder ────────────────────────────────────────────────────────

/**
 * Build the Etsy OAuth authorization URL.
 * Uses PKCE (S256) — caller must persist codeVerifier for use in the callback.
 * `state` is the random, single-use browser-bound OAuth nonce.
 */
export function buildOAuthUrl(state: string, codeChallenge: string): string {
  const keystring = process.env.ETSY_KEYSTRING;
  const redirectUri = process.env.ETSY_REDIRECT_URI;

  if (!keystring || !redirectUri) {
    throw new Error('Etsy app credentials not configured. Set ETSY_KEYSTRING and ETSY_REDIRECT_URI.');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: keystring,
    redirect_uri: redirectUri,
    scope: ETSY_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${ETSY_AUTH_URL}?${params.toString()}`;
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

/**
 * Exchange an authorization code + PKCE verifier for access + refresh tokens.
 */
export async function exchangeAuthCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<EtsyTokenResponse> {
  const keystring = process.env.ETSY_KEYSTRING;
  const redirectUri = process.env.ETSY_REDIRECT_URI;

  if (!keystring || !redirectUri) {
    throw new Error('Etsy app credentials not configured. Set ETSY_KEYSTRING and ETSY_REDIRECT_URI.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: keystring,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  });

  const resp = await fetch(ETSY_TOKEN_URL, {
    signal: AbortSignal.timeout(30000),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Etsy token exchange failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<EtsyTokenResponse>;
}

/**
 * Get a fresh access token from a stored refresh token.
 * Etsy access tokens expire after 1 hour.
 */
export async function refreshAccessToken(refreshToken: string): Promise<EtsyTokenResponse> {
  const keystring = process.env.ETSY_KEYSTRING;

  if (!keystring) {
    throw new Error('Etsy app credentials not configured. Set ETSY_KEYSTRING.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: keystring,
    refresh_token: refreshToken,
  });

  const resp = await fetch(ETSY_TOKEN_URL, {
    signal: AbortSignal.timeout(30000),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Etsy token refresh failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<EtsyTokenResponse>;
}

// ─── Shop & User Info ─────────────────────────────────────────────────────────

/**
 * After OAuth, fetch the seller's user ID and primary shop.
 * Returns userId, shopId, and shopName.
 */
export async function getEtsyShopInfo(
  accessToken: string,
): Promise<{ userId: string; shopId: string; shopName: string }> {
  const keystring = process.env.ETSY_KEYSTRING;
  if (!keystring) throw new Error('ETSY_KEYSTRING not set.');

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'x-api-key': etsyApiKey(),
  };

  // Etsy documents the token prefix as the authenticated numeric user ID.
  const userId = accessToken.split('.')[0];
  if (!/^\d+$/.test(userId)) throw new Error('Etsy token is missing its user identity.');

  // Get shop info
  const shopResp = await fetch(`${ETSY_API_BASE}/v3/application/users/${userId}/shops`, { headers, signal: AbortSignal.timeout(30000) });
  if (!shopResp.ok) {
    const text = await shopResp.text();
    throw new Error(`Could not retrieve Etsy shop info (${shopResp.status}): ${text}`);
  }
  const shopData = await shopResp.json() as any;
  const shopId: string = String(shopData?.shop_id || '');
  const shopName: string = shopData?.shop_name || '';

  if (!shopId) throw new Error('No Etsy shop found for this account. You must have an open Etsy shop to use this integration.');

  return { userId, shopId, shopName };
}

/** One request path; never retry an ambiguous Etsy write. */
async function etsyRequest(token: string, path: string, method = 'GET', data?: any, json = false): Promise<any> {
  const form = data && !json && !(data instanceof FormData) ? new URLSearchParams(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)])) : undefined;
  const response = await fetch(`${ETSY_API_BASE}/v3/application${path}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, 'x-api-key': etsyApiKey(), ...(data instanceof FormData ? {} : data ? { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' } : {}) },
    ...(data ? { body: data instanceof FormData ? data : json ? JSON.stringify(data) : form!.toString() } : {}),
  });
  if (!response.ok) throw new Error(`Etsy ${method} failed (${response.status}): ${(await response.text()).slice(0, 500)}${response.status === 403 ? ' Reconnect Etsy to grant shop-profile access.' : ''}`);
  return response.status === 204 ? {} : response.json();
}
async function etsyToken(credentials: EtsyCredentials, persist: (token: string) => Promise<void>) {
  if (!/^\d+$/.test(credentials.shopId)) throw new Error('Reconnect Etsy to record your shop identity.');
  const tokens = await refreshAccessToken(credentials.refreshToken);
  if (!tokens.access_token || !tokens.refresh_token) throw new Error('Etsy returned incomplete credentials. Reconnect this account.');
  await persist(tokens.refresh_token);
  return tokens.access_token;
}
export function etsyCredentials(account: Record<string, any>): EtsyCredentials {
  if (account.platform !== 'etsy' || !account.isActive || !account.etsyConnected || !account.etsyRefreshToken || !account.etsyShopId) throw new Error('Connect this Etsy shop first.');
  return { accessToken: '', refreshToken: account.etsyRefreshToken, shopId: account.etsyShopId, shopName: account.etsyShopName || '', userId: account.etsyUserId || '' };
}
async function etsyRows(token: string, path: string, paginate = false): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const data = await etsyRequest(token, path + (paginate ? `?limit=100&offset=${offset}` : ''));
    if (!Array.isArray(data.results)) throw new Error('Etsy returned an incomplete setup response.');
    rows.push(...data.results);
    if (!paginate || rows.length >= data.count || data.results.length < 100) return rows;
    if (offset >= 9900) throw new Error('Etsy returned too many setup records. Narrow the shop configuration.');
  }
}
async function setupOptions(token: string, shopId: string): Promise<EtsySetupOptions> {
  const base = `/shops/${shopId}`;
  const [tree, shipping, processing, returns, partners, shop] = await Promise.all([
    etsyRows(token, '/seller-taxonomy/nodes'), etsyRows(token, `${base}/shipping-profiles`),
    etsyRows(token, `${base}/readiness-state-definitions`, true), etsyRows(token, `${base}/policies/return`),
    etsyRows(token, `${base}/production-partners`), etsyRequest(token, base),
  ]);
  const categories: EtsySetupOptions['categories'] = [];
  const walk = (nodes: any[], parents: string[] = []) => { for (const node of nodes) {
    const name = [...parents, node.name];
    if (!node.children?.length) categories.push({ id: node.id, name: name.join(' / ') });
    else walk(node.children, name);
  } };
  walk(tree);
  if (!shop.currency_code) throw new Error('Etsy shop currency is unavailable.');
  return { categories, currency: shop.currency_code,
    shippingProfiles: shipping.map(row => ({ id: row.shipping_profile_id, name: row.title })),
    processingProfiles: processing.map(row => ({ id: row.readiness_state_id, name: `${row.readiness_state.replace(/_/g, ' ')} · ${row.min_processing_time}–${row.max_processing_time} ${row.processing_time_unit || 'days'}` })),
    returnPolicies: returns.map(row => ({ id: row.return_policy_id, name: `${row.accepts_returns ? 'Returns accepted' : 'No returns'} · ${row.accepts_exchanges ? 'Exchanges accepted' : 'No exchanges'}${row.return_deadline ? ` · ${row.return_deadline} days` : ''}` })),
    productionPartners: partners.map(row => ({ id: row.production_partner_id, name: row.partner_name })),
  };
}
export async function getEtsySetupOptions(credentials: EtsyCredentials, persist: (token: string) => Promise<void>) {
  return setupOptions(await etsyToken(credentials, persist), credentials.shopId);
}
export function validateEtsyShopSettings(settings: EtsySellerSettings, options: EtsySetupOptions, currency: string) {
  if (currency !== options.currency) throw new Error(`Item currency must match Etsy shop currency (${options.currency}). No automatic conversion is applied.`);
  for (const [key, rows] of [['taxonomyId', options.categories], ['shippingProfileId', options.shippingProfiles], ['readinessStateId', options.processingProfiles]] as const) {
    if (!rows.some(row => row.id === settings[key])) throw new Error(`Selected Etsy ${key} is not available for this shop.`);
  }
  if (settings.returnPolicyId && !options.returnPolicies.some(row => row.id === settings.returnPolicyId)) throw new Error('Selected return policy is not available for this shop.');
  if (settings.productionPartnerIds.some(id => !options.productionPartners.some(row => row.id === id))) throw new Error('Selected production partner is not available for this shop.');
}
/** Etsy custom variation IDs are external mappings; canonical size/color/QRG values stay unchanged. */
export function buildEtsyInventory(product: EtsyListingProduct) {
  const settings = validateEtsySettings(product);
  const rows = product.variants.length ? product.variants : [{ sku: product.sku, size: '', color: '' }];
  if (rows.length > 400) throw new Error('Etsy supports at most 400 combinations with distinct SKUs.');
  if (new Set(rows.map(row => row.sku)).size !== rows.length) throw new Error('Duplicate Etsy variation SKUs.');
  const properties = product.variants.length ? [{ key: 'size' as const, id: 513, name: 'Size' }, { key: 'color' as const, id: 514, name: 'Color' }] : [];
  const products = rows.map(row => {
    if (!row.sku) throw new Error('An existing product SKU is required.');
    return { sku: row.sku, property_values: properties.map(property => {
      const value = row[property.key];
      if (!value || /[()]/.test(value)) throw new Error(`Etsy does not support the saved ${property.name} label: ${value}. Update the product selection explicitly.`);
      return { property_id: property.id, property_name: property.name, value_ids: [], values: [value] };
    }), offerings: [{ price: product.price, quantity: settings.quantity, is_enabled: true, readiness_state_id: settings.readinessStateId }] };
  });
  return { products, price_on_property: [], quantity_on_property: properties.map(row => row.id), sku_on_property: properties.map(row => row.id), readiness_state_on_property: [] };
}
function verifyOwnership(listing: any, shopId: string) {
  if (String(listing.shop_id) !== shopId) throw new Error('Etsy listing does not belong to this connected shop.');
}
function checkedState(listing: any) {
  const states: Record<string, 'active' | 'draft' | 'delisted' | 'pending'> = { active: 'active', draft: 'draft', inactive: 'delisted', sold_out: 'delisted', expired: 'delisted', edit: 'pending' };
  if (!states[listing.state]) throw new Error(`Unrecognized Etsy listing state: ${listing.state}.`);
  return states[listing.state];
}
export async function checkEtsyListing(credentials: EtsyCredentials, listingId: string, sku: string, withdraw: boolean, persist: (token: string) => Promise<void>) {
  if (!/^\d+$/.test(listingId || '')) throw new Error('No Etsy listing identity is saved.');
  const token = await etsyToken(credentials, persist);
  let remote = await etsyRequest(token, `/listings/${listingId}`);
  verifyOwnership(remote, credentials.shopId);
  if (withdraw && remote.state === 'active') {
    await etsyRequest(token, `/shops/${credentials.shopId}/listings/${listingId}`, 'PATCH', { state: 'inactive' });
    remote = await etsyRequest(token, `/listings/${listingId}`);
    verifyOwnership(remote, credentials.shopId);
  }
  if (withdraw && checkedState(remote) === 'active') throw new Error('Etsy still reports this listing active. Check its status before retrying.');
  return { success: true, sku, listingStatus: checkedState(remote), remoteStatus: remote.state, externalListingId: listingId, externalUrl: `https://www.etsy.com/listing/${listingId}` };
}
export async function pushListingToEtsy(credentials: EtsyCredentials, product: EtsyListingProduct, persistence: {
  existingListingId?: number; onRefreshToken: (token: string) => Promise<void>;
  onBeforeCreate: () => Promise<void>; onListingCreated: (id: number) => Promise<void>;
}): Promise<EtsyPushResult> {
  let listingId = persistence.existingListingId;
  try {
    const settings = validateEtsySettings(product), inventory = buildEtsyInventory(product);
    if (!product.title.trim() || product.title.length > 140) throw new Error('Etsy title must be 1–140 characters. Edit Item Setup.');
    if (!Number.isFinite(product.price) || product.price <= 0) throw new Error('A positive retail price is required.');
    if (!product.imageUrls.length || product.imageUrls.length > 20) throw new Error('Etsy needs 1–20 product images.');
    if (product.tags.length > 13 || product.tags.some(tag => !tag.trim() || tag.length > 20 || /[^\p{L}\p{Nd}\p{Zs}\-'™©®]/u.test(tag))) throw new Error('Etsy accepts up to 13 tags of 1–20 characters. Edit Item Setup.');
    if (!listingId && settings.quantity === 0) throw new Error('Set a positive quantity to create an Etsy draft.');
    const token = await etsyToken(credentials, persistence.onRefreshToken);
    const options = await setupOptions(token, credentials.shopId);
    validateEtsyShopSettings(settings, options, product.currencyCode);
    const listingPath = `/shops/${credentials.shopId}/listings`;
    if (listingId) {
      verifyOwnership(await etsyRequest(token, `/listings/${listingId}`), credentials.shopId);
      const current = await etsyRequest(token, `/listings/${listingId}/inventory`);
      if (!Array.isArray(current.products)) throw new Error('Etsy inventory could not be verified.');
      const intended = new Set(inventory.products.map(row => row.sku));
      // Never flatten somebody else's variations, third options, or unmapped old inventory.
      if (current.products.some((row: any) => !row.is_deleted && ((row.property_values || []).some((p: any) => ![513, 514].includes(p.property_id)) || row.property_values?.length > 2 || (row.sku && !intended.has(row.sku))))) throw new Error('Existing Etsy inventory differs from the saved product. Reconcile its variations before syncing.');
    }
    const payload: Record<string, any> = { title: product.title, description: product.description, who_made: settings.whoMade, when_made: settings.whenMade,
      taxonomy_id: settings.taxonomyId, shipping_profile_id: settings.shippingProfileId, return_policy_id: settings.returnPolicyId,
      type: 'physical', is_supply: false, should_auto_renew: settings.autoRenew, tags: product.tags, production_partner_ids: settings.productionPartnerIds };
    if (!listingId) {
      Object.assign(payload, { price: product.price, quantity: settings.quantity, readiness_state_id: settings.readinessStateId });
      await persistence.onBeforeCreate();
    }
    const saved = await etsyRequest(token, listingId ? `${listingPath}/${listingId}` : listingPath, listingId ? 'PATCH' : 'POST', payload);
    listingId = saved.listing_id || listingId;
    if (!Number.isSafeInteger(listingId) || !listingId) throw new Error('Etsy returned no valid listing ID. Reconcile the creation before retrying.');
    await persistence.onListingCreated(listingId);
    await etsyRequest(token, `/listings/${listingId}/inventory`, 'PUT', inventory, true);
    const imageIds: number[] = [];
    for (const [index, url] of product.imageUrls.entries()) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Product image ${index + 1} download failed (${response.status}).`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('Product image exceeds 20 MB.');
      const type = response.headers.get('content-type')?.split(';')[0];
      if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Product image must be JPEG, PNG or WebP.');
      const form = new FormData();
      form.append('image', new Blob([bytes], { type }), `product-${index + 1}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`);
      form.append('rank', String(index + 1)); form.append('overwrite', 'true');
      const uploaded = await etsyRequest(token, `${listingPath}/${listingId}/images`, 'POST', form);
      if (!Number.isSafeInteger(uploaded.listing_image_id)) throw new Error('Etsy did not confirm the uploaded image identity.');
      imageIds.push(uploaded.listing_image_id);
    }
    // Replacing the image list removes stale listing images; all requested uploads must succeed.
    await etsyRequest(token, `${listingPath}/${listingId}`, 'PATCH', { image_ids: imageIds, ...(settings.quantity > 0 ? { state: 'active' } : { state: 'inactive' }) });
    const remote = await etsyRequest(token, `/listings/${listingId}`);
    verifyOwnership(remote, credentials.shopId);
    const state = checkedState(remote);
    return { success: settings.quantity === 0 ? state === 'delisted' : state === 'active', listingId, state: remote.state, url: `https://www.etsy.com/listing/${listingId}`, imagesUploaded: imageIds.length,
      ...((settings.quantity > 0 && state !== 'active') ? { error: `Etsy reports ${remote.state}.` } : {}) };
  } catch (error: any) {
    return { success: false, ...(listingId ? { listingId } : {}), error: error.message };
  }
}
