import * as fs from 'fs';
import * as path from 'path';

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

interface PrintifyBlueprint {
  id: number;
  title: string;
  description: string;
  brand: string;
  model: string;
  images: string[];
}

interface PrintifyPrintProvider {
  id: number;
  title: string;
  location: {
    address1: string;
    city: string;
    country: string;
    region: string;
    zip: string;
  };
}

interface PrintifyVariant {
  id: number;
  title: string;
  options: {
    color?: string;
    size?: string;
  };
  placeholders: Array<{
    position: string;
    height: number;
    width: number;
  }>;
  price?: number; // Price in cents from Printify catalog
  is_available?: boolean; // Stock status
}

interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  tags: string[];
  options: any[];
  variants: any[];
  images: any[];
  created_at: string;
  updated_at: string;
  visible: boolean;
  is_locked: boolean;
  blueprint_id: number;
  print_provider_id: number;
  print_areas: any[];
  print_details: any[];
  sales_channel_properties: any[];
}

interface PrintifyOrderLineItem {
  product_id: string;
  variant_id: number;
  quantity: number;
  print_areas?: {
    front?: string;
    back?: string;
  };
}

interface PrintifyOrderAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

interface CreateOrderRequest {
  external_id: string;
  label?: string;
  line_items: PrintifyOrderLineItem[];
  shipping_method: number;
  is_printify_express?: boolean;
  send_shipping_notification: boolean;
  address_to: PrintifyOrderAddress;
}

class PrintifyClient {
  private getApiKey(): string {
    // Try env var first, then fallback to file
    let key = (process.env.PRINTIFY_API_KEY || '').trim().replace(/\s+/g, '');
    
    // If env var looks like it has garbage, try file
    if (!key || !key.startsWith('eyJ')) {
      try {
        const tokenPath = path.join(process.cwd(), 'server', 'printify-token.txt');
        if (fs.existsSync(tokenPath)) {
          key = fs.readFileSync(tokenPath, 'utf-8').trim().replace(/\s+/g, '');
        }
      } catch (e) {
        // ignore
      }
    }
    return key;
  }
  
