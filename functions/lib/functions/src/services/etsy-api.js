"use strict";
/**
 * Etsy Sell API service
 * Handles OAuth 2.0 (PKCE) token exchange and Listings API operations.
 *
 * Requires environment variables:
 *   ETSY_KEYSTRING     — API key / Client ID from developers.etsy.com
 *   ETSY_SHARED_SECRET — Shared Secret (not used in PKCE flow but kept for reference)
 *   ETSY_REDIRECT_URI  — OAuth callback URL
 *                        (https://qrgear.com/api/marketplace/etsy/oauth/callback)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETSY_API_BASE = void 0;
exports.generateCodeVerifier = generateCodeVerifier;
exports.generateCodeChallenge = generateCodeChallenge;
exports.buildOAuthUrl = buildOAuthUrl;
exports.exchangeAuthCodeForTokens = exchangeAuthCodeForTokens;
exports.refreshAccessToken = refreshAccessToken;
exports.getEtsyShopInfo = getEtsyShopInfo;
exports.pushListingToEtsy = pushListingToEtsy;
const crypto = __importStar(require("crypto"));
// ─── Constants ────────────────────────────────────────────────────────────────
exports.ETSY_API_BASE = 'https://openapi.etsy.com';
const ETSY_AUTH_URL = 'https://www.etsy.com/oauth/connect';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
const ETSY_SCOPES = 'listings_r listings_w listings_d';
// ─── PKCE Helpers ─────────────────────────────────────────────────────────────
/**
 * Generate a cryptographically random code verifier for PKCE.
 * 43–128 characters, URL-safe base64.
 */
function generateCodeVerifier() {
    return crypto.randomBytes(64).toString('base64url').slice(0, 128);
}
/**
 * Derive the code challenge from a verifier using SHA-256 + base64url.
 */
function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}
// ─── OAuth URL Builder ────────────────────────────────────────────────────────
/**
 * Build the Etsy OAuth authorization URL.
 * Uses PKCE (S256) — caller must persist codeVerifier for use in the callback.
 * `state` should be the marketplace_account document ID.
 */
function buildOAuthUrl(state, codeChallenge) {
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
async function exchangeAuthCodeForTokens(code, codeVerifier) {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Etsy token exchange failed (${resp.status}): ${text}`);
    }
    return resp.json();
}
/**
 * Get a fresh access token from a stored refresh token.
 * Etsy access tokens expire after 1 hour.
 */
async function refreshAccessToken(refreshToken) {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Etsy token refresh failed (${resp.status}): ${text}`);
    }
    return resp.json();
}
// ─── Shop & User Info ─────────────────────────────────────────────────────────
/**
 * After OAuth, fetch the seller's user ID and primary shop.
 * Returns userId, shopId, and shopName.
 */
async function getEtsyShopInfo(accessToken) {
    const keystring = process.env.ETSY_KEYSTRING;
    if (!keystring)
        throw new Error('ETSY_KEYSTRING not set.');
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': keystring,
    };
    // Get user info
    const userResp = await fetch(`${exports.ETSY_API_BASE}/v3/application/users/me`, { headers });
    if (!userResp.ok) {
        const text = await userResp.text();
        throw new Error(`Could not retrieve Etsy user info (${userResp.status}): ${text}`);
    }
    const userData = await userResp.json();
    const userId = String(userData?.user_id || '');
    if (!userId)
        throw new Error('Etsy user info missing user_id.');
    // Get shop info
    const shopResp = await fetch(`${exports.ETSY_API_BASE}/v3/application/users/${userId}/shops`, { headers });
    if (!shopResp.ok) {
        const text = await shopResp.text();
        throw new Error(`Could not retrieve Etsy shop info (${shopResp.status}): ${text}`);
    }
    const shopData = await shopResp.json();
    const shopId = String(shopData?.shop_id || '');
    const shopName = shopData?.shop_name || '';
    if (!shopId)
        throw new Error('No Etsy shop found for this account. You must have an open Etsy shop to use this integration.');
    return { userId, shopId, shopName };
}
// ─── Listings API Push ────────────────────────────────────────────────────────
/**
 * Push a product listing to Etsy via the Listings API.
 * Steps:
 *   1. POST /v3/application/shops/{shop_id}/listings  — create draft listing
 *   2. For each image URL, fetch + upload to listing
 *   3. PATCH listing state → "active"
 */
