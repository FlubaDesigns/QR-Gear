import { db } from '../core';

  // ============ PRINTFUL CLIENT (No Replit Dependencies) ============

const PRINTFUL_API_BASE = 'https://api.printful.com';

let _cachedPrintfulKey: string | null = null;
let _printfulKeyLastFetch = 0;
const PRINTFUL_KEY_CACHE_TTL = 60000;

async function getPrintfulApiKeyFromFirestore(): Promise<string | null> {
  const now = Date.now();
  if (_cachedPrintfulKey && (now - _printfulKeyLastFetch) < PRINTFUL_KEY_CACHE_TTL) {
    return _cachedPrintfulKey;
  }
  try {
    const doc = await db.collection('system_config').doc('api_keys').get();
    if (doc.exists) {
      const data = doc.data()!;
      if (data.printfulApiKey && data.printfulApiKey.length > 10) {
        _cachedPrintfulKey = data.printfulApiKey;
        _printfulKeyLastFetch = now;
        return _cachedPrintfulKey;
      }
    }
  } catch (e) {}
  return null;
}

function getPrintfulApiKey(): string {
  if (_cachedPrintfulKey) return _cachedPrintfulKey;
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) throw new Error('PRINTFUL_API_KEY not configured');
  return key;
}

async function getPrintfulApiKeyAsync(): Promise<string> {
  const firestoreKey = await getPrintfulApiKeyFromFirestore();
  if (firestoreKey) return firestoreKey;
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) throw new Error('PRINTFUL_API_KEY not configured');
  return key;
}

// Get Printful Store ID - fallback for Cloud Functions environment
function getPrintfulStoreId(): string {
  return process.env.PRINTFUL_STORE_ID || '17456917';
}

interface PrintfulMockupTask {
  task_key: string;
  status: 'pending' | 'completed' | 'failed';
  mockups?: { placement: string; variant_ids: number[]; mockup_url: string; extra?: any[] }[];
  error?: string;
}

interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  image: string;
  price: string;
  in_stock: boolean;
}

class PrintfulClient {
  private async getHeaders() {
    const key = await getPrintfulApiKeyAsync();
    return {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
  }

  get isConfigured(): boolean {
    try {
      if (_cachedPrintfulKey) return true;
      const key = process.env.PRINTFUL_API_KEY;
      return !!key && key.length > 10;
    } catch { return false; }
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${PRINTFUL_API_BASE}${endpoint}`;
    const headers = await this.getHeaders();
    const options: RequestInit = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Printful API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data.result as T;
  }

  async getProduct(productId: number): Promise<{ product: any; variants: PrintfulVariant[] }> {
    return this.request<{ product: any; variants: PrintfulVariant[] }>('GET', `/products/${productId}`);
  }

  async getPrintfiles(productId: number): Promise<any> {
    const storeId = getPrintfulStoreId();
    const storeParam = storeId ? `?store_id=${storeId}` : '';
    return this.request<any>('GET', `/mockup-generator/printfiles/${productId}${storeParam}`);
  }

  async getVariantsByColor(productId: number, colorName: string): Promise<PrintfulVariant[]> {
    const productData = await this.getProduct(productId);
    console.log(`[Printful] Product ${productId} has ${productData?.variants?.length || 0} variants`);
    
    if (!productData?.variants || productData.variants.length === 0) {
      console.log(`[Printful] No variants found for product ${productId}`);
      return [];
    }
    
    const lowerColor = colorName.toLowerCase().replace(/^solid\s+/i, '').trim();
    console.log(`[Printful] Searching for color: "${lowerColor}" in product ${productId}`);
    
    // First try exact and partial matches
    let matches = productData.variants.filter(v => 
      v.color.toLowerCase() === lowerColor || 
      v.color.toLowerCase().includes(lowerColor) ||
      lowerColor.includes(v.color.toLowerCase()) ||
      v.name.toLowerCase().includes(lowerColor)
    );
    
    console.log(`[Printful] Found ${matches.length} exact matches for color "${colorName}"`);
    
    // If no matches and we have variants, fall back to first variant
    if (matches.length === 0 && productData.variants.length > 0) {
      console.log(`[Printful] No exact color match for "${colorName}" in product ${productId}, using first variant: ${productData.variants[0].color}`);
      matches = [productData.variants[0]];
    }
    
    return matches;
  }

  async createMockupTask(
    productId: number,
    variantIds: number[],
    files: Array<{ placement: string; image_url: string; position?: any }>,
    format: 'jpg' | 'png' = 'jpg',
    optionGroups?: string[]
  ): Promise<PrintfulMockupTask> {
    const body: any = { variant_ids: variantIds, format, files };
    if (optionGroups?.length) body.option_groups = optionGroups;
    const storeId = getPrintfulStoreId();
    const storeParam = storeId ? `?store_id=${storeId}` : '';
    console.log('[Printful] Creating mockup task for product', productId, 'store_id:', storeId, 'variant_ids:', variantIds);
    console.log('[Printful] Request body:', JSON.stringify(body));
    return this.request<PrintfulMockupTask>('POST', `/mockup-generator/create-task/${productId}${storeParam}`, body);
  }

  async getMockupTaskResult(taskKey: string): Promise<PrintfulMockupTask> {
    const storeId = getPrintfulStoreId();
    const storeParam = storeId ? `&store_id=${storeId}` : '';
    return this.request<PrintfulMockupTask>('GET', `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}${storeParam}`);
  }

  async waitForMockupTask(taskKey: string, maxWaitMs: number = 60000): Promise<PrintfulMockupTask> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getMockupTaskResult(taskKey);
      if (result.status === 'completed') return result;
      if (result.status === 'failed') throw new Error(`Printful mockup failed: ${result.error}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Printful mockup task timed out after ${maxWaitMs}ms`);
  }
}

const printfulClient = new PrintfulClient();


export function updatePrintfulKeyCache(apiKey: string): void {
  _cachedPrintfulKey = apiKey;
  _printfulKeyLastFetch = Date.now();
}

export { printfulClient, PrintfulClient, getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulApiKeyFromFirestore, getPrintfulStoreId, PRINTFUL_API_BASE, PRINTFUL_KEY_CACHE_TTL };
export type { PrintfulMockupTask, PrintfulVariant };
