const PRINTIFY_API_BASE = 'https://api.printify.com/v1';
const PLACEHOLDER_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';

let cachedPlaceholderImageId: string | null = null;

export interface PrintifyCostData {
  baseCost: number;
  variantCosts: Record<string, number>;
  sizeUpcharges: Record<string, number>;
  lookupTimestamp: string;
  blueprintId: number;
  printProviderId: number;
}

function getApiKey(): string {
  return (process.env.PRINTIFY_API_KEY || '').trim().replace(/\s+/g, '');
}

function getShopId(): string {
  return (process.env.PRINTIFY_SHOP_ID || '').trim().replace(/\s+/g, '');
}

function headers(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${PRINTIFY_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string> || {}) },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Printify API ${response.status}: ${errorText}`);
  }
  return response.json();
}

async function getOrUploadPlaceholderImage(): Promise<string> {
  if (cachedPlaceholderImageId) {
    return cachedPlaceholderImageId;
  }
  console.log('[PrintifyCostLookup] Uploading placeholder image...');
  const result = await apiRequest<{ id: string }>('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: 'cost-lookup-placeholder.png', url: PLACEHOLDER_IMAGE_URL }),
  });
  cachedPlaceholderImageId = result.id;
  console.log(`[PrintifyCostLookup] Placeholder image uploaded: ${result.id}`);
  return result.id;
}

function extractSizeFromTitle(title: string): string | null {
  const parts = title.split('/').map(p => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return null;
}

export async function lookupPrintifyCosts(blueprintId: number, printProviderId: number): Promise<PrintifyCostData> {
  const apiKey = getApiKey();
  const shopId = getShopId();
  if (!apiKey || !shopId) {
    throw new Error('[PrintifyCostLookup] Missing PRINTIFY_API_KEY or PRINTIFY_SHOP_ID');
  }

  console.log(`[PrintifyCostLookup] Looking up costs for blueprint=${blueprintId}, provider=${printProviderId}`);

  const imageId = await getOrUploadPlaceholderImage();

  const variantsResponse = await apiRequest<{ variants: Array<{ id: number; title: string; placeholders?: Array<{ position: string }> }> }>(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`
  );
  const allVariants = variantsResponse.variants || [];
  if (allVariants.length === 0) {
    throw new Error(`[PrintifyCostLookup] No variants found for blueprint=${blueprintId}, provider=${printProviderId}`);
  }

  const placementMap = new Map<string, Set<number>>();
  const allVariantIds: number[] = [];
  for (const v of allVariants) {
    allVariantIds.push(v.id);
    if (v.placeholders) {
      for (const ph of v.placeholders) {
        if (!placementMap.has(ph.position)) {
          placementMap.set(ph.position, new Set());
        }
        placementMap.get(ph.position)!.add(v.id);
      }
    }
  }

  let bestPlacement = 'front';
  let bestIds = allVariantIds;
  let bestCoverage = 0;
  for (const [pos, ids] of Array.from(placementMap.entries())) {
    if (ids.size > bestCoverage) {
      bestCoverage = ids.size;
      bestPlacement = pos;
      bestIds = Array.from(ids);
    }
  }

  const variantIds = bestIds.slice(0, 100);

  const productData = {
    title: `[COST_LOOKUP] temp-${Date.now()}`,
    description: 'Temporary product for cost lookup - will be deleted immediately',
    blueprint_id: blueprintId,
    print_provider_id: printProviderId,
    variants: variantIds.map(id => ({ id, price: 100, is_enabled: true })),
    print_areas: [{
      variant_ids: variantIds,
      placeholders: [{
        position: bestPlacement,
        images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
      }],
    }],
  };

  let tempProductId: string | null = null;
  try {
    const product = await apiRequest<any>(`/shops/${shopId}/products.json`, {
      method: 'POST',
      body: JSON.stringify(productData),
    });
    tempProductId = product.id;
    console.log(`[PrintifyCostLookup] Created temp product ${tempProductId}`);

    const sizeCosts = new Map<string, number[]>();
    for (const variant of product.variants || []) {
      if (typeof variant.cost === 'number' && variant.cost > 0) {
        const size = extractSizeFromTitle(variant.title || '');
        if (size) {
          if (!sizeCosts.has(size)) {
            sizeCosts.set(size, []);
          }
          sizeCosts.get(size)!.push(variant.cost);
        }
      }
    }

    const variantCosts: Record<string, number> = {};
    for (const [size, costs] of Array.from(sizeCosts.entries())) {
      const minCost = Math.min(...costs);
      variantCosts[size] = Math.round(minCost) / 100;
    }

    const baseSizes = ['S', 'M', 'L', 'XL'];
    const baseCostValues = baseSizes
      .filter(s => variantCosts[s] !== undefined)
      .map(s => variantCosts[s]);
    const baseCost = baseCostValues.length > 0 ? Math.min(...baseCostValues) : (Object.values(variantCosts).length > 0 ? Math.min(...Object.values(variantCosts)) : 0);

    const sizeUpcharges: Record<string, number> = {};
    for (const [size, cost] of Object.entries(variantCosts)) {
      const upcharge = Math.round((cost - baseCost) * 100) / 100;
      if (upcharge > 0) {
        sizeUpcharges[size] = upcharge;
      }
    }

    console.log(`[PrintifyCostLookup] Base cost: $${baseCost.toFixed(2)}, sizes: ${Object.keys(variantCosts).length}, upcharges: ${Object.keys(sizeUpcharges).length}`);

    return {
      baseCost,
      variantCosts,
      sizeUpcharges,
      lookupTimestamp: new Date().toISOString(),
      blueprintId,
      printProviderId,
    };
  } finally {
    if (tempProductId) {
      try {
        await apiRequest(`/shops/${shopId}/products/${tempProductId}.json`, { method: 'DELETE' });
        console.log(`[PrintifyCostLookup] Deleted temp product ${tempProductId}`);
      } catch (delErr: any) {
        console.warn(`[PrintifyCostLookup] Failed to delete temp product ${tempProductId}: ${delErr.message}`);
      }
    }
  }
}