  private getShopId(): string {
    return (process.env.PRINTIFY_SHOP_ID || '').trim().replace(/\s+/g, '');
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
    };
  }

  get isConfigured(): boolean {
    return Boolean(this.getApiKey() && this.getShopId());
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retries = 3): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Printify API not configured. Missing API key or Shop ID.');
    }

    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${PRINTIFY_API_BASE}${endpoint}`;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.headers,
            ...options.headers,
          },
        });

        // If 401/429, wait and retry (unless last attempt)
        if ((response.status === 401 || response.status === 429) && attempt < retries - 1) {
          const waitTime = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          console.log(`Printify API ${response.status}, retrying in ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Printify API error: ${response.status} - ${error}`);
        }

        return response.json();
      } catch (error: any) {
        lastError = error;
        if (attempt < retries - 1) {
          const waitTime = 1000 * Math.pow(2, attempt);
          console.log(`Printify API error, retrying in ${waitTime}ms (attempt ${attempt + 1}/${retries}): ${error.message}`);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }
    
    throw lastError || new Error('Printify API request failed after retries');
  }

  async getShops(): Promise<any[]> {
    return this.request('/shops.json');
  }

  async getCatalogBlueprints(): Promise<PrintifyBlueprint[]> {
    return this.request('/catalog/blueprints.json');
  }

  async getBlueprintDetails(blueprintId: number): Promise<PrintifyBlueprint> {
    return this.request(`/catalog/blueprints/${blueprintId}.json`);
  }

  async getPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
    return this.request(`/catalog/blueprints/${blueprintId}/print_providers.json`);
  }

  async getVariants(blueprintId: number, printProviderId: number): Promise<{ variants: PrintifyVariant[] }> {
    return this.request(`/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`);
  }

  /**
   * Get print areas (placements) available for a blueprint/provider combo.
   * Returns position names like 'front', 'back', 'left', 'right', etc.
   */
  async getPrintAreas(blueprintId: number, printProviderId: number): Promise<{ placeholders: Array<{ position: string; width: number; height: number }> }> {
    return this.request(`/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/shipping.json`)
      .catch(() => {
        // Fallback: try the print_areas endpoint format
        return this.request(`/catalog/print_providers/${printProviderId}/shipping.json`);
      });
  }

  /**
   * Get a placement that works for ALL variants (intersection).
   * Returns the placement name and the variant IDs that support it.
   * Throws if no common placement exists.
   */
  async getCommonPlacement(blueprintId: number, printProviderId: number): Promise<{ placement: string; variantIds: number[] }> {
    const variantsData = await this.request<{ variants: any[] }>(
      `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`
    );
    
    // Build a map: placement -> set of variant IDs that support it
    const placementToVariants = new Map<string, Set<number>>();
    const allVariantIds: number[] = [];
    
    for (const variant of variantsData.variants) {
      allVariantIds.push(variant.id);
      if (variant.placeholders && variant.placeholders.length > 0) {
        for (const placeholder of variant.placeholders) {
          if (placeholder.position) {
            if (!placementToVariants.has(placeholder.position)) {
              placementToVariants.set(placeholder.position, new Set());
            }
            placementToVariants.get(placeholder.position)!.add(variant.id);
          }
        }
      }
    }
    
    // Find a placement that covers ALL variants
    const totalVariants = allVariantIds.length;
    const MAX_VARIANTS = 100; // Printify limit: maximum 100 variants per product
    
    for (const [placement, variantSet] of placementToVariants) {
      if (variantSet.size === totalVariants) {
        // Cap at MAX_VARIANTS to avoid Printify's "Too many variants" error
        const limitedIds = allVariantIds.slice(0, MAX_VARIANTS);
        console.log(`[Printify] Found common placement '${placement}' for ${limitedIds.length}/${totalVariants} variants (capped at ${MAX_VARIANTS})`);
        return { placement, variantIds: limitedIds };
      }
    }
    
    // No placement covers all variants - find the best one (most coverage)
    let bestPlacement = '';
    let bestCoverage = 0;
    let bestVariantIds: number[] = [];
    
    for (const [placement, variantSet] of placementToVariants) {
      if (variantSet.size > bestCoverage) {
        bestCoverage = variantSet.size;
        bestPlacement = placement;
        // Cap at MAX_VARIANTS
        bestVariantIds = Array.from(variantSet).slice(0, MAX_VARIANTS);
      }
    }
    
    if (bestPlacement && bestCoverage > 0) {
      console.log(`[Printify] Best placement '${bestPlacement}' covers ${Math.min(bestCoverage, MAX_VARIANTS)}/${totalVariants} variants`);
      return { placement: bestPlacement, variantIds: bestVariantIds };
    }
    
    // No placements found at all
    throw new Error(`No valid print placements found for blueprint ${blueprintId}. Cannot extract real production costs.`);
  }

  async getShopProducts(): Promise<{ data: PrintifyProduct[] }> {
    return this.request(`/shops/${this.getShopId()}/products.json`);
  }

  async getProduct(productId: string): Promise<PrintifyProduct> {
    return this.request(`/shops/${this.getShopId()}/products/${productId}.json`);
  }

  async createProduct(productData: {
    title: string;
    description: string;
    blueprint_id: number;
    print_provider_id: number;
    variants: Array<{ id: number; price: number; is_enabled: boolean }>;
    print_areas: Array<{
      variant_ids: number[];
      placeholders: Array<{
        position: string;
        images: Array<{
          id: string;
          x: number;
          y: number;
          scale: number;
          angle: number;
        }>;
      }>;
    }>;
  }): Promise<PrintifyProduct> {
    return this.request(`/shops/${this.getShopId()}/products.json`, {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async uploadImage(imageUrl: string, fileName: string): Promise<{ id: string; file_name: string; height: number; width: number }> {
    return this.request(`/uploads/images.json`, {
      method: 'POST',
      body: JSON.stringify({
        file_name: fileName,
        url: imageUrl,
      }),
    });
  }

  async createOrder(orderData: CreateOrderRequest): Promise<{ id: string }> {
    return this.request(`/shops/${this.getShopId()}/orders.json`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async submitOrderToProduction(orderId: string): Promise<{ id: string; status: string }> {
    return this.request(`/shops/${this.getShopId()}/orders/${orderId}/send_to_production.json`, {
      method: 'POST',
    });
  }

  async getOrder(orderId: string): Promise<any> {
    return this.request(`/shops/${this.getShopId()}/orders/${orderId}.json`);
  }

  async getOrders(): Promise<{ data: any[] }> {
    return this.request(`/shops/${this.getShopId()}/orders.json`);
  }

  async calculateShipping(orderData: {
    line_items: Array<{ product_id: string; variant_id: number; quantity: number }>;
    address_to: { country: string; region: string; zip: string };
  }): Promise<{ standard: number; express?: number }> {
    return this.request(`/shops/${this.getShopId()}/orders/shipping.json`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.request(`/shops/${this.getShopId()}/products/${productId}.json`, {
      method: 'DELETE',
    });
  }

  /**
   * Create a placeholder product WITH ONE PRINT to get the true minimum cost.
   * REQUIRES an image ID - will NOT fall back to blank garment cost.
   * 
   * @param blueprintId - The blueprint ID
   * @param printProviderId - The print provider ID  
   * @param variantIds - Array of variant IDs to enable
   * @param imageId - Printify image ID (REQUIRED)
   * @param placement - The print position to use (from getFirstAvailablePlacement)
   */
  async createPlaceholderProduct(
    blueprintId: number,
    printProviderId: number,
    variantIds: number[],
    imageId: string,
    placement: string
  ): Promise<PrintifyProduct> {
    if (!imageId) {
      throw new Error('Image ID is required to get real production costs');
    }
    
    const print_areas = [
      {
        variant_ids: variantIds,
        placeholders: [
          {
            position: placement,
            images: [{ id: imageId, x: 0.5, y: 0.5, scale: 1, angle: 0 }]
          }
        ]
      }
    ];
    
    const productData = {
      title: `[COST_SYNC] Blueprint ${blueprintId}`,
      description: 'Temporary product for cost extraction - will be deleted',
      blueprint_id: blueprintId,
      print_provider_id: printProviderId,
      variants: variantIds.map(id => ({
        id,
        price: 100, // Printify requires price > 0 (100 cents = $1.00 placeholder)
        is_enabled: true,
      })),
      print_areas,
    };

    console.log(`[Printify] Creating placeholder product with '${placement}' placement for real cost...`);
    
    const result = await this.request<PrintifyProduct>(
      `/shops/${this.getShopId()}/products.json`,
      { method: 'POST', body: JSON.stringify(productData) }
    );
    
    console.log(`[Printify] Created placeholder product ${result.id} with '${placement}' placement`);
    return result;
  }

  // Static placeholder image ID - cached after first upload
  private static placeholderImageId: string | null = null;

  /**
   * Get or create a placeholder image for cost extraction.
   * Uses a simple 100x100 QR placeholder image.
   */
  async getOrCreatePlaceholderImage(): Promise<string> {
    if (PrintifyClient.placeholderImageId) {
      return PrintifyClient.placeholderImageId;
    }

    // Upload a programmatically generated QR code PNG
    const base64Png = await this.createSimplePng();
    
    const result = await this.request<{ id: string; file_name: string; height: number; width: number }>(
      `/uploads/images.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          file_name: 'qr-placeholder.png',
          contents: base64Png,
        }),
      }
    );
    
    PrintifyClient.placeholderImageId = result.id;
    console.log(`[Printify] Uploaded placeholder image: ${result.id}`);
    return result.id;
  }

  /**
   * Create a placeholder QR code image as base64 PNG
   */
  private async createSimplePng(): Promise<string> {
    const QRCode = await import('qrcode');
    // Generate a simple QR code as PNG buffer
    const buffer = await QRCode.toBuffer('PLACEHOLDER', {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
    return buffer.toString('base64');
  }

  /**
   * Extract production costs from a product's variants.
   * Returns min/max costs in cents.
   */
  extractCostsFromProduct(product: PrintifyProduct): { minCost: number; maxCost: number } {
    const costs: number[] = [];
    
    for (const variant of product.variants || []) {
      if (typeof variant.cost === 'number' && variant.cost > 0) {
        costs.push(variant.cost);
      }
    }

    if (costs.length === 0) {
      return { minCost: 0, maxCost: 0 };
    }

    return {
      minCost: Math.min(...costs),
      maxCost: Math.max(...costs),
    };
  }

  /**
   * Extract unique colors and sizes from a product's variants.
   * Returns arrays of color objects and size strings.
   */
  extractColorsAndSizes(product: PrintifyProduct): { 
    colors: Array<{ name: string; hex?: string }>; 
    sizes: string[] 
  } {
    const colorMap = new Map<string, { name: string; hex?: string }>();
    const sizeSet = new Set<string>();
    
    // Known size patterns to filter out from colors
    const sizePatterns = new Set(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'XXL', 'XXXL', 'ONE SIZE', 'OS']);
    
    const isSize = (value: string): boolean => {
      return sizePatterns.has(value.toUpperCase().trim());
    };
    
    for (const variant of product.variants || []) {
      // Extract from variant options array
      if (variant.options) {
        for (const opt of variant.options) {
          const value = opt.value || opt.title || '';
          if (!value) continue;
          
          // Check if explicitly typed
          if (opt.type === 'size' || opt.name?.toLowerCase().includes('size')) {
            sizeSet.add(value);
          } else if (opt.type === 'color' || opt.name?.toLowerCase().includes('color')) {
            // Only add if not a size pattern
            if (!isSize(value) && !colorMap.has(value.toLowerCase())) {
              colorMap.set(value.toLowerCase(), { 
                name: value,
                hex: opt.hex || undefined
              });
            }
          }
        }
      }
      
      // Parse from variant title (e.g., "S / White" or "White / S")
      if (variant.title) {
        const parts = variant.title.split('/').map((p: string) => p.trim());
        for (const part of parts) {
          if (!part) continue;
          if (isSize(part)) {
            sizeSet.add(part);
          } else if (!colorMap.has(part.toLowerCase())) {
            colorMap.set(part.toLowerCase(), { name: part });
          }
        }
      }
    }

    // Final filter: remove any size-like values that snuck into colors
    const colors = Array.from(colorMap.values()).filter(c => !isSize(c.name));

    return {
      colors,
      sizes: Array.from(sizeSet),
    };
  }
}

