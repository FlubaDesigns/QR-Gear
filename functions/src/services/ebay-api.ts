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

// Node 20 has native fetch — no import needed.

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
}

export interface EbayPushResult {
  success: boolean;
  sku: string;
  listingId?: string;
  offerId?: string;
  status?: string;
  error?: string;
  warnings?: string[];
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
 * `state` should be the marketplace_account document ID so the callback knows
 * which account to store the resulting refresh token on.
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

// ─── Inventory API Push ───────────────────────────────────────────────────────

/**
 * Push a product listing to eBay via the Sell Inventory API.
 * Steps:
 *   1. PUT /sell/inventory/v1/inventory_item/{sku}  — create/replace inventory item
 *   2. GET /sell/inventory/v1/offer?sku=...          — check for existing offer
 *   3. POST /sell/inventory/v1/offer  OR  PUT .../offer/{offerId}  — create/update offer
 *   4. POST /sell/inventory/v1/offer/{offerId}/publish  — go live
 */
export async function pushListingToEbay(
  credentials: EbayCredentials,
  product: EbayListingProduct,
  sku: string,
): Promise<EbayPushResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken(credentials.refreshToken);
  } catch (err: any) {
    return { success: false, sku, error: `Token refresh failed: ${err.message}` };
  }

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'en-US',
    'Content-Language': 'en-US',
  };

  // ── Step 1: Create/Replace Inventory Item ─────────────────────────────────
  const inventoryPayload = buildInventoryItemPayload(product);
  const inventoryUrl = `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`;

  try {
    const invResp = await fetch(inventoryUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(inventoryPayload),
    });

    // 204 No Content = success for PUT inventory item
    if (!invResp.ok && invResp.status !== 204) {
      const text = await invResp.text();
      return { success: false, sku, error: `Inventory item creation failed (${invResp.status}): ${text}` };
    }
  } catch (err: any) {
    return { success: false, sku, error: `Network error creating inventory item: ${err.message}` };
  }

  // ── Step 2: Check for existing offer ──────────────────────────────────────
  let existingOfferId: string | null = null;
  try {
    const offerListResp = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${EBAY_MARKETPLACE_ID}`,
      { headers },
    );

    if (offerListResp.ok) {
      const offerListData = await offerListResp.json() as any;
      const offers: any[] = offerListData?.offers || [];
      if (offers.length > 0) {
        existingOfferId = offers[0].offerId;
      }
    }
  } catch (err: any) {
    console.warn(`[eBay Push] Could not check existing offers for SKU ${sku}: ${err.message}`);
  }

  // ── Step 3: Create or Update Offer ────────────────────────────────────────
  const offerPayload = buildOfferPayload(product, sku);
  let offerId: string;

  try {
    if (existingOfferId) {
      // Update existing offer
      const updateResp = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/offer/${existingOfferId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(offerPayload),
      });

      if (!updateResp.ok) {
        const text = await updateResp.text();
        return { success: false, sku, error: `Offer update failed (${updateResp.status}): ${text}` };
      }

      offerId = existingOfferId;
    } else {
      // Create new offer
      const createResp = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/offer`, {
        method: 'POST',
        headers,
        body: JSON.stringify(offerPayload),
      });

      if (!createResp.ok) {
        const text = await createResp.text();
        return { success: false, sku, error: `Offer creation failed (${createResp.status}): ${text}` };
      }

      const createData = await createResp.json() as any;
      offerId = createData?.offerId;
      if (!offerId) {
        return { success: false, sku, error: 'eBay did not return an offerId after offer creation.' };
      }
    }
  } catch (err: any) {
    return { success: false, sku, error: `Network error creating/updating offer: ${err.message}` };
  }

  // ── Step 4: Publish Offer ─────────────────────────────────────────────────
  try {
    const publishResp = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    const publishData = await publishResp.json() as any;

    if (!publishResp.ok) {
      const errMsg = publishData?.errors?.[0]?.message || publishData?.message || JSON.stringify(publishData);
      return { success: false, sku, offerId, error: `Offer publish failed (${publishResp.status}): ${errMsg}` };
    }

    const listingId: string = publishData?.listingId || '';
    const warnings: string[] = (publishData?.warnings || []).map((w: any) => w.message || JSON.stringify(w));

    return {
      success: true,
      sku,
      offerId,
      listingId,
      status: 'PUBLISHED',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err: any) {
    return { success: false, sku, offerId, error: `Network error publishing offer: ${err.message}` };
  }
}

// ─── Payload Builders ─────────────────────────────────────────────────────────

function buildInventoryItemPayload(product: EbayListingProduct): Record<string, any> {
  const aspects: Record<string, string[]> = { Brand: [product.brand || 'QR Gear'] };

  if (product.aspects) {
    for (const [k, v] of Object.entries(product.aspects)) {
      aspects[k] = v;
    }
  }

  const productData: Record<string, any> = {
    title: product.title,
    description: product.description,
    aspects,
    imageUrls: product.imageUrls.filter(Boolean),
  };

  if (product.upc) productData.upc = [product.upc];
  if (product.ean) productData.ean = [product.ean];
  if (product.mpn) productData.mpn = product.mpn;

  return {
    availability: {
      shipToLocationAvailability: {
        quantity: product.quantity > 0 ? product.quantity : 100,
      },
    },
    condition: mapConditionToEbay(product.condition),
    product: productData,
  };
}

function buildOfferPayload(product: EbayListingProduct, sku: string): Record<string, any> {
  const payload: Record<string, any> = {
    sku,
    marketplaceId: EBAY_MARKETPLACE_ID,
    format: product.listingFormat || 'FIXED_PRICE',
    availableQuantity: product.quantity > 0 ? product.quantity : 100,
    categoryId: product.categoryId,
    listingDescription: product.description,
    listingPolicies: {} as Record<string, any>,
    pricingSummary: {
      price: {
        currency: product.currencyCode || 'USD',
        value: product.price.toFixed(2),
      },
    },
  };

  if (product.fulfillmentPolicyId) payload.listingPolicies.fulfillmentPolicyId = product.fulfillmentPolicyId;
  if (product.paymentPolicyId) payload.listingPolicies.paymentPolicyId = product.paymentPolicyId;
  if (product.returnPolicyId) payload.listingPolicies.returnPolicyId = product.returnPolicyId;
  if (product.merchantLocationKey) payload.merchantLocationKey = product.merchantLocationKey;

  if (product.listingFormat === 'FIXED_PRICE' && product.bestOfferEnabled) {
    payload.quantityLimitPerBuyer = 10;
  }

  if (product.subtitle) {
    payload.subtitle = product.subtitle;
  }

  return payload;
}

function mapConditionToEbay(condition: string): string {
  const map: Record<string, string> = {
    new: 'NEW',
    new_new: 'NEW',
    NEW: 'NEW',
    used_good: 'GOOD',
    used_like_new: 'LIKE_NEW',
    GOOD: 'GOOD',
    LIKE_NEW: 'LIKE_NEW',
    ACCEPTABLE: 'ACCEPTABLE',
  };
  return map[condition] || 'NEW';
}
