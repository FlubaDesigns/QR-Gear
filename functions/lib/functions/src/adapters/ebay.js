"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createListing = createListing;
exports.updateListing = updateListing;
exports.deleteListing = deleteListing;
const INVENTORY_API = 'https://api.ebay.com/sell/inventory/v1';
function getHeaders() {
    const accessToken = process.env.EBAY_ACCESS_TOKEN;
    if (!accessToken)
        throw new Error('EBAY_ACCESS_TOKEN not configured');
    return {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
        'Accept': 'application/json',
    };
}
async function createListing(surface, _account) {
    let headers;
    try {
        headers = getHeaders();
    }
    catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
    const sku = `QRGEAR-${(surface.sku || surface.masterProductId).substring(0, 8)}`.toUpperCase();
    const inventoryItem = {
        sku,
        product: {
            title: surface.title.substring(0, 80),
            description: surface.description.substring(0, 4000),
            aspects: { Brand: ['QR Gear'], Type: ['Apparel'] },
            imageUrls: (surface.images || []).filter(u => u.startsWith('https://')).slice(0, 12),
        },
        condition: 'NEW',
        availability: { shipToLocationAvailability: { quantity: 999 } },
    };
    const invRes = await fetch(`${INVENTORY_API}/inventory_item/${encodeURIComponent(sku)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(inventoryItem),
    });
    if (!invRes.ok) {
        const errText = await invRes.text();
        return { success: false, error: `eBay inventory creation failed (${invRes.status}): ${errText}` };
    }
    const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
    const offerData = {
        sku,
        marketplaceId,
        format: 'FIXED_PRICE',
        listingDescription: surface.description.substring(0, 4000),
        categoryId: process.env.EBAY_DEFAULT_CATEGORY_ID || '1059',
        listingPolicies: {
            paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID || '',
            returnPolicyId: process.env.EBAY_RETURN_POLICY_ID || '',
            fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID || '',
        },
        pricingSummary: { price: { value: surface.retailPrice.toFixed(2), currency: 'USD' } },
        quantityLimitPerBuyer: 10,
    };
    const offerRes = await fetch(`${INVENTORY_API}/offer`, {
        method: 'POST',
        headers,
        body: JSON.stringify(offerData),
    });
    if (!offerRes.ok) {
        const errText = await offerRes.text();
        return { success: false, error: `eBay offer creation failed (${offerRes.status}): ${errText}` };
    }
    const offerResult = await offerRes.json();
    const publishRes = await fetch(`${INVENTORY_API}/offer/${offerResult.offerId}/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
    });
    if (!publishRes.ok) {
        const errText = await publishRes.text();
        return { success: false, error: `eBay publish failed (${publishRes.status}): ${errText}` };
    }
    const publishResult = await publishRes.json();
    return {
        success: true,
        externalListingId: publishResult.listingId,
        externalUrl: `https://www.ebay.com/itm/${publishResult.listingId}`,
    };
}
async function updateListing(_externalListingId, _surface, _account) {
    return { success: false, error: 'eBay update requires offer scan — use full_sync (delete + create) instead' };
}
async function deleteListing(externalListingId, _account) {
    let headers;
    try {
        headers = getHeaders();
    }
    catch (e) {
        return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
    const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
    try {
        const offersRes = await fetch(`${INVENTORY_API}/offer?marketplace_id=${marketplaceId}&limit=100`, { headers });
        if (offersRes.ok) {
            const offersData = await offersRes.json();
            const match = offersData.offers?.find(o => o.listing?.listingId === externalListingId);
            if (match) {
                await fetch(`${INVENTORY_API}/offer/${match.offerId}/withdraw`, { method: 'POST', headers, body: '{}' }).catch(() => { });
                await fetch(`${INVENTORY_API}/offer/${match.offerId}`, { method: 'DELETE', headers }).catch(() => { });
                await fetch(`${INVENTORY_API}/inventory_item/${encodeURIComponent(match.sku)}`, { method: 'DELETE', headers }).catch(() => { });
            }
        }
    }
    catch (err) {
        console.warn('[EbayAdapter] Delete cleanup error (non-fatal):', err);
    }
    return { success: true };
}
//# sourceMappingURL=ebay.js.map