export const printify = new PrintifyClient();

export async function getUSAPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
  const providers = await printify.getPrintProviders(blueprintId);
  return providers.filter(p => p.location.country === 'US' || p.location.country === 'USA');
}

interface PrintArea {
  position: string;
  width: number;
  height: number;
}

interface PlacementInfo {
  position: string;
  label: string;
  printArea: PrintArea;
}

// Fetch available print areas/placements for a blueprint/provider combo
export async function syncProductPlacements(blueprintId: number, printProviderId: number): Promise<{
  placements: PlacementInfo[];
  mockupImageUrl: string | null;
}> {
  try {
    const result = await printify.getVariants(blueprintId, printProviderId);
    const variants = result.variants || [];
    
    // Extract unique placements from variant placeholders
    const placementMap = new Map<string, PlacementInfo>();
    
    for (const variant of variants) {
      if (variant.placeholders) {
        for (const placeholder of variant.placeholders) {
          const position = placeholder.position;
          if (!placementMap.has(position)) {
            placementMap.set(position, {
              position,
              label: formatPlacementLabel(position),
              printArea: {
                position,
                width: placeholder.width,
                height: placeholder.height,
              },
            });
          }
        }
      }
    }
    
    const placements = Array.from(placementMap.values());
    
    // Get blueprint details for mockup image
    const blueprint = await printify.getBlueprintDetails(blueprintId);
    const mockupImageUrl = blueprint.images?.[0] || null;
    
    return { placements, mockupImageUrl };
  } catch (error) {
    console.error('Error syncing product placements:', error);
    return { placements: [], mockupImageUrl: null };
  }
}

