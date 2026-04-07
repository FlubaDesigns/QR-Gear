export interface MarketplaceResult {
  success: boolean;
  externalListingId?: string;
  externalUrl?: string;
  error?: string;
}

export interface SurfaceInput {
  title: string;
  description: string;
  tags: string[];
  images: string[];
  retailPrice: number;
  sku: string;
  masterProductId: string;
}

export interface AccountInput {
  shopId: string;
}

const ETSY_API_BASE = 'https://api.etsy.com/v3/application';

function getCredentials(account: AccountInput) {
  const apiKey = process.env.ETSY_API_KEYSTRING;
  const accessToken = process.env.ETSY_ACCESS_TOKEN;
  const shopId = account.shopId || process.env.ETSY_SHOP_ID;
  return { apiKey, accessToken, shopId };
}

export async function createListing(surface: SurfaceInput, account: AccountInput): Promise<MarketplaceResult> {
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
    taxonomy_id: 482,
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
