import type { MarketplaceResult, SurfaceInputFull, AccountInput, EbayBlock } from './etsy';

const INVENTORY_API = 'https://api.ebay.com/sell/inventory/v1';

function getHeaders(): Record<string, string> {
  const accessToken = process.env.EBAY_ACCESS_TOKEN;
  if (!accessToken) throw new Error('EBAY_ACCESS_TOKEN not configured');
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
    'Accept': 'application/json',
  };
}

// ─── Payload builder ─────────────────────────────────────────────────────────
// Implements: core + common + ebay overrides = final eBay listing payload.
// This is the single authoritative place for eBay payload construction.
export function buildEbayPayload(surface: SurfaceInputFull): {
  sku: string;
  inventoryItem: Record<string, unknown>;
  offerData: Record<string, unknown>;
} {
  const eb: EbayBlock = surface.ebay || {};

  // Core values (base layer)
  const resolvedTitle = (eb.priceOverride != null ? surface.title : surface.title).substring(0, 80);
  const resolvedPrice = eb.priceOverride ?? surface.retailPrice;
  const resolvedQuantity = eb.quantity ?? 999;

  // Build item specifics — merge common fields first, then ebay.itemSpecifics overrides
  const aspects: Record<string, string[]> = {};

  // Flow common fields into eBay aspects
  if (surface.brand || eb.brand) aspects['Brand'] = [eb.brand || surface.brand || 'QR Gear'];
  if (surface.material) aspects['Material'] = [surface.material];
  if (surface.department) aspects['Department'] = [surface.department];
  if (surface.condition) aspects['Condition'] = [surface.condition];

  // eBay itemSpecifics override/extend common aspects
  if (eb.itemSpecifics) {
    for (const [k, v] of Object.entries(eb.itemSpecifics)) {
      if (v && v.trim()) aspects[k] = [v.trim()];
    }
  }

  const sku = `QRGEAR-${(surface.sku || surface.masterProductId).substring(0, 8)}`.toUpperCase();

  // Product identifiers
  const identifiers: Record<string, unknown>[] = [];
  if (eb.upc) identifiers.push({ type: 'UPC', value: eb.upc });
  if (eb.ean) identifiers.push({ type: 'EAN', value: eb.ean });
  if (eb.mpn) identifiers.push({ type: 'MPN', value: eb.mpn });

  const inventoryItem: Record<string, unknown> = {
    sku,
    product: {
      title: resolvedTitle,
      description: surface.description.substring(0, 4000),
      aspects,
      imageUrls: (surface.images || []).filter((u) => u.startsWith('https://')).slice(0, 12),
      ...(identifiers.length > 0 ? { identifiers } : {}),
    },
    condition: eb.conditionId || 'NEW',
    availability: {
      shipToLocationAvailability: { quantity: resolvedQuantity },
    },
    ...(eb.packageWeightLbs != null ? {
      packageWeightAndSize: {
        weight: { value: eb.packageWeightLbs, unit: 'POUND' },
        ...(eb.packageDimensionsInches ? {
          dimensions: {
            length: eb.packageDimensionsInches.length,
            width: eb.packageDimensionsInches.width,
            height: eb.packageDimensionsInches.height,
            unit: 'INCH',
          },
        } : {}),
      },
    } : {}),
  };

  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';

  const offerData: Record<string, unknown> = {
    sku,
    marketplaceId,
    format: eb.listingFormat || 'FIXED_PRICE',
    listingDescription: surface.description.substring(0, 4000),
    categoryId: eb.categoryId || process.env.EBAY_DEFAULT_CATEGORY_ID || '1059',
    listingPolicies: {
      paymentPolicyId: eb.paymentPolicyId || process.env.EBAY_PAYMENT_POLICY_ID || '',
      returnPolicyId: eb.returnsPolicyId || process.env.EBAY_RETURN_POLICY_ID || '',
      fulfillmentPolicyId: eb.shippingPolicyId || process.env.EBAY_FULFILLMENT_POLICY_ID || '',
    },
    pricingSummary: {
      price: { value: resolvedPrice.toFixed(2), currency: 'USD' },
    },
    quantityLimitPerBuyer: 10,
    ...(eb.subtitle ? { subtitle: eb.subtitle.substring(0, 55) } : {}),
    ...(eb.bestOfferEnabled != null ? {
      bestOfferTerms: { bestOfferEnabled: eb.bestOfferEnabled },
    } : {}),
    ...(eb.handlingTime != null ? { handlingTime: eb.handlingTime } : {}),
  };

  return { sku, inventoryItem, offerData };
}

// ─── Create listing ───────────────────────────────────────────────────────────
export async function createListing(surface: SurfaceInputFull, _account: AccountInput): Promise<MarketplaceResult> {
  let headers: Record<string, string>;
  try {
    headers = getHeaders();
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  const { sku, inventoryItem, offerData } = buildEbayPayload(surface);

  const invRes = await fetch(`${INVENTORY_API}/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(inventoryItem),
  });

  if (!invRes.ok) {
    const errText = await invRes.text();
    return { success: false, error: `eBay inventory creation failed (${invRes.status}): ${errText}` };
  }

  const offerRes = await fetch(`${INVENTORY_API}/offer`, {
    method: 'POST',
    headers,
    body: JSON.stringify(offerData),
  });

  if (!offerRes.ok) {
    const errText = await offerRes.text();
    return { success: false, error: `eBay offer creation failed (${offerRes.status}): ${errText}` };
  }

  const offerResult = await offerRes.json() as { offerId: string };

  const publishRes = await fetch(`${INVENTORY_API}/offer/${offerResult.offerId}/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!publishRes.ok) {
    const errText = await publishRes.text();
    return { success: false, error: `eBay publish failed (${publishRes.status}): ${errText}` };
  }

  const publishResult = await publishRes.json() as { listingId: string };

  return {
    success: true,
    externalListingId: publishResult.listingId,
    externalUrl: `https://www.ebay.com/itm/${publishResult.listingId}`,
  };
}

export async function updateListing(_externalListingId: string, _surface: SurfaceInputFull, _account: AccountInput): Promise<MarketplaceResult> {
  return { success: false, error: 'eBay update requires offer scan — use full_sync (delete + create) instead' };
}

export async function deleteListing(externalListingId: string, _account: AccountInput): Promise<MarketplaceResult> {
  let headers: Record<string, string>;
  try {
    headers = getHeaders();
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }

  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';

  try {
    const offersRes = await fetch(`${INVENTORY_API}/offer?marketplace_id=${marketplaceId}&limit=100`, { headers });
    if (offersRes.ok) {
      const offersData = await offersRes.json() as { offers?: Array<{ offerId: string; sku: string; listing?: { listingId: string } }> };
      const match = offersData.offers?.find((o) => o.listing?.listingId === externalListingId);
      if (match) {
        await fetch(`${INVENTORY_API}/offer/${match.offerId}/withdraw`, { method: 'POST', headers, body: '{}' }).catch(() => {});
        await fetch(`${INVENTORY_API}/offer/${match.offerId}`, { method: 'DELETE', headers }).catch(() => {});
        await fetch(`${INVENTORY_API}/inventory_item/${encodeURIComponent(match.sku)}`, { method: 'DELETE', headers }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[EbayAdapter] Delete cleanup error (non-fatal):', err);
  }

  return { success: true };
}
