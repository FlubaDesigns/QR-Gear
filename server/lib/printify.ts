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
    for (const [placement, variantSet] of placementToVariants) {
      if (variantSet.size === totalVariants) {
        console.log(`[Printify] Found common placement '${placement}' for all ${totalVariants} variants`);
        return { placement, variantIds: allVariantIds };
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
        bestVariantIds = Array.from(variantSet);
      }
    }
    
    if (bestPlacement && bestCoverage > 0) {
      console.log(`[Printify] Best placement '${bestPlacement}' covers ${bestCoverage}/${totalVariants} variants`);
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
        price: 0,
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

// Common color name to hex mapping
function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    'White': '#FFFFFF',
    'Black': '#000000',
    'Navy': '#000080',
    'Navy Blue': '#000080',
    'Royal Blue': '#4169E1',
    'Red': '#DC2626',
    'Heather Gray': '#9CA3AF',
    'Heather Grey': '#9CA3AF',
    'Sport Gray': '#6B7280',
    'Sport Grey': '#6B7280',
    'Dark Heather': '#374151',
    'Charcoal': '#36454F',
    'Natural': '#F5F5DC',
    'Sand': '#C2B280',
    'Khaki': '#C2B280',
    'Brown': '#8B4513',
    'Forest Green': '#228B22',
    'Kelly Green': '#4CBB17',
    'Maroon': '#800000',
    'Cardinal': '#C41E3A',
    'Orange': '#FF6B00',
    'Gold': '#FFD700',
    'Yellow': '#FFFF00',
    'Light Blue': '#ADD8E6',
    'Carolina Blue': '#56A0D3',
    'Pink': '#FFC0CB',
    'Light Pink': '#FFB6C1',
    'Purple': '#800080',
    'Ash': '#B2BEB5',
    'Ice Grey': '#D3D3D3',
    'Irish Green': '#009A44',
    'Military Green': '#4B5320',
    'Olive': '#808000',
    'Sapphire': '#0F52BA',
    'Indigo': '#4B0082',
    'Turf Green': '#3C8D0D',
  };
  
  // Try exact match first
  if (colorMap[colorName]) return colorMap[colorName];
  
  // Try case-insensitive match
  const lowerName = colorName.toLowerCase();
  for (const [key, value] of Object.entries(colorMap)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  
  // Default to a neutral gray if unknown
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
