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
    format: 'jpg' | 'png' = 'jpg'
  ): Promise<PrintfulMockupTask> {
    const body = {
      variant_ids: variantIds,
      format,
      files,
    };

    console.log('[Printful] Creating mockup task for product', productId, 'variants:', variantIds);
    
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
   * Get variants for a product, optionally filtered by color
   */
  async getVariantsByColor(productId: number, colorName?: string): Promise<PrintfulVariant[]> {
    const { variants } = await this.getProduct(productId);
    
    if (!colorName) return variants;
    
    // Normalize color name for matching
    const normalizedColor = colorName.toLowerCase().replace(/\s+/g, '');
    
    return variants.filter(v => {
      const variantColor = v.color.toLowerCase().replace(/\s+/g, '');
      return variantColor === normalizedColor || 
             variantColor.includes(normalizedColor) ||
             normalizedColor.includes(variantColor);
    });
  }
}

export const printfulClient = new PrintfulClient();
export type { PrintfulProduct, PrintfulVariant, PrintfulMockupResult, PrintfulMockupTask };
