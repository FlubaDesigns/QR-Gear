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
  private apiKey: string;
  private shopId: string;

  constructor() {
    this.apiKey = process.env.PRINTIFY_API_KEY || '';
    this.shopId = process.env.PRINTIFY_SHOP_ID || '';
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.shopId);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Printify API not configured. Missing API key or Shop ID.');
    }

    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${PRINTIFY_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Printify API error: ${response.status} - ${error}`);
    }

    return response.json();
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

  async getShopProducts(): Promise<{ data: PrintifyProduct[] }> {
    return this.request(`/shops/${this.shopId}/products.json`);
  }

  async getProduct(productId: string): Promise<PrintifyProduct> {
    return this.request(`/shops/${this.shopId}/products/${productId}.json`);
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
    return this.request(`/shops/${this.shopId}/products.json`, {
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
    return this.request(`/shops/${this.shopId}/orders.json`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async submitOrderToProduction(orderId: string): Promise<{ id: string; status: string }> {
    return this.request(`/shops/${this.shopId}/orders/${orderId}/send_to_production.json`, {
      method: 'POST',
    });
  }

  async getOrder(orderId: string): Promise<any> {
    return this.request(`/shops/${this.shopId}/orders/${orderId}.json`);
  }

  async getOrders(): Promise<{ data: any[] }> {
    return this.request(`/shops/${this.shopId}/orders.json`);
  }

  async calculateShipping(orderData: {
    line_items: Array<{ product_id: string; variant_id: number; quantity: number }>;
    address_to: { country: string; region: string; zip: string };
  }): Promise<{ standard: number; express?: number }> {
    return this.request(`/shops/${this.shopId}/orders/shipping.json`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }
}

export const printify = new PrintifyClient();

export async function getUSAPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
  const providers = await printify.getPrintProviders(blueprintId);
  return providers.filter(p => p.location.country === 'US' || p.location.country === 'USA');
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
