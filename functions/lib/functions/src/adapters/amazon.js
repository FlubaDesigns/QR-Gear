"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createListing = createListing;
exports.updateListing = updateListing;
exports.deleteListing = deleteListing;
const qrgCodes_1 = require("../../../shared/qrgCodes");
async function getAccessToken() {
    const clientId = process.env.AMAZON_SP_CLIENT_ID;
    const clientSecret = process.env.AMAZON_SP_CLIENT_SECRET;
    const refreshToken = process.env.AMAZON_SP_REFRESH_TOKEN;
    if (!clientId || !refreshToken) {
        return { error: 'Amazon SP-API credentials not configured (AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET, AMAZON_SP_REFRESH_TOKEN)' };
    }
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret || '',
        }),
    });
    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        return { error: `Amazon token refresh failed: ${errText}` };
    }
    const tokenData = await tokenRes.json();
    return { token: tokenData.access_token };
}
function getSellerId() {
    return process.env.AMAZON_SELLER_ID || '';
}
function getMarketplaceId() {
    return process.env.AMAZON_MARKETPLACE_ID || 'ATVPDKIKX0DER';
}
const ENDPOINT = 'https://sellingpartnerapi-na.amazon.com';
async function createListing(surface, _account) {
    const sellerId = getSellerId();
    if (!sellerId)
        return { success: false, error: 'AMAZON_SELLER_ID not configured' };
    const tokenResult = await getAccessToken();
    if ('error' in tokenResult)
        return { success: false, error: tokenResult.error };
    (0, qrgCodes_1.assertValidQrgCode)(surface.sku, 'AmazonAdapter');
    const sku = surface.sku;
    const marketplaceId = getMarketplaceId();
    const listingData = {
        productType: 'SHIRT',
        requirements: 'LISTING',
        attributes: {
            condition_type: [{ value: 'new_new' }],
            item_name: [{ value: surface.title.substring(0, 500), language_tag: 'en_US' }],
            product_description: [{ value: surface.description.substring(0, 2000), language_tag: 'en_US' }],
            brand: [{ value: 'QR Gear', language_tag: 'en_US' }],
            purchasable_offer: [{
                    currency: 'USD',
                    our_price: [{ schedule: [{ value_with_tax: surface.retailPrice }] }],
                }],
            fulfillment_availability: [{ fulfillment_channel_code: 'DEFAULT', quantity: 999 }],
        },
    };
    const listRes = await fetch(`${ENDPOINT}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}`, {
        method: 'PUT',
        headers: {
            'x-amz-access-token': tokenResult.token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(listingData),
    });
    if (!listRes.ok) {
        const errText = await listRes.text();
        return { success: false, error: `Amazon listing creation failed (${listRes.status}): ${errText}` };
    }
    return {
        success: true,
        externalListingId: sku,
        externalUrl: `https://sellercentral.amazon.com/skucentral?mSku=${encodeURIComponent(sku)}`,
    };
}
async function updateListing(_externalListingId, surface, account) {
    return createListing(surface, account);
}
async function deleteListing(externalListingId, _account) {
    const sellerId = getSellerId();
    if (!sellerId)
        return { success: false, error: 'AMAZON_SELLER_ID not configured' };
    const tokenResult = await getAccessToken();
    if ('error' in tokenResult)
        return { success: false, error: tokenResult.error };
    const marketplaceId = getMarketplaceId();
    try {
        const deleteRes = await fetch(`${ENDPOINT}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(externalListingId)}?marketplaceIds=${marketplaceId}`, {
            method: 'DELETE',
            headers: {
                'x-amz-access-token': tokenResult.token,
                'Content-Type': 'application/json',
            },
        });
        if (!deleteRes.ok && deleteRes.status !== 404) {
            const errText = await deleteRes.text();
            return { success: false, error: `Amazon delete failed (${deleteRes.status}): ${errText}` };
        }
    }
    catch (err) {
        console.warn('[AmazonAdapter] Delete error (non-fatal):', err);
    }
    return { success: true };
}
//# sourceMappingURL=amazon.js.map