// Convert Printify position codes to human-readable labels
function formatPlacementLabel(position: string): string {
  const labelMap: Record<string, string> = {
    'front': 'Front',
    'back': 'Back',
    'left': 'Left Side',
    'right': 'Right Side',
    'front_large': 'Front (Large)',
    'front_small': 'Front (Small)',
    'sleeve_left': 'Left Sleeve',
    'sleeve_right': 'Right Sleeve',
    'pocket': 'Pocket',
    'center': 'Center',
    'front_center': 'Front Center',
    'back_center': 'Back Center',
    'side': 'Side',
    'wraparound': 'Wraparound',
  };
  
  if (labelMap[position]) return labelMap[position];
  
  // Auto-format: replace underscores, capitalize words
  return position
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get provider colors with automatic fallback to Printify API
 * 1. First checks local database (printify_print_providers table)
 * 2. If colors are missing or empty, calls Printify API to fetch them
 * 3. Saves fetched colors to local database for future use
 * 4. Returns colors with hex values
 */
export async function getProviderColorsWithFallback(
  blueprintId: number,
  printProviderId: number,
  storage: any // Passed in to avoid circular dependency
): Promise<Array<{ name: string; hex: string }>> {
  // Step 1: Check local database first
  const localProvider = await storage.getPrintifyPrintProvider(blueprintId, printProviderId);
  
  if (localProvider?.availableColors && Array.isArray(localProvider.availableColors)) {
    const colors = localProvider.availableColors as Array<{ name: string; hex: string }>;
    // Check if colors have hex values
    const hasHexValues = colors.some(c => c.hex);
    if (colors.length > 0 && hasHexValues) {
      console.log(`[ColorFallback] Using local colors for ${blueprintId}/${printProviderId}: ${colors.length} colors`);
      return colors;
    }
  }
  
  // Step 2: Colors not in local database or missing hex - fetch from Printify
  console.log(`[ColorFallback] Local colors missing for ${blueprintId}/${printProviderId}, calling Printify API...`);
  
  try {
    const { colors, sizes } = await syncProductVariants(blueprintId, printProviderId);
    
    // Step 3: Save to local database for future use
    if (colors.length > 0) {
      await storage.updatePrintifyProviderCosts(blueprintId, printProviderId, {
        availableColors: colors,
        availableSizes: sizes,
      });
      console.log(`[ColorFallback] Saved ${colors.length} colors from Printify to local database`);
    }
    
    return colors;
  } catch (error: any) {
    console.error(`[ColorFallback] Printify API call failed: ${error.message}`);
    // Return empty array if API fails
    return [];
  }
}

// Fetch colors and sizes from Printify for a blueprint/provider combo
export async function syncProductVariants(blueprintId: number, printProviderId: number): Promise<{
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  variants: PrintifyVariant[];
}> {
  const result = await printify.getVariants(blueprintId, printProviderId);
  const variants = result.variants || [];
  
  // Extract unique colors with their hex codes
  const colorMap = new Map<string, string>();
  const sizeSet = new Set<string>();
  
  for (const variant of variants) {
    if (variant.options?.color) {
      // Printify color format varies - extract name and try to map hex
      const colorName = variant.options.color;
      if (!colorMap.has(colorName)) {
        // Try to extract hex from variant if available, otherwise use common mapping
        const hex = getColorHex(colorName);
        colorMap.set(colorName, hex);
      }
    }
    if (variant.options?.size) {
      sizeSet.add(variant.options.size);
    }
  }
  
  // Convert to arrays
  const colors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
  
  // Sort sizes in logical order
  const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '11oz', '15oz'];
  const sizes = Array.from(sizeSet).sort((a, b) => {
    const aIdx = sizeOrder.indexOf(a);
    const bIdx = sizeOrder.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
  
  return { colors, sizes, variants };
}

// Comprehensive color name to hex mapping for Printify apparel
function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    // Basic colors
    'White': '#FFFFFF',
    'Black': '#000000',
    'Red': '#DC2626',
    'Blue': '#2563EB',
    'Green': '#16A34A',
    'Yellow': '#FACC15',
    'Orange': '#F97316',
    'Purple': '#9333EA',
    'Pink': '#EC4899',
    'Brown': '#92400E',
    'Gray': '#6B7280',
    'Grey': '#6B7280',
    
    // Heather variants
    'Heather Gray': '#9CA3AF',
    'Heather Grey': '#9CA3AF',
    'Athletic Heather': '#9CA3AF',
    'Dark Heather': '#374151',
    'Dark Grey Heather': '#4B5563',
    'Heather Navy': '#1E3A5F',
    'Heather Peach': '#FBBF94',
    'Heather Mauve': '#C4A5A5',
    'Heather Olive': '#6B7355',
    'Heather Red': '#B91C1C',
    'Heather Blue': '#60A5FA',
    'Heather Green': '#22C55E',
    'Heather Purple': '#A855F7',
    'Heather Prism Dusty Blue': '#7DA7BC',
    'Heather Prism Ice Blue': '#B8D4E3',
    'Heather Prism Mint': '#98E4D2',
    'Heather Prism Peach': '#F5C8A3',
    'Heather Prism Lilac': '#D8B4E2',
    'Heather Raspberry': '#9B1B57',
    'Heather Midnight Navy': '#1E3A5F',
    'Heather True Royal': '#3B5DC9',
    'Heather Deep Teal': '#0D5C63',
    'Heather Forest': '#1D4D2B',
    
    // Sport/Athletic
    'Sport Gray': '#6B7280',
    'Sport Grey': '#6B7280',
    
    // Blues
    'Navy': '#1E3A5F',
    'Navy Blue': '#1E3A5F',
    'Midnight Navy': '#1A2744',
    'True Navy': '#1E3A5F',
    'Royal': '#4169E1',
    'Royal Blue': '#4169E1',
    'True Royal': '#4169E1',
    'Light Blue': '#93C5FD',
    'Sky Blue': '#87CEEB',
    'Carolina Blue': '#56A0D3',
    'Ocean': '#006994',
    'Ocean Blue': '#006994',
    'Teal': '#0D9488',
    'Deep Teal': '#0D5C63',
    'Sapphire': '#0F52BA',
    'Indigo': '#4B0082',
    'Aqua': '#06B6D4',
    'Turquoise': '#40E0D0',
    'Cobalt': '#0047AB',
    'Steel Blue': '#4682B4',
    'Slate': '#708090',
    'Denim': '#1560BD',
    
    // Greens
    'Forest Green': '#228B22',
    'Dark Green': '#006400',
    'Kelly Green': '#4CBB17',
    'Irish Green': '#009A44',
    'Turf Green': '#3C8D0D',
    'Military Green': '#4B5320',
    'Olive': '#6B8E23',
    'Olive Drab': '#6B8E23',
    'Sage': '#9CAF88',
    'Mint': '#98FB98',
    'Seafoam': '#71EEB8',
    'Lime': '#84CC16',
    'Leaf': '#568203',
    'Hunter Green': '#355E3B',
    
    // Reds & Pinks
    'Cardinal': '#C41E3A',
    'Cardinal Red': '#C41E3A',
    'Maroon': '#800000',
    'Burgundy': '#722F37',
    'Crimson': '#DC143C',
    'Cherry Red': '#DE3163',
    'Light Pink': '#FFB6C1',
    'Hot Pink': '#FF69B4',
    'Fuchsia': '#FF00FF',
    'Magenta': '#FF00FF',
    'Berry': '#8E4585',
    'Coral': '#FF7F50',
    'Salmon': '#FA8072',
    'Rose': '#FF007F',
    'Heliconia': '#E31557',
    'Azalea': '#FF3399',
    
    // Purples
    'Violet': '#8B5CF6',
    'Lavender': '#E6E6FA',
    'Plum': '#8E4585',
    'Lilac': '#C8A2C8',
    'Orchid': '#DA70D6',
    'Purple Rush': '#652DC1',
    'Team Purple': '#652DC1',
    
    // Browns & Neutrals
    'Charcoal': '#36454F',
    'Natural': '#F5F5DC',
    'Cream': '#FFFDD0',
    'Solid Cream': '#FFFDD0',
    'Beige': '#F5F5DC',
    'Sand': '#C2B280',
    'Tan': '#D2B48C',
    'Khaki': '#C3B091',
    'Chocolate': '#7B3F00',
    'Dark Chocolate': '#3D1C02',
    'Solid Dark Chocolate': '#3D1C02',
    'Coffee': '#6F4E37',
    'Espresso': '#3C2218',
    'Chestnut': '#954535',
    'Coyote Brown': '#81613C',
    'Russet': '#80461B',
    
    // Grays
    'Ice Grey': '#D3D3D3',
    'Ice Gray': '#D3D3D3',
    'Light Gray': '#D1D5DB',
    'Light Grey': '#D1D5DB',
    'Silver': '#C0C0C0',
    'Ash': '#B2BEB5',
    'Graphite': '#383838',
    'Charcoal Heather': '#4B5563',
    'Heavy Metal': '#2E3339',
    'Solid Heavy Metal': '#2E3339',
    'Smoke': '#738276',
    'Storm': '#4F5D75',
    
    // Golds & Yellows
    'Gold': '#FFD700',
    'Daisy': '#FFD93D',
    'Sunshine': '#FFD93D',
    'Lemon': '#FFF44F',
    'Banana': '#FFE135',
    'Mustard': '#FFDB58',
    'Honey': '#EB9605',
    
    // Oranges
    'Burnt Orange': '#CC5500',
    'Tangerine': '#FF9966',
    'Sunset': '#FAD6A5',
    'Peach': '#FFCBA4',
    'Apricot': '#FBCEB1',
    'Tennessee Orange': '#FF8200',
    'Texas Orange': '#BF5700',
    
    // Solid prefix variants (Printify uses these)
    'Solid Black': '#000000',
    'Solid White': '#FFFFFF',
    'Solid Red': '#DC2626',
    'Solid Navy': '#1E3A5F',
    'Solid Natural': '#F5F5DC',
    'Solid Kelly Green': '#4CBB17',
    'Solid Light Blue': '#93C5FD',
    'Solid Light Grey': '#D1D5DB',
    'Solid Light Gray': '#D1D5DB',
    'Solid Light Pink': '#FFB6C1',
    'Solid Midnight Navy': '#1A2744',
    'Solid Military Green': '#4B5320',
    'Solid Purple Rush': '#652DC1',
    'Solid Royal': '#4169E1',
    'Solid Turquoise': '#40E0D0',
    'Solid Cardinal Red': '#C41E3A',
  };
  
  // Try exact match first
  if (colorMap[colorName]) return colorMap[colorName];
  
  // Try case-insensitive match
  const lowerName = colorName.toLowerCase();
  for (const [key, value] of Object.entries(colorMap)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  
  // Try partial match for compound names (e.g., "Heather Prism Dusty Blue" matches "Dusty Blue")
  for (const [key, value] of Object.entries(colorMap)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return value;
    }
  }
  
  // Intelligent fallback based on color keywords in name
  if (lowerName.includes('black')) return '#000000';
  if (lowerName.includes('white')) return '#FFFFFF';
  if (lowerName.includes('navy')) return '#1E3A5F';
  if (lowerName.includes('red')) return '#DC2626';
  if (lowerName.includes('blue')) return '#2563EB';
  if (lowerName.includes('green')) return '#16A34A';
  if (lowerName.includes('yellow')) return '#FACC15';
  if (lowerName.includes('orange')) return '#F97316';
  if (lowerName.includes('purple')) return '#9333EA';
  if (lowerName.includes('pink')) return '#EC4899';
  if (lowerName.includes('gray') || lowerName.includes('grey')) return '#6B7280';
  if (lowerName.includes('brown') || lowerName.includes('chocolate')) return '#92400E';
  if (lowerName.includes('heather')) return '#9CA3AF';
  
  // Default to neutral gray for truly unknown colors
  return '#808080';
}

