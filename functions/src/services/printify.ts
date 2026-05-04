import { admin, db } from '../core';

  // ============ PRINTIFY CLIENT (Order Fulfillment) ============

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

// Get Printify API key - fallback for Cloud Functions environment
function getPrintifyApiKey(): string {
  return process.env.PRINTIFY_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6ImFiM2JkYjFlZTk2ZmFkYWI0ZTg5NzBlYjM3YjZlYjI0ZWUwZDM5YTkwMDk0ZjE1ZGIwNzZjZWRhY2Y5ZjU1MjQ5M2RhNzMyYzI1ZTNiNGNkIiwiaWF0IjoxNzY3ODExMzQ5LjA2MjgzOSwibmJmIjoxNzY3ODExMzQ5LjA2Mjg0MSwiZXhwIjoxNzk5MzQ3MzQ5LjA1NjU0LCJzdWIiOiIyMTA3MDg5MiIsInNjb3BlcyI6WyJzaG9wcy5tYW5hZ2UiLCJzaG9wcy5yZWFkIiwiY2F0YWxvZy5yZWFkIiwib3JkZXJzLnJlYWQiLCJvcmRlcnMud3JpdGUiLCJwcm9kdWN0cy5yZWFkIiwicHJvZHVjdHMud3JpdGUiLCJ3ZWJob29rcy5yZWFkIiwid2ViaG9va3Mud3JpdGUiLCJ1cGxvYWRzLnJlYWQiLCJ1cGxvYWRzLndyaXRlIiwicHJpbnRfcHJvdmlkZXJzLnJlYWQiLCJ1c2VyLmluZm8iXX0.GR2_7kqoGmuJTw_0bGOfsFuanPEOpwy7M4iGgQ7x25a7Bh4-5vJ8E5xX46CLV3IRs8j24roKrB9p47cmfX1FSv-oIyv-Zlzc5WjIQDq-Y3US8fCedLqNgP3-mokMCaRi9LVdMtH8c9PQ_WkHsHCK6W21iVpebz5NEYkf0Pf4aUekwZBoQvrF1VloYdF6EqEp92AJZ-rO_o3h--_kV_lifjoS5eAzD5lkwJjYp5Q9j6Io-WwM1B32GOhPiNJv-Dp7FJb05nsoSiXBW9i8UuejYhSvcuI487_gbz4tKvyjreFNAUtP9JhuAYvrwDrTwV01qicKl18qP_bbaQSMqfagBMqNE9cl7-eOhX48yCp9CEKoSrhUSsdSvKChYuLinQ89g7RBbrra-q7RzjcE7bpv_7Mn7HUHO8rX6Wg8ZxWI4rxEixCUqt1YEBJ9kfFMUL4IZUM-qcu-vXdZ8GPqfymD27GV7XzFYmrWkm7fKGjFvkbuOL5u9ZeVdzJlJtnk_yztg4AUwSHtZCiAMueWLNRmUrMVQWuYiQptfXdexujBK9aaBlOcdAAX8PEIaicqHSyLlROsuiK_ZRPRRLwGwU45Coe-e_GgaKBpq8lPTHvU0j9F_L45Y9HY4gXHQvTkNM5wcPfoMAvcz2rwPGzZyvi3ejuaEP4lSCfUi-Wiozkfdiw';
}

