"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createListing = createListing;
exports.updateListing = updateListing;
exports.deleteListing = deleteListing;
const qrgCodes_1 = require("../../../shared/qrgCodes");
const ETSY_API_BASE = 'https://api.etsy.com/v3/application';
// ─── QRG parent-category → Etsy taxonomy_id mapping ─────────────────────────
// QRG super-category S digit: 1=Apparel, 2=Houseware, 3=Print&Display,
//   4=Accessories, 5=Pet Products, 6=Holiday&Seasonal
// Etsy taxonomy IDs verified against the Etsy Taxonomy API (v3).
const QRG_CATEGORY_TO_ETSY_TAXONOMY = {
    '1': 482, // Apparel → Clothing (top-level apparel node)
    '2': 68, // Houseware → Home & Living
    '3': 2078, // Print & Display → Art & Collectibles > Prints
    '4': 164, // Accessories → Accessories
    '5': 1, // Pet Products → Animals & Pet Supplies
    '6': 985, // Holiday & Seasonal → Holidays
};
/** Resolve Etsy taxonomy_id from a QRG master product doc ID (qrg_STNNN). */
function etsyTaxonomyFromSku(sku) {
    // Full QRG code format: QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]
    // S (super-category) is the first digit of STNNN segment.
    const match = /^QRG-([1-6])[1-9]\d{3}-/.exec(sku);
    if (match) {
        return QRG_CATEGORY_TO_ETSY_TAXONOMY[match[1]] ?? 482;
    }
    return 482; // default: Clothing
}
function getCredentials(account) {
    const apiKey = process.env.ETSY_API_KEYSTRING;
    const accessToken = process.env.ETSY_ACCESS_TOKEN;
    const shopId = account.shopId || process.env.ETSY_SHOP_ID;
    return { apiKey, accessToken, shopId };
}
async function createListing(surface, account) {
    // Validate QRG identity before any marketplace action — same as Amazon/eBay adapters
    (0, qrgCodes_1.assertValidQrgCode)(surface.sku, 'EtsyAdapter');
    const { apiKey, accessToken, shopId } = getCredentials(account);
    if (!apiKey || !accessToken || !shopId) {
        return { success: false, error: 'Etsy API credentials not configured (ETSY_API_KEYSTRING, ETSY_ACCESS_TOKEN, ETSY_SHOP_ID)' };
    }
    const listingBody = {
        title: surface.title.substring(0, 140),
        description: surface.description.substring(0, 65535),
        price: surface.retailPrice,
        quantity: 999,
        who_made: 'i_did',
        when_made: 'made_to_order',
        taxonomy_id: etsyTaxonomyFromSku(surface.sku),
        tags: (surface.tags || []).slice(0, 13),
        shipping_profile_id: null,
        type: 'physical',
        is_customizable: true,
    };
    try {
        const profilesRes = await fetch(`${ETSY_API_BASE}/shops/${shopId}/shipping-profiles`, {
            headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${accessToken}` },
        });
        if (profilesRes.ok) {
            const profilesData = await profilesRes.json();
            if (profilesData.results && profilesData.results.length > 0) {
                listingBody.shipping_profile_id = profilesData.results[0].shipping_profile_id;
            }
        }
    }
    catch { }
    const createRes = await fetch(`${ETSY_API_BASE}/shops/${shopId}/listings`, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(listingBody),
    });
    if (!createRes.ok) {
        const errText = await createRes.text();
        return { success: false, error: `Etsy create listing failed (${createRes.status}): ${errText}` };
    }
    const result = await createRes.json();
    const listingId = String(result.listing_id);
    if (surface.images && surface.images.length > 0) {
        for (const imageUrl of surface.images.slice(0, 10)) {
            if (!imageUrl.startsWith('https://'))
                continue;
            try {
                const imgRes = await fetch(imageUrl);
                if (imgRes.ok) {
                    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
                    const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
                    const formData = new FormData();
                    formData.append('image', blob, 'product.jpg');
                    await fetch(`${ETSY_API_BASE}/shops/${shopId}/listings/${listingId}/images`, {
                        method: 'POST',
                        headers: {
                            'x-api-key': apiKey,
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        body: formData,
                    });
                }
            }
            catch (imgErr) {
                console.warn('[EtsyAdapter] Image upload skipped:', imgErr);
            }
        }
    }
    return {
        success: true,
        externalListingId: listingId,
        externalUrl: result.url || `https://www.etsy.com/listing/${listingId}`,
    };
}
async function updateListing(externalListingId, surface, account) {
    const { apiKey, accessToken, shopId } = getCredentials(account);
    if (!apiKey || !accessToken || !shopId) {
        return { success: false, error: 'Etsy API credentials not configured' };
    }
    const updateRes = await fetch(`${ETSY_API_BASE}/shops/${shopId}/listings/${externalListingId}`, {
        method: 'PATCH',
        headers: {
            'x-api-key': apiKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: surface.title.substring(0, 140),
            description: surface.description.substring(0, 65535),
            price: surface.retailPrice,
            tags: (surface.tags || []).slice(0, 13),
        }),
    });
    if (!updateRes.ok) {
        const errText = await updateRes.text();
        return { success: false, error: `Etsy update listing failed (${updateRes.status}): ${errText}` };
    }
    return {
        success: true,
        externalListingId,
        externalUrl: `https://www.etsy.com/listing/${externalListingId}`,
    };
}
async function deleteListing(externalListingId, account) {
    const { apiKey, accessToken, shopId } = getCredentials(account);
    if (!apiKey || !accessToken || !shopId) {
        return { success: false, error: 'Etsy API credentials not configured' };
    }
    const deleteRes = await fetch(`${ETSY_API_BASE}/shops/${shopId}/listings/${externalListingId}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${accessToken}` },
    });
    if (!deleteRes.ok && deleteRes.status !== 404) {
        const errText = await deleteRes.text();
        return { success: false, error: `Etsy delete failed (${deleteRes.status}): ${errText}` };
    }
    return { success: true };
}
//# sourceMappingURL=etsy.js.map