// Category detection from product title/brand
function detectCategory(title: string, brand: string): string {
  const combined = `${title} ${brand}`.toLowerCase();
  
  if (combined.includes('hat') || combined.includes('cap') || combined.includes('beanie')) {
    return 'hats';
  }
  if (combined.includes('mug') || combined.includes('cup') || combined.includes('tumbler')) {
    return 'drinkware';
  }
  if (combined.includes('bag') || combined.includes('tote') || combined.includes('backpack')) {
    return 'bags';
  }
  if (combined.includes('hoodie') || combined.includes('sweatshirt')) {
    return 'hoodies';
  }
  if (combined.includes('tank')) {
    return 'tanks';
  }
  if (combined.includes('polo')) {
    return 'polos';
  }
  if (combined.includes('long sleeve')) {
    return 'long-sleeves';
  }
  if (combined.includes('shirt') || combined.includes('tee') || combined.includes('t-shirt')) {
    return 't-shirts';
  }
  if (combined.includes('sticker') || combined.includes('decal')) {
    return 'stickers';
  }
  if (combined.includes('poster') || combined.includes('print') || combined.includes('canvas')) {
    return 'wall-art';
  }
  if (combined.includes('phone') || combined.includes('case')) {
    return 'phone-cases';
  }
  
  return 'other';
}

export type { 
  PrintifyBlueprint, 
  PrintifyPrintProvider, 
  PrintifyVariant, 
  PrintifyProduct,
  PrintifyOrderLineItem,
  PrintifyOrderAddress,
  CreateOrderRequest
};

export { detectCategory };