// Get Printify Shop ID - fallback for Cloud Functions environment
function getPrintifyShopId(): string {
  return (process.env.PRINTIFY_SHOP_ID || '19642701').trim();
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

interface PrintifyOrderLineItem {
  product_id: string;
  variant_id: number;
  quantity: number;
  print_areas?: any;
}

interface CreatePrintifyOrderRequest {
  external_id: string;
  label?: string;
  line_items: PrintifyOrderLineItem[];
  shipping_method: number;
  send_shipping_notification: boolean;
  address_to: PrintifyOrderAddress;
}

class PrintifyClient {
  private get headers() {
    return {
      'Authorization': `Bearer ${getPrintifyApiKey()}`,
      'Content-Type': 'application/json',
    };
  }

  get isConfigured(): boolean {
    const key = getPrintifyApiKey();
    const shopId = getPrintifyShopId();
    return !!key && key.length > 10 && !!shopId;
  }

  private async request<T>(method: string, endpoint: string, body?: any, timeoutMs = 15000): Promise<T> {
    const url = `${PRINTIFY_API_BASE}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const options: RequestInit = { method, headers: this.headers, signal: controller.signal };
    if (body) options.body = JSON.stringify(body);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Printify API error: ${response.status} - ${errorText}`);
      }
      return response.json() as Promise<T>;
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error(`Printify request timed out after ${timeoutMs}ms: ${endpoint}`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async createOrder(orderRequest: CreatePrintifyOrderRequest): Promise<{ id: string }> {
    const shopId = getPrintifyShopId();
    return this.request<{ id: string }>('POST', `/shops/${shopId}/orders.json`, orderRequest);
  }

  async submitOrderToProduction(orderId: string): Promise<void> {
    const shopId = getPrintifyShopId();
    await this.request<void>('POST', `/shops/${shopId}/orders/${orderId}/send_to_production.json`, {});
  }

  async getOrder(orderId: string): Promise<any> {
    const shopId = getPrintifyShopId();
    return this.request<any>('GET', `/shops/${shopId}/orders/${orderId}.json`);
  }

  async getOrders(): Promise<any[]> {
    const shopId = getPrintifyShopId();
    const result = await this.request<{ data: any[] }>('GET', `/shops/${shopId}/orders.json`);
    return result.data || [];
  }

  async getCatalogBlueprints(): Promise<any[]> {
    return this.request<any[]>('GET', '/catalog/blueprints.json');
  }

  async getBlueprintDetails(blueprintId: number): Promise<any> {
    return this.request<any>('GET', `/catalog/blueprints/${blueprintId}.json`);
  }

  async getPrintProviders(blueprintId: number): Promise<any[]> {
    return this.request<any[]>('GET', `/catalog/blueprints/${blueprintId}/print_providers.json`);
  }

  async getAllPrintProviders(): Promise<any[]> {
    return this.request<any[]>('GET', '/catalog/print_providers.json');
  }

  async getVariants(blueprintId: number, printProviderId: number): Promise<any> {
    return this.request<any>('GET', `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`);
  }

  async uploadImage(fileName: string, url: string): Promise<{ id: string; preview_url: string }> {
    return this.request<{ id: string; preview_url: string }>('POST', '/uploads/images.json', { file_name: fileName, url });
  }

  async createProduct(product: {
    title: string;
    description: string;
    blueprint_id: number;
    print_provider_id: number;
    variants: Array<{ id: number; price: number; is_enabled: boolean }>;
    print_areas: Array<{
      variant_ids: number[];
      placeholders: Array<{
        position: string;
        images: Array<{ id: string; x: number; y: number; scale: number; angle: number }>;
      }>;
    }>;
  }): Promise<{ id: string }> {
    const shopId = getPrintifyShopId();
    return this.request<{ id: string }>('POST', `/shops/${shopId}/products.json`, product);
  }

  async publishProduct(productId: string): Promise<void> {
    const shopId = getPrintifyShopId();
    await this.request<void>('POST', `/shops/${shopId}/products/${productId}/publish.json`, {
      title: true,
      description: true,
      images: true,
      variants: true,
      tags: true,
      keyFeatures: true,
      shipping_template: true,
    });
  }

  async getProduct(productId: string): Promise<any> {
    const shopId = getPrintifyShopId();
    return this.request<any>('GET', `/shops/${shopId}/products/${productId}.json`);
  }

  async updateProduct(productId: string, updates: {
    print_areas?: Array<{
      variant_ids: number[];
      placeholders: Array<{
        position: string;
        images: Array<{ id: string; x: number; y: number; scale: number; angle: number }>;
      }>;
    }>;
  }): Promise<void> {
    const shopId = getPrintifyShopId();
    await this.request<void>('PUT', `/shops/${shopId}/products/${productId}.json`, updates);
  }
}

const printifyClient = new PrintifyClient();

// ============ ORDER FULFILLMENT HELPERS ============

interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  zip: string;
  country: string;
}

