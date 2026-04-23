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
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LWA token exchange failed (${resp.status}): ${text}`);
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
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LWA refresh failed (${resp.status}): ${text}`);
  }

  const data = await resp.json() as AmazonTokenResponse;
  return data.access_token;
}

// ─── OAuth URL Builder ────────────────────────────────────────────────────────

/**
 * Build the Seller Central authorization URL.
 * The admin opens this URL to authorize QR Gear's SP-API app on their account.
 * `state` should be the marketplace_account document ID so the callback knows
 * which account to store the resulting refresh token on.
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

// ─── SP-API Listings Push ─────────────────────────────────────────────────────

/**
 * Push a product listing to Amazon via SP-API Listings Items API.
 * Creates or fully replaces the listing for the given SKU.
 */
export async function pushListingToAmazon(
  credentials: AmazonCredentials,
  product: AmazonListingProduct,
  sku: string
): Promise<AmazonPushResult> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken(credentials.refreshToken);
  } catch (err: any) {
    return { success: false, sku, error: `Token refresh failed: ${err.message}` };
  }

  const url = `${SP_API_BASE_NA}/listings/2021-08-01/items/${encodeURIComponent(credentials.sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${credentials.marketplaceId}`;

  // Build the SP-API listing payload (Listings Items API 2021-08-01 schema)
  const payload = buildListingPayload(product, credentials.marketplaceId);

  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-amz-access-token': accessToken,
        'x-amz-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z',
        'User-Agent': 'QRGear/1.0 (Language=TypeScript)',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json() as any;

    if (!resp.ok) {
      const errMsg = data?.errors?.[0]?.message || data?.message || JSON.stringify(data);
      return { success: false, sku, error: `SP-API error (${resp.status}): ${errMsg}` };
    }

    const issues: AmazonIssue[] = (data.issues || []).map((i: any) => ({
      code: i.code,
      message: i.message,
      severity: i.severity,
      attributeName: i.attributeName,
    }));

    const hasErrors = issues.some((i) => i.severity === 'ERROR');

    return {
      success: !hasErrors,
      sku,
      submissionId: data.submissionId,
      status: data.status,
      issues: issues.length > 0 ? issues : undefined,
      error: hasErrors ? issues.filter((i) => i.severity === 'ERROR').map((i) => i.message).join('; ') : undefined,
    };
  } catch (err: any) {
    return { success: false, sku, error: `Network error: ${err.message}` };
  }
}

// ─── Payload Builder ──────────────────────────────────────────────────────────

function buildListingPayload(product: AmazonListingProduct, marketplaceId: string) {
  const attributes: Record<string, any> = {
    item_name: [{ value: product.title, language_tag: 'en_US', marketplace_id: marketplaceId }],
    brand: [{ value: product.brandName, marketplace_id: marketplaceId }],
    condition_type: [{ value: product.condition, marketplace_id: marketplaceId }],
    list_price: [{ currency: product.currencyCode, value: product.price, marketplace_id: marketplaceId }],
    fulfillment_availability: [{ fulfillment_channel_code: 'DEFAULT', quantity: product.quantity, marketplace_id: marketplaceId }],
  };

  if (product.description) {
    attributes.product_description = [{ value: product.description, language_tag: 'en_US', marketplace_id: marketplaceId }];
  }

  if (product.bulletPoints?.length > 0) {
    attributes.bullet_point = product.bulletPoints.slice(0, 5).map((bp) => ({
      value: bp,
      language_tag: 'en_US',
      marketplace_id: marketplaceId,
    }));
  }

  if (product.keywords?.length > 0) {
    attributes.generic_keyword = [{ value: product.keywords.slice(0, 250).join(' '), language_tag: 'en_US', marketplace_id: marketplaceId }];
  }

  if (product.imageUrls?.length > 0) {
    attributes.main_product_image_locator = [{ media_location: product.imageUrls[0], marketplace_id: marketplaceId }];
    if (product.imageUrls.length > 1) {
      attributes.other_product_image_locator_1 = product.imageUrls.slice(1, 8).map((url, i) => ({
        media_location: url,
        marketplace_id: marketplaceId,
      }));
    }
  }

  return {
    productType: product.productType || 'SHIRT',
    requirements: 'LISTING',
    attributes,
  };
}

// ─── Seller ID Extraction ─────────────────────────────────────────────────────

/**
 * After OAuth, Amazon includes the seller_id (spapi_oauth_code) in the callback.
 * This helper validates the spapi_oauth_code and extracts the seller ID
 * from the SP-API /sellers/v1/marketplaceParticipations endpoint.
 */
export async function getSellerIdFromToken(accessToken: string): Promise<{ sellerId: string; marketplaceIds: string[] }> {
  const resp = await fetch(`${SP_API_BASE_NA}/sellers/v1/marketplaceParticipations`, {
    headers: {
      'x-amz-access-token': accessToken,
      'User-Agent': 'QRGear/1.0 (Language=TypeScript)',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Could not retrieve seller info (${resp.status}): ${text}`);
  }

  const data = await resp.json() as any;
  const participations: any[] = data?.payload || [];

  if (participations.length === 0) {
    throw new Error('No marketplace participations found for this seller account.');
  }

  const sellerId: string = participations[0]?.seller?.sellerId;
  const marketplaceIds: string[] = participations.map((p: any) => p?.marketplace?.id).filter(Boolean);

  if (!sellerId) throw new Error('Could not extract seller ID from marketplace participations.');

  return { sellerId, marketplaceIds };
}
