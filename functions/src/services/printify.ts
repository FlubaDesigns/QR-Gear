import { randomUUID } from 'crypto';
import { assertProductionPayment } from './payment-state';
import { readFlubaProviderKey } from './fluba-provider-keys';
import { isSandboxRuntime, requireLiveCommerce } from '../runtime-config';
import { admin, db } from '../core';

  // ============ PRINTIFY CLIENT (Order Fulfillment) ============

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

// Get Printify API key - fallback for Cloud Functions environment
async function getPrintifyApiKey(): Promise<string> {
  if (isSandboxRuntime()) return '';
  return (await readFlubaProviderKey('PRINTIFY_API_TOKEN')) || '';
}

// Get Printify Shop ID - fallback for Cloud Functions environment
function getPrintifyShopId(): string {
  return (process.env.PRINTIFY_SHOP_ID || '').trim();
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
  private async getHeaders() {
    return {
      'Authorization': `Bearer ${await getPrintifyApiKey()}`,
      'Content-Type': 'application/json',
    };
  }

  get isConfigured(): Promise<boolean> { return this.checkConfigured(); }

  private async checkConfigured(): Promise<boolean> {
    const key = await getPrintifyApiKey();
    const shopId = getPrintifyShopId();
    return !!key && key.length > 10 && !!shopId;
  }

  private async request<T>(method: string, endpoint: string, body?: any, timeoutMs = 15000): Promise<T> {
    requireLiveCommerce('Printify requests');
    const url = `${PRINTIFY_API_BASE}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const options: RequestInit = { method, headers: await this.getHeaders(), signal: controller.signal };
    if (body) options.body = JSON.stringify(body);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Printify API error: ${response.status} - ${errorText}`);
      }
      const text = await response.text();
      return (text.trim() ? JSON.parse(text) : undefined) as T;
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

async function submitOrderToPrintify(orderId: string, shippingAddress: ShippingAddress): Promise<{ success: boolean; printifyOrderId?: string; error?: string }> {
  const ref = db.collection('orders').doc(orderId), lease = randomUUID();
  let claimed = false;
  try {
    requireLiveCommerce('Printify production');
    if (!(await printifyClient.isConfigured)) throw new Error('Printify API is not configured');
    const order = await db.runTransaction(async tx => {
      const value = (await tx.get(ref)).data();
      if (!value || value.routedProvider !== 'printify' || !value.paymentVerifiedAt || value.paymentStatus !== 'paid' || value.productionHold) throw new Error('Printify requires a verified paid order explicitly routed to Printify.');
      if (value.printifyLeaseUntil > Date.now()) throw new Error('Printify submission is already in progress.');
      tx.update(ref, { printifyLease: lease, printifyLeaseUntil: Date.now() + 120000 });
      return value;
    });
    claimed = true;
    await assertProductionPayment(order);
    let remoteId = order.printifyOrderId;
    if (!remoteId) {
      const items = (await db.collection('orderItems').where('orderId', '==', orderId).get()).docs.map(doc => doc.data());
      if (!items.length || items.some(item => !item.customization?.printifyProductId || !item.customization?.printifyVariantId || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) throw new Error('Every item needs saved Printify product, variant and quantity.');
      const remote = await printifyClient.createOrder({ external_id: orderId, label: `QR Gear Order ${orderId.slice(0, 8).toUpperCase()}`,
        line_items: items.map(item => ({ product_id: item.customization.printifyProductId, variant_id: item.customization.printifyVariantId, quantity: item.quantity, print_areas: item.customization.printAreas })),
        shipping_method: 1, send_shipping_notification: true,
        address_to: { first_name: shippingAddress.firstName, last_name: shippingAddress.lastName, email: shippingAddress.email, phone: shippingAddress.phone || '',
          country: shippingAddress.country, region: shippingAddress.region, address1: shippingAddress.address1, address2: shippingAddress.address2, city: shippingAddress.city, zip: shippingAddress.zip } });
      if (!remote?.id) throw new Error('Printify did not return an order identity.');
      remoteId = remote.id;
      await ref.update({ printifyOrderId: remoteId, printifySubmissionState: 'created', status: 'processing' });
    }
    const remote = await printifyClient.getOrder(remoteId);
    if (remote.id !== remoteId || (remote.external_id && remote.external_id !== orderId)) throw new Error('Printify order identity mismatch.');
    const status = String(remote.status || '').toLowerCase();
    const submitted = ['sending-to-production', 'in-production', 'fulfilled', 'partially-fulfilled'].includes(status);
    if (!submitted) {
      if (!['pending', 'on-hold'].includes(status)) throw new Error(`Printify order requires review: ${status || 'unknown'}`);
      await assertProductionPayment((await ref.get()).data());
      await printifyClient.submitOrderToProduction(remoteId);
    }
    await ref.update({ printifySubmissionState: 'submitted', status: status === 'fulfilled' ? 'shipped' : status === 'in-production' ? 'in_production' : 'processing', printifySubmissionError: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true, printifyOrderId: remoteId };
  } catch (error: any) {
    if (claimed) await ref.update({ printifySubmissionError: error.message }).catch(() => {});
    return { success: false, error: error.message };
  } finally {
    if (claimed) await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.printifyLease === lease) tx.update(ref, { printifyLease: null, printifyLeaseUntil: 0 });
    });
  }
}

async function checkPrintifyOrderStatus(printifyOrderId: string): Promise<{
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
} | null> {
  try {
    if (!(await printifyClient.isConfigured)) {
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