async function submitOrderToPrintify(
  orderId: string,
  shippingAddress: ShippingAddress
): Promise<{ success: boolean; printifyOrderId?: string; error?: string }> {
  try {
    if (!printifyClient.isConfigured) {
      return { success: false, error: 'Printify API not configured (missing API key or shop ID)' };
    }

    // Get the order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return { success: false, error: 'Order not found' };
    }
    const order = orderDoc.data()!;

    // Check if already submitted
    if (order.printifyOrderId) {
      return { success: true, printifyOrderId: order.printifyOrderId };
    }

    // Get order items
    const orderItemsSnapshot = await db.collection('orderItems')
      .where('orderId', '==', orderId)
      .get();
    
    if (orderItemsSnapshot.empty) {
      return { success: false, error: 'No order items found' };
    }

    const lineItems: PrintifyOrderLineItem[] = [];
    
    for (const doc of orderItemsSnapshot.docs) {
      const item = doc.data();
      const customization = item.customization as Record<string, any>;
      
      if (!customization?.printifyProductId || !customization?.printifyVariantId) {
        console.warn(`Order item ${doc.id} missing Printify product/variant IDs`);
        continue;
      }

      lineItems.push({
        product_id: customization.printifyProductId,
        variant_id: customization.printifyVariantId,
        quantity: item.quantity || 1,
        print_areas: customization.printAreas,
      });
    }

    if (!lineItems.length) {
      return { success: false, error: 'No valid line items for Printify (missing product/variant IDs)' };
    }

    const addressTo: PrintifyOrderAddress = {
      first_name: shippingAddress.firstName,
      last_name: shippingAddress.lastName,
      email: shippingAddress.email,
      phone: shippingAddress.phone || '',
      country: shippingAddress.country,
      region: shippingAddress.region,
      address1: shippingAddress.address1,
      address2: shippingAddress.address2,
      city: shippingAddress.city,
      zip: shippingAddress.zip,
    };

    const printifyOrderRequest: CreatePrintifyOrderRequest = {
      external_id: orderId,
      label: `QR Gear Order ${orderId.slice(0, 8).toUpperCase()}`,
      line_items: lineItems,
      shipping_method: 1, // Standard shipping
      send_shipping_notification: true,
      address_to: addressTo,
    };

    // Create order in Printify
    const printifyOrder = await printifyClient.createOrder(printifyOrderRequest);

    // Update order status
    await db.collection('orders').doc(orderId).update({
      printifyOrderId: printifyOrder.id,
      status: 'processing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Submit to production
    await printifyClient.submitOrderToProduction(printifyOrder.id);

    // Update status to in_production
    await db.collection('orders').doc(orderId).update({
      status: 'in_production',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Order ${orderId} submitted to Printify: ${printifyOrder.id}`);
    return { success: true, printifyOrderId: printifyOrder.id };
  } catch (error: any) {
    console.error(`Failed to submit order ${orderId} to Printify:`, error);
    return { success: false, error: error.message };
  }
}

async function checkPrintifyOrderStatus(printifyOrderId: string): Promise<{
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
} | null> {
  try {
    if (!printifyClient.isConfigured) {
      return null;
    }

    const printifyOrder = await printifyClient.getOrder(printifyOrderId);
    
    const status = printifyOrder.status?.toLowerCase() || 'unknown';
    const shipments = printifyOrder.shipments || [];
    
    if (shipments.length > 0) {
      const latestShipment = shipments[shipments.length - 1];
      return {
        status,
        trackingNumber: latestShipment.tracking_number,
        trackingUrl: latestShipment.tracking_url,
        carrier: latestShipment.carrier,
      };
    }

    return { status };
  } catch (error: any) {
    console.error(`Failed to check Printify order status for ${printifyOrderId}:`, error);
    return null;
  }
}


  export { printifyClient, PrintifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE };
  export type { PrintifyOrderAddress, PrintifyOrderLineItem, CreatePrintifyOrderRequest, ShippingAddress };
  