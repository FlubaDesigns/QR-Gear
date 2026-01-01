/**
 * Printful API Client
 * Used specifically for mockup generation since Printify cannot render mockups for unpublished products.
 * Printful has a dedicated Mockup Generator API that works without publishing.
 */

const PRINTFUL_API_BASE = 'https://api.printful.com';

interface PrintfulMockupTask {
  task_key: string;
  status: 'pending' | 'completed' | 'failed';
  mockups?: PrintfulMockupResult[];
  printfiles?: any[];
  error?: string;
}

interface PrintfulMockupResult {
  placement: string;
  variant_ids: number[];
  mockup_url: string;
  extra?: any[];
}

interface PrintfulProduct {
  id: number;
  type: string;
  type_name: string;
  brand: string;
  model: string;
  image: string;
  variant_count: number;
  currency: string;
  files: any[];
  options: any[];
  dimensions: any;
  is_discontinued: boolean;
  avg_fulfillment_time: number;
  techniques: any[];
  origin_country: string;
}

interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  color_code2?: string;
  image: string;
  price: string;
  in_stock: boolean;
  availability_status: string;
}

interface PrintfulPrintfile {
  printfile_id: number;
  width: number;
  height: number;
  dpi: number;
  fill_mode: string;
  can_rotate: boolean;
}

interface PrintfulPlacement {
  placement: string;
  technique: string;
  printfile_id?: number;
}

class PrintfulClient {
  private getApiKey(): string {
    return (process.env.PRINTFUL_API_KEY || '').trim();
  }

  private getStoreId(): string {
    return (process.env.PRINTFUL_STORE_ID || '').trim();
  }

  private get headers() {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
    };
    
    // Add store ID header for endpoints that require it
    const storeId = this.getStoreId();
    if (storeId) {
      headers['X-PF-Store-Id'] = storeId;
    }
    