async function pushListingToEtsy(credentials, product) {
    const keystring = process.env.ETSY_KEYSTRING;
    if (!keystring) {
        return { success: false, error: 'ETSY_KEYSTRING not configured on server.' };
    }
    // Refresh access token (always refresh to avoid expiry mid-push)
    let accessToken;
    let newRefreshToken;
    try {
        const tokens = await refreshAccessToken(credentials.refreshToken);
        accessToken = tokens.access_token;
        newRefreshToken = tokens.refresh_token || credentials.refreshToken;
    }
    catch (err) {
        return { success: false, error: `Token refresh failed: ${err.message}` };
    }
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': keystring,
        'Content-Type': 'application/json',
    };
    const shopId = credentials.shopId;
    if (!shopId) {
        return { success: false, error: 'No Etsy shop ID on this account. Reconnect via OAuth to re-fetch your shop.' };
    }
    // ── Step 1: Create Draft Listing ──────────────────────────────────────────
    const sanitizedTags = (product.tags || [])
        .map((t) => t.slice(0, 20).replace(/[^a-zA-Z0-9 ]/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 13);
    const listingPayload = {
        quantity: product.quantity > 0 ? product.quantity : 100,
        title: product.title.slice(0, 140),
        description: product.description,
        price: parseFloat(product.price.toFixed(2)),
        who_made: product.whoMade || 'i_did',
        when_made: product.whenMade || 'made_to_order',
        taxonomy_id: product.taxonomyId,
        shipping_profile_id: product.shippingProfileId,
        type: 'physical',
        is_digital: false,
        should_auto_renew: true,
    };
    if (sanitizedTags.length > 0)
        listingPayload.tags = sanitizedTags;
    if (product.returnPolicyId)
        listingPayload.return_policy_id = product.returnPolicyId;
    if (product.materials?.length)
        listingPayload.materials = product.materials.slice(0, 13);
    if (product.sku)
        listingPayload.sku = [product.sku];
    let listingId;
    try {
        const createResp = await fetch(`${exports.ETSY_API_BASE}/v3/application/shops/${shopId}/listings`, {
            method: 'POST',
            headers,
            body: JSON.stringify(listingPayload),
        });
        const createData = await createResp.json();
        if (!createResp.ok) {
            const errMsg = createData?.error_description || createData?.message || JSON.stringify(createData);
            return { success: false, error: `Listing creation failed (${createResp.status}): ${errMsg}` };
        }
        listingId = createData?.listing_id;
        if (!listingId) {
            return { success: false, error: 'Etsy did not return a listing_id after creation.' };
        }
    }
    catch (err) {
        return { success: false, error: `Network error creating listing: ${err.message}` };
    }
    // ── Step 2: Upload Images ─────────────────────────────────────────────────
    let imagesUploaded = 0;
    const imageUrls = (product.imageUrls || []).filter(Boolean).slice(0, 10);
    const warnings = [];
    for (let i = 0; i < imageUrls.length; i++) {
        try {
            const imgResp = await fetch(imageUrls[i]);
            if (!imgResp.ok) {
                warnings.push(`Image ${i + 1} fetch failed (${imgResp.status})`);
                continue;
            }
            const imgBuffer = await imgResp.arrayBuffer();
            const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
            const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
            const imgBlob = new Blob([imgBuffer], { type: contentType });
            const formData = new FormData();
            formData.append('image', imgBlob, `image_${i + 1}.${ext}`);
            formData.append('rank', String(i + 1));
            formData.append('overwrite', 'true');
            const uploadResp = await fetch(`${exports.ETSY_API_BASE}/v3/application/shops/${shopId}/listings/${listingId}/images`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'x-api-key': keystring,
                    // Do NOT set Content-Type — let fetch set multipart boundary automatically
                },
                body: formData,
            });
            if (uploadResp.ok) {
                imagesUploaded++;
            }
            else {
                const uploadErr = await uploadResp.text();
                warnings.push(`Image ${i + 1} upload failed (${uploadResp.status}): ${uploadErr.slice(0, 120)}`);
            }
        }
        catch (err) {
            warnings.push(`Image ${i + 1} error: ${err.message}`);
        }
    }
    // ── Step 3: Activate Listing ──────────────────────────────────────────────
    // Only activate if we have at least one image (Etsy requires images to go active)
    let finalState = 'draft';
    if (imagesUploaded > 0) {
        try {
            const activateResp = await fetch(`${exports.ETSY_API_BASE}/v3/application/shops/${shopId}/listings/${listingId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ state: 'active' }),
            });
            if (activateResp.ok) {
                finalState = 'active';
            }
            else {
                const activateErr = await activateResp.text();
                warnings.push(`Listing activation failed (${activateResp.status}): ${activateErr.slice(0, 120)}. Listing saved as draft.`);
            }
        }
        catch (err) {
            warnings.push(`Listing activation error: ${err.message}. Listing saved as draft.`);
        }
    }
    else if (imageUrls.length > 0) {
        warnings.push('All image uploads failed — listing saved as draft. Add images manually in Etsy to activate.');
    }
    else {
        warnings.push('No images on this surface — listing saved as draft. Add images in Etsy to activate.');
    }
    const listingUrl = `https://www.etsy.com/listing/${listingId}`;
    return {
        success: true,
        listingId,
        state: finalState,
        url: listingUrl,
        imagesUploaded,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}
//# sourceMappingURL=etsy-api.js.map