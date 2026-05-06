import { assertValidQrgCode } from '../../../shared/qrgCodes';

export interface MarketplaceResult {
  success: boolean;
  externalListingId?: string;
  externalUrl?: string;
  error?: string;
}

// ─── eBay-specific field block ───────────────────────────────────────────────
// Stored as `surface.ebay` on the Firestore surface document.
// All fields are optional at storage time but several are required for eBay
// listing readiness (validated in check-readiness).
export interface EbayBlock {
  categoryId?: string;
  conditionId?: string;
  listingFormat?: 'FIXED_PRICE' | 'AUCTION';
  subtitle?: string;
  // Key-value item specifics — flexible but pre-seeded for common apparel fields.
  // e.g. { Brand: "QR Gear", Department: "Men", Color: "Black", Size: "M" }
  itemSpecifics?: Record<string, string>;
  bestOfferEnabled?: boolean;
  // eBay Business Policy IDs
  shippingPolicyId?: string;
  returnsPolicyId?: string;
  paymentPolicyId?: string;
  handlingTime?: number;
  packageWeightLbs?: number;
  packageDimensionsInches?: { length: number; width: number; height: number };
  upc?: string;
  ean?: string;
  mpn?: string;
  brand?: string;
  // Explicit overrides — take precedence over core fields for eBay only
  priceOverride?: number;
  quantity?: number;
}

// ─── Base input (Etsy-compatible, also used generically) ─────────────────────
export interface SurfaceInput {
  title: string;
  description: string;
  tags: string[];
  images: string[];
  retailPrice: number;
  sku: string;
  masterProductId: string;
}

// ─── Full input — three-layer resolved view used by the eBay adapter ─────────
// core   = product-level data (title, description, price, sku, images, qty)
// common = marketplace-common data (brand, material, condition, bullets, etc.)
// ebay   = eBay-specific block from surface.ebay, already merged/resolved
export interface SurfaceInputFull extends SurfaceInput {
  subtitle?: string;
  bulletPoints?: string[];
  keywords?: string[];
  condition?: string;
  brand?: string;
  material?: string;
  department?: string;
  shippingProfileRef?: string;
  returnsProfileRef?: string;
  ebay?: EbayBlock;
}

export interface AccountInput {
  shopId: string;
}

const ETSY_API_BASE = 'https://api.etsy.com/v3/application';

// ─── QRG parent-category → Etsy taxonomy_id mapping ─────────────────────────
// QRG super-category S digit: 1=Apparel, 2=Houseware, 3=Print&Display,
//   4=Accessories, 5=Pet Products, 6=Holiday&Seasonal
// Etsy taxonomy IDs verified against the Etsy Taxonomy API (v3).
const QRG_CATEGORY_TO_ETSY_TAXONOMY: Record<string, number> = {
  '1': 482,   // Apparel → Clothing (top-level apparel node)
  '2': 68,    // Houseware → Home & Living
  '3': 2078,  // Print & Display → Art & Collectibles > Prints
  '4': 164,   // Accessories → Accessories
  '5': 1,     // Pet Products → Animals & Pet Supplies
  '6': 985,   // Holiday & Seasonal → Holidays
};

/** Resolve Etsy taxonomy_id from a QRG master product doc ID (qrg_STNNN). */
function etsyTaxonomyFromSku(sku: string): number {
  // Full QRG code format: QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]
  // S (super-category) is the first digit of STNNN segment.
  const match = /^QRG-([1-6])[1-9]\d{3}-/.exec(sku);
  if (match) {
    return QRG_CATEGORY_TO_ETSY_TAXONOMY[match[1]] ?? 482;
  }
  return 482; // default: Clothing
}

function getCredentials(account: AccountInput) {
  const apiKey = process.env.ETSY_API_KEYSTRING;
  const accessToken = process.env.ETSY_ACCESS_TOKEN;
  const shopId = account.shopId || process.env.ETSY_SHOP_ID;
  return { apiKey, accessToken, shopId };
}

export async function createListing(surface: SurfaceInput, account: AccountInput): Promise<MarketplaceResult> {
  // Validate QRG identity before any marketplace action — same as Amazon/eBay adapters
  assertValidQrgCode(surface.sku, 'EtsyAdapter');

  const { apiKey, accessToken, shopId } = getCredentials(account);
  if (!apiKey || !accessToken || !shopId) {
    return { success: false, error: 'Etsy API credentials not configured (ETSY_API_KEYSTRING, ETSY_ACCESS_TOKEN, ETSY_SHOP_ID)' };
  }

  const listingBody: Record<string, unknown> = {
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
      const profilesData = await profilesRes.json() as { results?: Array<{ shipping_profile_id: number }> };
      if (profilesData.results && profilesData.results.length > 0) {
        listingBody.shipping_profile_id = profilesData.results[0].shipping_profile_id;
      }
    }
  } catch {}

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

  const result = await createRes.json() as { listing_id: number; url: string };
  const listingId = String(result.listing_id);

  if (surface.images && surface.images.length > 0) {
    for (const imageUrl of surface.images.slice(0, 10)) {
      if (!imageUrl.startsWith('https://')) continue;
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
      } catch (imgErr) {
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

export async function updateListing(externalListingId: string, surface: SurfaceInput, account: AccountInput): Promise<MarketplaceResult> {
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

export async function deleteListing(externalListingId: string, account: AccountInput): Promise<MarketplaceResult> {
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