    return headers;
  }

  get isConfigured(): boolean {
    const key = this.getApiKey();
    return !!key && key.length > 10;
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${PRINTFUL_API_BASE}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: this.headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Printful API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.result as T;
  }

  /**
   * Get all available Printful products (catalog)
   */
  async getProducts(): Promise<PrintfulProduct[]> {
    return this.request<PrintfulProduct[]>('GET', '/products');
  }

  /**
   * Get a specific product by ID
   */
  async getProduct(productId: number): Promise<{ product: PrintfulProduct; variants: PrintfulVariant[] }> {
    return this.request<{ product: PrintfulProduct; variants: PrintfulVariant[] }>('GET', `/products/${productId}`);
  }

  /**
   * Get printfile specifications for a product variant
   * This tells us the correct image dimensions and placements
   */
  async getPrintfiles(productId: number): Promise<any> {
    return this.request<any>('GET', `/mockup-generator/printfiles/${productId}`);
  }

  /**
   * Create a mockup generation task
   * This is the core function - generates rendered mockups with artwork on products
   */
  async createMockupTask(
    productId: number,
    variantIds: number[],
    files: Array<{
      placement: string;
      image_url: string;
      position?: { area_width: number; area_height: number; width: number; height: number; top: number; left: number };
    }>,
    format: 'jpg' | 'png' = 'jpg',
    optionGroups?: string[]
  ): Promise<PrintfulMockupTask> {
    const body: any = {
      variant_ids: variantIds,
      format,
      files,
    };
    
    // Request lifestyle mockups if option groups specified
    if (optionGroups && optionGroups.length > 0) {
      body.option_groups = optionGroups;
    }

    console.log('[Printful] Creating mockup task for product', productId, 'variants:', variantIds, 'option_groups:', optionGroups);
    
    return this.request<PrintfulMockupTask>('POST', `/mockup-generator/create-task/${productId}`, body);
  }

  /**
   * Get the result of a mockup generation task
   */
  async getMockupTaskResult(taskKey: string): Promise<PrintfulMockupTask> {
    return this.request<PrintfulMockupTask>('GET', `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`);
  }

  /**
   * Poll for mockup task completion with timeout
   */
  async waitForMockupTask(taskKey: string, maxWaitMs: number = 60000, pollIntervalMs: number = 2000): Promise<PrintfulMockupTask> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getMockupTaskResult(taskKey);
      
      if (result.status === 'completed') {
        console.log('[Printful] Mockup task completed:', taskKey);
        return result;
      }
      
      if (result.status === 'failed') {
        throw new Error(`Printful mockup task failed: ${result.error || 'Unknown error'}`);
      }
      
      // Still pending, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    throw new Error(`Printful mockup task timed out after ${maxWaitMs}ms`);
  }

  /**
   * Generate mockups for a product variant with artwork
   * This is the high-level function that creates a task and waits for results
   */
  async generateMockup(
    productId: number,
    variantIds: number[],
    artworkUrl: string,
    placement: string = 'front',
    format: 'jpg' | 'png' = 'jpg'
  ): Promise<PrintfulMockupResult[]> {
    if (!this.isConfigured) {
      throw new Error('Printful API key not configured');
    }

    console.log(`[Printful] Generating mockup for product ${productId}, placement: ${placement}`);
    console.log(`[Printful] Artwork URL: ${artworkUrl}`);

    // Create the mockup task
    const task = await this.createMockupTask(
      productId,
      variantIds,
      [{ placement, image_url: artworkUrl }],
      format
    );

    if (!task.task_key) {
      throw new Error('Printful did not return a task key');
    }

    console.log(`[Printful] Task created: ${task.task_key}, status: ${task.status}`);

    // If already completed (unlikely but possible), return immediately
    if (task.status === 'completed' && task.mockups) {
      return task.mockups;
    }

    // Poll for completion
    const result = await this.waitForMockupTask(task.task_key);
    
    if (!result.mockups || result.mockups.length === 0) {
      throw new Error('Printful mockup task completed but returned no mockups');
    }

    return result.mockups;
  }

  /**
   * Search for a Printful product that matches a Printify blueprint
   * This is used for the mapping between the two providers
   */
  async findMatchingProduct(brand: string, model: string): Promise<PrintfulProduct | null> {
    try {
      const products = await this.getProducts();
      
      // Try exact match first
      let match = products.find(p => 
        p.brand.toLowerCase() === brand.toLowerCase() && 
        p.model.toLowerCase() === model.toLowerCase()
      );
      
      if (match) return match;
      
      // Try partial match on model
      match = products.find(p => 
        p.model.toLowerCase().includes(model.toLowerCase()) ||
        model.toLowerCase().includes(p.model.toLowerCase())
      );
      
      return match || null;
    } catch (error) {
      console.error('[Printful] Error finding matching product:', error);
      return null;
    }
  }

  /**
   * Common color name synonyms between Printify and Printful
   */
  private colorSynonyms: Record<string, string[]> = {
    'heather grey': ['sport grey', 'athletic heather', 'heather gray'],
    'sport grey': ['heather grey', 'heather gray', 'athletic heather'],
    'solid black': ['black'],
    'black': ['solid black'],
    'solid white': ['white'],
    'white': ['solid white'],
    'navy': ['navy blue', 'dark navy', 'midnight navy'],
    'navy blue': ['navy', 'dark navy', 'midnight navy'],
    'midnight navy': ['navy', 'navy blue', 'dark navy'],
    'heather': ['heather grey', 'sport grey'],
    // Blue variants - Printify uses "Solid Cool Blue", Printful uses "Royal"
    'cool blue': ['royal', 'true royal', 'royal blue'],
    'solid cool blue': ['royal', 'true royal', 'royal blue', 'cool blue'],
    'solid royal': ['royal', 'true royal', 'royal blue'],
    'royal': ['solid royal', 'true royal', 'royal blue', 'cool blue'],
    // Tahiti/Turquoise/Teal variants
    'tahiti blue': ['teal', 'turquoise', 'aqua', 'ocean blue', 'tropical blue'],
    'solid tahiti blue': ['teal', 'turquoise', 'aqua', 'ocean blue', 'tropical blue'],
    'solid turquoise': ['turquoise', 'teal', 'aqua'],
    'turquoise': ['solid turquoise', 'teal', 'aqua'],
    // Military/Army green
    'solid military green': ['military green', 'army', 'olive', 'army green'],
    'military green': ['solid military green', 'army', 'olive', 'army green'],
    // Red variants
    'solid red': ['red', 'true red', 'cardinal'],
    'red': ['solid red', 'true red', 'cardinal'],
    // Light blue variants
    'solid light blue': ['light blue', 'baby blue', 'sky blue', 'carolina blue'],
    'light blue': ['solid light blue', 'baby blue', 'sky blue', 'carolina blue'],
    // Forest/Kelly green
    'solid forest green': ['forest green', 'forest', 'kelly green'],
    'solid kelly green': ['kelly green', 'kelly', 'forest green'],
    // Purple variants
    'solid purple rush': ['purple', 'purple rush', 'team purple'],
    'purple': ['solid purple rush', 'purple rush', 'team purple'],
    // Maroon
    'solid maroon': ['maroon', 'burgundy', 'wine'],
    'maroon': ['solid maroon', 'burgundy', 'wine'],
  };

  /**
   * Get variants for a product, optionally filtered by color
   * Includes synonym matching for cross-provider compatibility
   */
  async getVariantsByColor(productId: number, colorName?: string): Promise<PrintfulVariant[]> {
    const { variants } = await this.getProduct(productId);
    
    if (!colorName) return variants;
    
    // Strip "Solid " prefix that Printify uses but Printful doesn't
    const strippedColor = colorName.toLowerCase().replace(/^solid\s+/i, '');
    const originalColor = colorName.toLowerCase();
    
    // Build list of colors to try (original + stripped + synonyms)
    const colorsToTry = new Set<string>([originalColor, strippedColor]);
    
    // Add synonyms for both original and stripped versions
    const originalSynonyms = this.colorSynonyms[originalColor];
    const strippedSynonyms = this.colorSynonyms[strippedColor];
    if (originalSynonyms) originalSynonyms.forEach(s => colorsToTry.add(s));
    if (strippedSynonyms) strippedSynonyms.forEach(s => colorsToTry.add(s));
    
    const colorsArray = Array.from(colorsToTry);
    
    const matches = variants.filter(v => {
      const variantColor = v.color.toLowerCase();
      const variantColorNormalized = variantColor.replace(/\s+/g, '');
      
      return colorsArray.some(c => {
        const cNormalized = c.replace(/\s+/g, '');
        return variantColorNormalized === cNormalized || 
               variantColorNormalized.includes(cNormalized) ||
               cNormalized.includes(variantColorNormalized);
      });
    });
    
    // Log for debugging
    if (matches.length === 0) {
      console.log(`[Printful] Color "${colorName}" not found. Tried: ${colorsArray.join(', ')}`);
      const uniqueColors = Array.from(new Set(variants.map(v => v.color)));
      console.log(`[Printful] Available colors: ${uniqueColors.join(', ')}`);
    }
    
    return matches;
  }

  /**
   * Create an order in Printful
   */
  async createOrder(orderData: {
    recipient: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      state_code: string;
      country_code: string;
      zip: string;
      phone?: string;
      email?: string;
    };
    items: Array<{
      variant_id: number;
      quantity: number;
      files: Array<{
        type: string;
        url: string;
        position?: any;
      }>;
    }>;
    external_id?: string;
    shipping?: string;
  }): Promise<any> {
    console.log('[Printful] Creating order:', JSON.stringify(orderData, null, 2));
    return this.request<any>('POST', '/orders', orderData);
  }

  /**
   * Get order status
   */
  async getOrder(orderId: string | number): Promise<any> {
    return this.request<any>('GET', `/orders/${orderId}`);
  }

  /**
   * Confirm a draft order (submit for fulfillment)
   */
  async confirmOrder(orderId: string | number): Promise<any> {
    console.log('[Printful] Confirming order:', orderId);
    return this.request<any>('POST', `/orders/${orderId}/confirm`);
  }

  /**
   * Estimate shipping costs
   */
  async estimateShipping(recipient: {
    address1: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
  }, items: Array<{ variant_id: number; quantity: number }>): Promise<any> {
    return this.request<any>('POST', '/shipping/rates', { recipient, items });
  }
}

export const printfulClient = new PrintfulClient();
export type { PrintfulProduct, PrintfulVariant, PrintfulMockupResult, PrintfulMockupTask };

/**
 * Sync Printful catalog to local database
 * This populates the printful_products and printful_variants tables
 */
export async function syncPrintfulCatalog(db: any, options?: { productIds?: number[] }): Promise<{
  productsAdded: number;
  productsUpdated: number;
  variantsAdded: number;
  variantsUpdated: number;
  errors: string[];
}> {
  const { printfulProducts, printfulVariants } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');
  
  const result = {
    productsAdded: 0,
    productsUpdated: 0,
    variantsAdded: 0,
    variantsUpdated: 0,
    errors: [] as string[],
  };

  if (!printfulClient.isConfigured) {
    result.errors.push('Printful API key not configured');
    return result;
  }

  try {
    console.log('[Printful Sync] Starting catalog sync...');
    
    // Get all products from Printful
    const allProducts = await printfulClient.getProducts();
    const productsToSync = options?.productIds 
      ? allProducts.filter(p => options.productIds!.includes(p.id))
      : allProducts;
    
    console.log(`[Printful Sync] Found ${productsToSync.length} products to sync`);

    for (const product of productsToSync) {
      try {
        // Check if product exists
        const existing = await db.select().from(printfulProducts).where(eq(printfulProducts.id, product.id)).limit(1);
        
        // Get detailed product info with variants
        const details = await printfulClient.getProduct(product.id);
        
        // Get printfile info for dimensions
        let printfileInfo: any = null;
        try {
          printfileInfo = await printfulClient.getPrintfiles(product.id);
        } catch (e) {
          // Some products don't support printfiles
        }

        const productData = {
          id: product.id,
          type: product.type,
          typeName: product.type_name,
          brand: product.brand || null,
          model: product.model || null,
          title: details.product.type_name || product.type_name,
          image: product.image || null,
          variantCount: details.variants.length,
          currency: product.currency || 'USD',
          minPrice: details.variants.length > 0 ? Math.min(...details.variants.map(v => parseFloat(v.price))).toString() : null,
          maxPrice: details.variants.length > 0 ? Math.max(...details.variants.map(v => parseFloat(v.price))).toString() : null,
          printfileWidth: printfileInfo?.printfiles?.[0]?.width || null,
          printfileHeight: printfileInfo?.printfiles?.[0]?.height || null,
          printfileDpi: printfileInfo?.printfiles?.[0]?.dpi || null,
          avgFulfillmentTime: product.avg_fulfillment_time || null,
          originCountry: product.origin_country || null,
          isDiscontinued: product.is_discontinued || false,
          availablePlacements: printfileInfo?.available_placements?.map((p: any) => p.placement) || null,
          lastSyncedAt: new Date(),
        };

        if (existing.length > 0) {
          await db.update(printfulProducts).set(productData).where(eq(printfulProducts.id, product.id));
          result.productsUpdated++;
        } else {
          await db.insert(printfulProducts).values(productData);
          result.productsAdded++;
        }

        // Sync variants
        for (const variant of details.variants) {
          const existingVariant = await db.select().from(printfulVariants).where(eq(printfulVariants.id, variant.id)).limit(1);
          
          const variantData = {
            id: variant.id,
            productId: product.id,
            name: variant.name,
            size: variant.size || null,
            color: variant.color || null,
            colorCode: variant.color_code || null,
            colorCode2: variant.color_code2 || null,
            image: variant.image || null,
            price: variant.price,
            inStock: variant.in_stock !== false,
            availabilityStatus: variant.availability_status || 'active',
            lastSyncedAt: new Date(),
          };

          if (existingVariant.length > 0) {
            await db.update(printfulVariants).set(variantData).where(eq(printfulVariants.id, variant.id));
            result.variantsUpdated++;
          } else {
            await db.insert(printfulVariants).values(variantData);
            result.variantsAdded++;
          }
        }

        // Rate limiting - Printful has 120 requests/min limit
        // Each product makes ~3 API calls, so wait 2 seconds between products
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (productError: any) {
        console.error(`[Printful Sync] Error syncing product ${product.id}:`, productError.message);
        result.errors.push(`Product ${product.id}: ${productError.message}`);
      }
    }

    console.log(`[Printful Sync] Complete - Products: ${result.productsAdded} added, ${result.productsUpdated} updated`);
    console.log(`[Printful Sync] Complete - Variants: ${result.variantsAdded} added, ${result.variantsUpdated} updated`);
    
  } catch (error: any) {
    console.error('[Printful Sync] Fatal error:', error.message);
    result.errors.push(`Fatal error: ${error.message}`);
  }

  return result;
}
