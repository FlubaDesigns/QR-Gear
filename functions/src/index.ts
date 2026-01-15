// Build timestamp: 2026-01-14T04:50:00Z - Removed /background-files, using /library-files/:filename only
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import express, { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { Resend } from 'resend';

// NexusMail imports
import {
  getNexusMailService,
  sendOrderConfirmation as nexusOrderConfirmation,
  sendShippingNotification as nexusShippingNotification,
  seedDefaultTemplates,
} from './nexusmail';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// ============ EMAIL SERVICE (QR Gear - Separate from KC) ============

function getResendApiKey(): string {
  return process.env.QR_RESEND_API_KEY || '';
}

function getResendClient(): Resend | null {
  const apiKey = getResendApiKey();
  if (!apiKey || apiKey.length < 10) {
    return null;
  }
  return new Resend(apiKey);
}

const QR_GEAR_FROM_EMAIL = 'QR Gear <noreply@qrgear.com>';

interface OrderEmailData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: string;
  }>;
  totalAmount: string;
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    region: string;
    zip: string;
    country: string;
  };
}

interface ShippingEmailData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  trackingNumber: string;
  trackingUrl?: string;
  carrier: string;
}

/**
 * @deprecated LEGACY - Use nexusOrderConfirmation() instead for queue-first, idempotent email delivery.
 * This function bypasses NexusMail's TriggerEngine, outbox, and retry logic.
 * Only kept for emergency fallback - DO NOT USE IN NEW CODE.
 */
async function sendOrderConfirmationEmail_DEPRECATED(data: OrderEmailData): Promise<{ success: boolean; error?: string }> {
  console.warn('[DEPRECATED] sendOrderConfirmationEmail called - use nexusOrderConfirmation() instead');
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn('[Email] Resend not configured - skipping order confirmation email');
      return { success: false, error: 'Email service not configured' };
    }

    const itemsHtml = data.items.map(item => 
      `<tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.productName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${item.price}</td>
      </tr>`
    ).join('');

    const shippingHtml = data.shippingAddress ? `
      <h3 style="color: #333; margin-top: 24px;">Shipping Address</h3>
      <p style="color: #666; line-height: 1.6;">
        ${data.shippingAddress.address1}<br>
        ${data.shippingAddress.address2 ? data.shippingAddress.address2 + '<br>' : ''}
        ${data.shippingAddress.city}, ${data.shippingAddress.region} ${data.shippingAddress.zip}<br>
        ${data.shippingAddress.country}
      </p>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h1 style="color: #333; margin-bottom: 8px;">Order Confirmed!</h1>
          <p style="color: #666; font-size: 16px;">Thank you for your order, ${data.customerName}.</p>
          
          <p style="background: #f0f0f0; padding: 12px; border-radius: 4px; font-family: monospace;">
            Order #${data.orderId.slice(0, 8).toUpperCase()}
          </p>
          
          <h3 style="color: #333; margin-top: 24px;">Order Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 12px; text-align: left;">Product</th>
                <th style="padding: 12px; text-align: center;">Qty</th>
                <th style="padding: 12px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 12px; font-weight: bold;">Total</td>
                <td style="padding: 12px; text-align: right; font-weight: bold;">$${data.totalAmount}</td>
              </tr>
            </tfoot>
          </table>
          
          ${shippingHtml}
          
          <p style="color: #666; margin-top: 24px;">
            We'll send you another email with tracking information once your order ships.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          
          <p style="color: #999; font-size: 12px;">
            Questions? Reply to this email or contact us at support@qrgear.com
          </p>
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: QR_GEAR_FROM_EMAIL,
      to: data.customerEmail,
      subject: `Order Confirmed - #${data.orderId.slice(0, 8).toUpperCase()}`,
      html,
    });

    if (result.error) {
      console.error('[Email] Failed to send order confirmation:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[Email] Order confirmation sent to ${data.customerEmail} for order ${data.orderId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Email] Error sending order confirmation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * @deprecated LEGACY - Use nexusShippingNotification() instead for queue-first, idempotent email delivery.
 * This function bypasses NexusMail's TriggerEngine, outbox, and retry logic.
 * Only kept for emergency fallback - DO NOT USE IN NEW CODE.
 */
async function sendShippingNotificationEmail_DEPRECATED(data: ShippingEmailData): Promise<{ success: boolean; error?: string }> {
  console.warn('[DEPRECATED] sendShippingNotificationEmail called - use nexusShippingNotification() instead');
  try {
    const resend = getResendClient();
    if (!resend) {
      console.warn('[Email] Resend not configured - skipping shipping notification email');
      return { success: false, error: 'Email service not configured' };
    }

    const trackingLink = data.trackingUrl 
      ? `<a href="${data.trackingUrl}" style="color: #0066cc;">${data.trackingNumber}</a>`
      : data.trackingNumber;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Your Order Has Shipped!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h1 style="color: #333; margin-bottom: 8px;">Your Order Has Shipped!</h1>
          <p style="color: #666; font-size: 16px;">Great news, ${data.customerName}! Your order is on its way.</p>
          
          <p style="background: #f0f0f0; padding: 12px; border-radius: 4px; font-family: monospace;">
            Order #${data.orderId.slice(0, 8).toUpperCase()}
          </p>
          
          <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <h3 style="color: #2e7d32; margin: 0 0 12px 0;">Tracking Information</h3>
            <p style="margin: 0; color: #333;">
              <strong>Carrier:</strong> ${data.carrier}<br>
              <strong>Tracking Number:</strong> ${trackingLink}
            </p>
          </div>
          
          ${data.trackingUrl ? `
            <p style="text-align: center;">
              <a href="${data.trackingUrl}" style="display: inline-block; background: #333; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500;">
                Track Your Package
              </a>
            </p>
          ` : ''}
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          
          <p style="color: #999; font-size: 12px;">
            Questions? Reply to this email or contact us at support@qrgear.com
          </p>
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: QR_GEAR_FROM_EMAIL,
      to: data.customerEmail,
      subject: `Your Order Has Shipped! - #${data.orderId.slice(0, 8).toUpperCase()}`,
      html,
    });

    if (result.error) {
      console.error('[Email] Failed to send shipping notification:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`[Email] Shipping notification sent to ${data.customerEmail} for order ${data.orderId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Email] Error sending shipping notification:', error);
    return { success: false, error: error.message };
  }
}

const app = express();

// CORS configuration - restrict to known origins
const ALLOWED_ORIGINS = [
  'https://qrgear-c1ffd.web.app',
  'https://qrgear-c1ffd.firebaseapp.com',
  'https://qrgear.com',
  'https://www.qrgear.com',
  'https://kingdom-connects.web.app',
  'https://kingdom-connects.firebaseapp.com',
  // Development origins
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5000', 'http://localhost:3000'] : []),
];

app.use((req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests with no origin (like server-to-server or mobile apps)
    res.header('Access-Control-Allow-Origin', '*');
    // Note: Don't set credentials with wildcard origin
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Normalize paths - handle both direct function calls and Firebase Hosting rewrites
// Direct: /products (no /api prefix)
// Hosting rewrite: /api/products (has /api prefix)
app.use((req: Request, _res: Response, next: NextFunction): void => {
  if (req.path.startsWith('/api/')) {
    req.url = req.url.replace('/api', '');
  }
  next();
});

async function verifyAuth(req: Request): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  (req as any).user = user;
  next();
}

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || 'xHUmudG0t5OkCQhqyhB4nXhCUfs1').split(',').filter(Boolean);

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await verifyAuth(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.data();
  const isAdmin = userData?.isAdmin || ADMIN_USER_IDS.includes(user.uid);
  
  if (!isAdmin) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  (req as any).user = user;
  next();
}

interface CustomizationPricing {
  productId: string;
  productLine?: string;
  hasTextAbove?: boolean;
  hasTextBelow?: boolean;
  templateId?: string;
  hostingTierCode?: string;
}

async function calculateAuthoritativePrice(customization: CustomizationPricing): Promise<number | null> {
  try {
    const { productId, productLine = 'text', hasTextAbove, hasTextBelow, templateId, hostingTierCode = '1_year' } = customization;
    
    const productDoc = await db.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      console.warn(`[Pricing] Product not found: ${productId}`);
      return null;
    }
    const product = productDoc.data()!;
    
    // Per replit.md: "Prices are set by the admin and stored in products.customer_price. 
    // This value is the single source of truth for retail pricing and is never recalculated from base costs."
    const customerPrice = parseFloat(product.customerPrice || product.customer_price || '0');
    if (customerPrice > 0) {
      // customerPrice is the FINAL authoritative price - no upcharges added
      return customerPrice;
    }
    
    // Fallback: Calculate from base costs only if customerPrice is not set
    const settingsDoc = await db.collection('settings').doc('admin').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    
    const basePrice = parseFloat(product.basePrice || product.base_price || '0');
    const markupPercent = parseFloat(product.markupPercent || product.markup_percent || settings?.globalMarkupPercent || '25');
    const markupFixed = parseFloat(product.markupFixed || product.markup_fixed || settings?.globalMarkupFixed || '0');
    const qrCost = parseFloat(product.qrProductionCost || product.qr_production_cost || settings?.globalQrProductionCost || '2');
    
    let price = basePrice + qrCost;
    price = price * (1 + markupPercent / 100) + markupFixed;
    
    // Upcharges only apply when calculating from base costs (no customerPrice)
    if (hasTextAbove && productLine !== 'dynamic') {
      const upcharge = parseFloat(settings?.textAboveUpcharge || '2');
      price += upcharge;
    }
    if (hasTextBelow && productLine !== 'dynamic') {
      const upcharge = parseFloat(settings?.textBelowUpcharge || '2');
      price += upcharge;
    }
    
    if (productLine === 'template' && templateId) {
      const templateDoc = await db.collection('qrTemplates').doc(templateId).get();
      if (templateDoc.exists) {
        const template = templateDoc.data();
        const upcharge = parseFloat(template?.priceUpcharge || '0');
        price += upcharge;
      }
    }
    
    if (productLine === 'dynamic') {
      const dynamicUpcharge = parseFloat(settings?.dynamicQrUpcharge || '25');
      price += dynamicUpcharge;
    }
    
    if ((productLine === 'template' || productLine === 'custom' || productLine === 'dynamic') && hostingTierCode !== '1_year') {
      const tierSnapshot = await db.collection('hostingTiers').where('tierCode', '==', hostingTierCode).limit(1).get();
      if (!tierSnapshot.empty) {
        const tier = tierSnapshot.docs[0].data();
        if (!tier.isIncluded) {
          const upcharge = parseFloat(tier.priceUpcharge || '0');
          price += upcharge;
        }
      }
    }
    
    return Math.round(price * 100) / 100;
  } catch (error) {
    console.error('[Pricing] Error calculating price:', error);
    return null;
  }
}

async function getAuthoritativePrice(productId: string): Promise<number | null> {
  return calculateAuthoritativePrice({ productId });
}

function docToObject(doc: FirebaseFirestore.DocumentSnapshot): any {
  if (!doc.exists) return null;
  const data = doc.data()!;
  Object.keys(data).forEach(key => {
    if (data[key] instanceof admin.firestore.Timestamp) {
      data[key] = data[key].toDate();
    }
  });
  return { ...data, id: doc.id };
}

function docsToArray(snapshot: FirebaseFirestore.QuerySnapshot): any[] {
  return snapshot.docs.map(doc => docToObject(doc));
}

// ============ SIGNED URL HELPER ============

async function generateSignedUrl(storagePath: string, expiresInMinutes: number = 15): Promise<string | null> {
  if (!storagePath) return null;
  try {
    // Remove leading slash if present
    const cleanPath = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;
    const bucket = storage.bucket();
    const file = bucket.file(cleanPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[SignedURL] File not found: ${cleanPath}`);
      return null;
    }
    
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return signedUrl;
  } catch (error: any) {
    console.error(`[SignedURL] Error generating signed URL for ${storagePath}:`, error.message);
    return null;
  }
}

async function addSignedUrlsToAssets(assets: any[]): Promise<any[]> {
  return Promise.all(assets.map(async (asset) => {
    const signedUrl = asset.storageUrl ? await generateSignedUrl(asset.storageUrl) : null;
    const thumbnailSignedUrl = asset.thumbnailUrl ? await generateSignedUrl(asset.thumbnailUrl) : null;
    return {
      ...asset,
      signedUrl,
      thumbnailSignedUrl,
    };
  }));
}

// ============ PRINTFUL CLIENT (No Replit Dependencies) ============

const PRINTFUL_API_BASE = 'https://api.printful.com';

// Get Printful API key from environment variables
function getPrintfulApiKey(): string {
  return process.env.PRINTFUL_API_KEY || '';
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
  private get headers() {
    return {
      'Authorization': `Bearer ${getPrintfulApiKey()}`,
      'Content-Type': 'application/json',
    };
  }

  get isConfigured(): boolean {
    const key = getPrintfulApiKey();
    return !!key && key.length > 10;
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${PRINTFUL_API_BASE}${endpoint}`;
    const options: RequestInit = { method, headers: this.headers };
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
    return this.request<any>('GET', `/mockup-generator/printfiles/${productId}`);
  }

  async getVariantsByColor(productId: number, colorName: string): Promise<PrintfulVariant[]> {
    const productData = await this.getProduct(productId);
    const lowerColor = colorName.toLowerCase().replace(/^solid\s+/i, '');
    return productData.variants.filter(v => 
      v.color.toLowerCase() === lowerColor || 
      v.color.toLowerCase().includes(lowerColor) ||
      v.name.toLowerCase().includes(lowerColor)
    );
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
    console.log('[Printful] Creating mockup task for product', productId);
    return this.request<PrintfulMockupTask>('POST', `/mockup-generator/create-task/${productId}`, body);
  }

  async getMockupTaskResult(taskKey: string): Promise<PrintfulMockupTask> {
    return this.request<PrintfulMockupTask>('GET', `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`);
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

// ============ PRINTIFY CLIENT (Order Fulfillment) ============

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

function getPrintifyApiKey(): string {
  return process.env.PRINTIFY_API_KEY || '';
}

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

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const url = `${PRINTIFY_API_BASE}${endpoint}`;
    const options: RequestInit = { method, headers: this.headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Printify API error: ${response.status} - ${errorText}`);
    }
    return response.json() as Promise<T>;
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

// ============ COLOR LUMINANCE HELPERS ============

function isValidHexColor(hexColor: string | undefined | null): boolean {
  if (!hexColor) return false;
  const hex = hexColor.replace("#", "");
  return /^[0-9A-Fa-f]{6}$/.test(hex);
}

function isColorDark(hexColor: string | undefined | null): boolean {
  if (!isValidHexColor(hexColor)) return false;
  const hex = hexColor!.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.5;
}

// ============ FIREBASE STORAGE UPLOAD ============

async function downloadAndStoreImage(imageUrl: string, storagePath: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
    });
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    console.log(`[Storage] Uploaded to: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    console.error('[Storage] Upload failed:', error.message);
    return null;
  }
}

// ============ MOCKUP GENERATION (Full Implementation) ============

interface MockupRequest {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  colorHex?: string;
  artworkUrl: string;
  artworkVariant?: 'black' | 'white';
}

interface MockupResult {
  mockupUrl: string;
  lifestyleMockupUrl?: string | null;
  fromCache: boolean;
}

// Default Printify blueprint to Printful product mappings (fallback)
const DEFAULT_BLUEPRINT_MAPPINGS: Record<number, number> = {
  5: 71,      // Bella Canvas 3001 Unisex Jersey Tee
  6: 71,      // Gildan alternative
  145: 380,   // Heavyweight tee
  474: 71,    // Cotton Crew
};

// Look up Printful product ID from Firestore mapping or fallback
async function getPrintfulProductId(blueprintId: number): Promise<number | null> {
  // Check Firestore mapping first
  const mappingSnapshot = await db.collection('printifyPrintfulMapping')
    .where('printifyBlueprintId', '==', blueprintId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  if (!mappingSnapshot.empty) {
    const mapping = mappingSnapshot.docs[0].data();
    return mapping.printfulProductId;
  }
  
  // Fallback to hardcoded defaults
  return DEFAULT_BLUEPRINT_MAPPINGS[blueprintId] || null;
}

async function generateMockupFromPrintful(request: MockupRequest): Promise<MockupResult> {
  const { blueprintId, colorName, colorHex, artworkUrl, artworkVariant = 'black' } = request;
  
  // Check Firestore cache first
  const cacheKey = `${blueprintId}_${colorName.replace(/\s+/g, '_')}_${artworkVariant}`;
  const cacheDoc = await db.collection('mockupCache').doc(cacheKey).get();
  
  if (cacheDoc.exists) {
    const cached = cacheDoc.data()!;
    if (cached.status === 'active' && cached.mockupUrl) {
      console.log(`[Mockup] Cache HIT: ${colorName}`);
      return {
        mockupUrl: cached.mockupUrl,
        lifestyleMockupUrl: cached.lifestyleMockupUrl,
        fromCache: true,
      };
    }
  }
  
  console.log(`[Mockup] Cache MISS: ${colorName} - generating via Printful`);
  
  if (!printfulClient.isConfigured) {
    throw new Error('Printful API key not configured');
  }
  
  // Map Printify blueprint to Printful product (from Firestore or fallback)
  const printfulProductId = await getPrintfulProductId(blueprintId);
  if (!printfulProductId) {
    throw new Error(`No Printful mapping for blueprint ${blueprintId}. Add mapping to printifyPrintfulMapping collection.`);
  }
  
  // Get variants for this color
  const variants = await printfulClient.getVariantsByColor(printfulProductId, colorName);
  if (variants.length === 0) {
    throw new Error(`No Printful variants found for color: ${colorName}`);
  }
  
  const variantId = variants[0].id;
  
  // Get printfile specs
  const printfileData = await printfulClient.getPrintfiles(printfulProductId);
  const frontPrintfile = printfileData?.printfiles?.find((p: any) => 
    p.placement === 'front' || p.placement === 'default'
  );
  
  // Create mockup task
  const task = await printfulClient.createMockupTask(
    printfulProductId,
    [variantId],
    [{ placement: 'front', image_url: artworkUrl }],
    'jpg',
    ['Lifestyle']
  );
  
  // Wait for completion
  const result = await printfulClient.waitForMockupTask(task.task_key, 90000);
  
  if (!result.mockups || result.mockups.length === 0) {
    throw new Error('No mockups returned from Printful');
  }
  
  // Find flat and lifestyle mockups
  let flatMockup = result.mockups.find(m => !m.placement.includes('lifestyle'));
  let lifestyleMockup = result.mockups.find(m => m.placement.includes('lifestyle'));
  
  if (!flatMockup) flatMockup = result.mockups[0];
  
  // Download and store in Firebase Storage
  const timestamp = Date.now();
  const storagePath = `mockups/${blueprintId}/${colorName.replace(/\s+/g, '_')}_${artworkVariant}_${timestamp}.jpg`;
  const permanentUrl = await downloadAndStoreImage(flatMockup.mockup_url, storagePath);
  
  let lifestyleUrl: string | null = null;
  if (lifestyleMockup) {
    const lifestylePath = `mockups/${blueprintId}/${colorName.replace(/\s+/g, '_')}_${artworkVariant}_lifestyle_${timestamp}.jpg`;
    lifestyleUrl = await downloadAndStoreImage(lifestyleMockup.mockup_url, lifestylePath);
  }
  
  // Cache in Firestore
  await db.collection('mockupCache').doc(cacheKey).set({
    blueprintId,
    colorName,
    artworkVariant,
    mockupUrl: permanentUrl || flatMockup.mockup_url,
    lifestyleMockupUrl: lifestyleUrl,
    status: 'active',
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return {
    mockupUrl: permanentUrl || flatMockup.mockup_url,
    lifestyleMockupUrl: lifestyleUrl,
    fromCache: false,
  };
}

app.get('/health', (_req: Request, res: Response): void => {
  res.json({ 
    status: 'ok', 
    mode: 'firebase-functions', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const featured = req.query.featured === 'true';
    let query: FirebaseFirestore.Query = db.collection('products').where('isEnabled', '==', true);
    if (featured) {
      query = query.where('isFeatured', '==', true);
    }
    const snapshot = await query.get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/designs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Design not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/user', async (req: Request, res: Response): Promise<void> => {
  try {
    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
      // Return null instead of 401 for unauthenticated requests
      res.json(null);
      return;
    }

    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      const newUser = {
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email?.split('@')[0],
        isAdmin: ADMIN_USER_IDS.includes(decodedToken.uid),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(decodedToken.uid).set(newUser);
      res.json({ ...newUser, id: decodedToken.uid });
      return;
    }

    // Merge Firestore data with isAdmin check from both sources
    const userData = docToObject(userDoc);
    const isAdmin = userData.isAdmin === true || ADMIN_USER_IDS.includes(decodedToken.uid);
    res.json({ ...userData, isAdmin });
  } catch (error: any) {
    // Return null on error instead of 401
    console.error('[/auth/user] Error:', error.message);
    res.json(null);
  }
});

app.get('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const { customization, quantity } = req.body;
    
    const productId = customization?.productId;
    if (!productId) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }

    const pricingInput: CustomizationPricing = {
      productId,
      productLine: customization?.productLine || 'text',
      hasTextAbove: customization?.hasTextAbove || false,
      hasTextBelow: customization?.hasTextBelow || false,
      templateId: customization?.templateId,
      hostingTierCode: customization?.hostingTierCode || customization?.dynamicHostingTier || '1_year',
    };

    const authoritativePrice = await calculateAuthoritativePrice(pricingInput);
    if (authoritativePrice === null) {
      res.status(400).json({ error: 'Product not found or has no valid price' });
      return;
    }

    const cartItem = {
      customization,
      quantity: quantity || 1,
      price: authoritativePrice.toString(),
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('cartItems').add(cartItem);
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantity } = req.body;
    await db.collection('cartItems').doc(req.params.id).update({ quantity });
    const doc = await db.collection('cartItems').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('cartItems').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('orders')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/orders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('orders').add({
      ...req.body,
      userId,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/qr-templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('qrTemplates').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/qr-templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('qrTemplates').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'QR Template not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/hosting-tiers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hostingTiers').orderBy('sortOrder', 'asc').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stores/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores')
      .where('slug', '==', req.params.slug)
      .limit(1)
      .get();
    if (snapshot.empty) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(docToObject(snapshot.docs[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stripe/publishable-key', async (_req: Request, res: Response): Promise<void> => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }
  res.json({ publishableKey: key });
});

app.post('/checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const userId = (req as any).user.uid;
    const { successUrl, cancelUrl } = req.body;

    const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    
    if (cartSnapshot.empty) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    const cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lineItemsPromises = cartItems.map(async (item: any) => {
      const customization = item.customization || {};
      const productId = customization.productId;
      const productName = customization.productName || 'Custom QR Product';
      const productImage = customization.productImage;
      
      let price: number | null = null;
      if (productId) {
        const pricingInput: CustomizationPricing = {
          productId,
          productLine: customization.productLine || 'text',
          hasTextAbove: customization.hasTextAbove || false,
          hasTextBelow: customization.hasTextBelow || false,
          templateId: customization.templateId,
          hostingTierCode: customization.hostingTierCode || customization.dynamicHostingTier || '1_year',
        };
        price = await calculateAuthoritativePrice(pricingInput);
      }
      if (price === null) {
        price = parseFloat(item.price);
      }
      
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for item: ${productName}`);
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            images: productImage ? [productImage] : [],
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: item.quantity || 1,
      };
    });

    const lineItems = await Promise.all(lineItemsPromises);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'],
      },
      success_url: successUrl || `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/cart`,
      metadata: {
        userId,
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/checkout/embedded', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const userId = (req as any).user.uid;
    const { returnUrl } = req.body;

    const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    
    if (cartSnapshot.empty) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    const cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lineItemsPromises = cartItems.map(async (item: any) => {
      const customization = item.customization || {};
      const productId = customization.productId;
      const productName = customization.productName || 'Custom QR Product';
      const productImage = customization.productImage;
      
      let price: number | null = null;
      if (productId) {
        const pricingInput: CustomizationPricing = {
          productId,
          productLine: customization.productLine || 'text',
          hasTextAbove: customization.hasTextAbove || false,
          hasTextBelow: customization.hasTextBelow || false,
          templateId: customization.templateId,
          hostingTierCode: customization.hostingTierCode || customization.dynamicHostingTier || '1_year',
        };
        price = await calculateAuthoritativePrice(pricingInput);
      }
      if (price === null) {
        price = parseFloat(item.price);
      }
      
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for item: ${productName}`);
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            images: productImage ? [productImage] : [],
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: item.quantity || 1,
      };
    });

    const lineItems = await Promise.all(lineItemsPromises);
    const cartItemIds = cartItems.map((item: any) => item.id);

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'],
      },
      return_url: returnUrl || `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId,
        cartItemIds: JSON.stringify(cartItemIds),
      },
    });

    res.json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error('Embedded checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/checkout/session-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const sessionId = req.query.session_id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'session_id is required' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/checkout/verify/:sessionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/gallery', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('qrDesigns')
      .where('isPublic', '==', true)
      .limit(50)
      .get();
    const items = docsToArray(snapshot);
    items.sort((a: any, b: any) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const bucket = storage.bucket();
    const file = bucket.file(`custom-designs/${filename}`);
    
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    file.createReadStream().pipe(res);
  } catch (error: any) {
    console.error('File serving error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/library-files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const bucket = storage.bucket();
    
    // Search in new canonical paths first, then legacy paths
    const possiblePaths = [
      `library/backgrounds/raw/${filename}`,
      `library/backgrounds/cropped/${filename}`,
      `library/backgrounds/archive/${filename}`,
      `library/backgrounds/zip/${filename}`,
      `libraries/designs/${filename}`,
      `libraries/videos/${filename}`,
      `library/${filename}`,
      `library/admin/backgrounds/${filename}`,
      `library/admin/designs/${filename}`,
      `library/backgrounds/raw/zip/${filename}`,
    ];
    
    for (const path of possiblePaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      
      if (exists) {
        const [metadata] = await file.getMetadata();
        res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        file.createReadStream().pipe(res);
        return;
      }
    }
    
    res.status(404).json({ error: 'File not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC test endpoint - no auth
app.get('/test-images', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('libraryAssets').where('isActive', '==', true).limit(20).get();
    const assets = snapshot.docs.map(doc => {
      const data = doc.data();
      const storageUrl = data.storageUrl || '';
      const filename = storageUrl.split('/').pop() || '';
      return {
        id: doc.id,
        name: data.name,
        storageUrl,
        publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
      };
    });
    res.json(assets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/settings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('settings').doc('admin').set(req.body, { merge: true });
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.data());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('products').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.body.id || `product_${Date.now()}`;
    await db.collection('products').doc(productId).set({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('products').doc(productId).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('products').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('products').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/products/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const current = doc.data()!.isEnabled || false;
    await db.collection('products').doc(req.params.id).update({
      isEnabled: !current,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const updated = await db.collection('products').doc(req.params.id).get();
    res.json(docToObject(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('products').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/orders', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/orders/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('orders').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('orders').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/users', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('users').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productCategories').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/browsing-history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('browsingHistory')
      .where('userId', '==', userId)
      .orderBy('viewedAt', 'desc')
      .limit(20)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/browsing-history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('browsingHistory').add({
      ...req.body,
      userId,
      viewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/coupons/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('coupons')
      .where('code', '==', req.params.code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      res.status(404).json({ error: 'Coupon not found or expired' });
      return;
    }
    
    const coupon = docToObject(snapshot.docs[0]);
    
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      res.status(400).json({ error: 'Coupon has expired' });
      return;
    }
    
    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
      res.status(400).json({ error: 'Coupon has reached maximum redemptions' });
      return;
    }
    
    res.json(coupon);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ WIDGET API ============

import * as jwt from 'jsonwebtoken';

// Secrets must be configured via Firebase Functions config or environment variables
// These will NOT work without proper configuration
const WIDGET_JWT_SECRET = process.env.WIDGET_JWT_SECRET;
const WIDGET_API_KEY = process.env.WIDGET_API_KEY;

function signWidgetToken(payload: any): string {
  if (!WIDGET_JWT_SECRET) {
    throw new Error('WIDGET_JWT_SECRET not configured');
  }
  return jwt.sign(payload, WIDGET_JWT_SECRET, { expiresIn: '1h' });
}

function verifyWidgetToken(token: string): any {
  try {
    if (!WIDGET_JWT_SECRET) {
      return null;
    }
    return jwt.verify(token, WIDGET_JWT_SECRET);
  } catch {
    return null;
  }
}

app.get('/widget/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    const payload = verifyWidgetToken(token);
    
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const snapshot = await db.collection('products')
      .where('isEnabled', '==', true)
      .limit(6)
      .get();
    
    const featuredProducts = snapshot.docs.map(doc => {
      const p = doc.data();
      return {
        id: doc.id,
        name: p.name,
        imageUrl: p.imageUrl || '',
        basePrice: p.basePrice,
        category: p.category,
      };
    });

    res.json({
      businessName: payload.businessName,
      businessLogoUrl: payload.businessLogoUrl,
      kcListingUrl: payload.kcListingUrl,
      products: featuredProducts,
    });
  } catch (error: any) {
    console.error('Widget session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/widget/token', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] || (req.headers['authorization'] as string)?.replace('Bearer ', '');
    
    if (!WIDGET_API_KEY || apiKey !== WIDGET_API_KEY) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }

    const { businessName, businessLogoUrl, kcListingUrl } = req.body;
    
    if (!businessName || !kcListingUrl) {
      res.status(400).json({ error: 'businessName and kcListingUrl are required' });
      return;
    }

    const token = signWidgetToken({ businessName, businessLogoUrl, kcListingUrl });
    
    res.json({ 
      token,
      expiresIn: 3600
    });
  } catch (error: any) {
    console.error('Widget token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PARTNER API ============

app.get('/partner/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!WIDGET_API_KEY || apiKey !== WIDGET_API_KEY) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }
    
    const { partnerId } = req.query;
    
    if (!partnerId || typeof partnerId !== 'string') {
      res.status(400).json({ error: 'partnerId query parameter required' });
      return;
    }
    
    const storeSnapshot = await db.collection('partnerStores')
      .where('slug', '==', partnerId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (storeSnapshot.empty) {
      res.status(404).json({ error: 'Partner not found or inactive' });
      return;
    }
    
    const store = storeSnapshot.docs[0];
    const storeData = store.data();
    
    const productsSnapshot = await db.collection('partnerStoreProducts')
      .where('storeId', '==', store.id)
      .where('isEnabled', '==', true)
      .get();
    
    const products = await Promise.all(
      productsSnapshot.docs.map(async (spDoc) => {
        const sp = spDoc.data();
        const productDoc = await db.collection('products').doc(sp.productId).get();
        if (!productDoc.exists) return null;
        const product = productDoc.data()!;
        
        return {
          id: productDoc.id,
          blueprintId: product.blueprintId,
          name: sp.customName || product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          basePrice: sp.customPrice || product.basePrice,
          category: product.category,
          kcBusinessSlug: sp.kcBusinessSlug,
          sortOrder: sp.sortOrder,
        };
      })
    );
    
    res.json({
      store: { id: store.id, name: storeData.name, slug: storeData.slug },
      products: products.filter(Boolean),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STOREFRONT MOCKUP GENERATION ============

app.post('/storefront/generate-mockup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, color, qrSize, qrSizePercent } = req.body;
    
    if (!productId || !color) {
      res.status(400).json({ error: 'productId and color are required' });
      return;
    }
    
    let resolvedQrSize: 'small' | 'medium' | 'large' = 'medium';
    if (qrSize && ['small', 'medium', 'large'].includes(qrSize)) {
      resolvedQrSize = qrSize;
    } else if (qrSizePercent) {
      if (qrSizePercent <= 30) resolvedQrSize = 'small';
      else if (qrSizePercent <= 50) resolvedQrSize = 'medium';
      else resolvedQrSize = 'large';
    }
    
    const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
    const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
    
    const productDoc = await db.collection('products').doc(canonicalProductId).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    const existingMockups = (product.mockupsByColor as Record<string, any>) || {};
    const normalizeColor = (c: string) => c.toLowerCase().trim();
    const requestColorNorm = normalizeColor(color);
    
    // Build keys for lookup: color_size_placement (full), color_size, color (legacy)
    const placement = 'front-chest';
    const fullKey = `${color}_${resolvedQrSize}_${placement}`;
    const colorSizeKey = `${color}_${resolvedQrSize}`;
    const fullKeyNorm = `${requestColorNorm}_${resolvedQrSize}_${placement}`;
    const colorSizeKeyNorm = `${requestColorNorm}_${resolvedQrSize}`;
    
    console.log(`[StorefrontMockup] Looking for mockup: full="${fullKey}", size="${colorSizeKey}", color="${color}"`);
    
    // Priority 1: Exact match for color + size + placement
    let existingMockup: any = null;
    let matchedColorKey: string = fullKey;
    let usedFallback = false;
    
    for (const [storedKey, mockup] of Object.entries(existingMockups)) {
      const storedKeyNorm = storedKey.toLowerCase().trim();
      if (storedKeyNorm === fullKeyNorm && mockup && (mockup as any).front) {
        existingMockup = mockup;
        matchedColorKey = storedKey;
        console.log(`[StorefrontMockup] Found EXACT match: "${storedKey}"`);
        break;
      }
    }
    
    // Priority 2: Match color + size (any placement)
    if (!existingMockup) {
      for (const [storedKey, mockup] of Object.entries(existingMockups)) {
        const storedKeyNorm = storedKey.toLowerCase().trim();
        if (storedKeyNorm === colorSizeKeyNorm && mockup && (mockup as any).front) {
          existingMockup = mockup;
          matchedColorKey = storedKey;
          usedFallback = true;
          console.log(`[StorefrontMockup] Found SIZE match: "${storedKey}" (requested: ${fullKey})`);
          break;
        }
      }
    }
    
    // Priority 3: Fallback to any mockup for this color
    if (!existingMockup) {
      for (const [storedKey, mockup] of Object.entries(existingMockups)) {
        const storedKeyNorm = storedKey.toLowerCase().trim();
        const matchesColor = storedKeyNorm === requestColorNorm || 
                             storedKeyNorm.startsWith(`${requestColorNorm}_`);
        if (matchesColor && mockup && (mockup as any).front) {
          existingMockup = mockup;
          matchedColorKey = storedKey;
          usedFallback = true;
          console.log(`[StorefrontMockup] Using COLOR fallback: "${storedKey}" (requested: ${fullKey})`);
          break;
        }
      }
    }
    
    if (existingMockup && existingMockup.front) {
      const defaultImage = existingMockup.lifestyle || existingMockup.front;
      await db.collection('products').doc(canonicalProductId).update({
        defaultColor: color,
        imageUrl: defaultImage,
      });
      
      res.json({ 
        success: true, 
        color, 
        graphicSize: resolvedQrSize,
        mockupUrl: existingMockup.front,
        lifestyleMockupUrl: existingMockup.lifestyle || null,
        fromCache: true,
        usedFallback,
        matchedKey: matchedColorKey,
        mockupsByColor: existingMockups 
      });
      return;
    }
    
    const designDoc = await db.collection('customDesigns').doc(designId).get();
    if (!designDoc.exists) {
      res.status(404).json({ error: 'Design not found' });
      return;
    }
    
    const design = designDoc.data()!;
    let designPlacements: Record<string, string> = {};
    try {
      if (typeof design.placementImages === 'string') {
        designPlacements = JSON.parse(design.placementImages);
      } else if (design.placementImages && typeof design.placementImages === 'object') {
        designPlacements = design.placementImages as Record<string, string>;
      }
    } catch (e) {
      console.error('[StorefrontMockup] Failed to parse placementImages:', e);
    }
    
    let colorHex: string | null = null;
    if (product.availableColors && Array.isArray(product.availableColors)) {
      const colorInfo = (product.availableColors as any[]).find(
        (c: any) => c.name?.toLowerCase() === color.toLowerCase()
      );
      colorHex = colorInfo?.hex || null;
    }
    
    const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
    
    const blackArtwork = designPlacements['front-chest'] || 
                         designPlacements['front-chest-black'] || 
                         designPlacements['front-center'] ||
                         designPlacements['front'];
    const whiteArtwork = designPlacements['front-chest-white'] || 
                         designPlacements['front-center-white'] ||
                         designPlacements['front-white'];
    
    let artworkUrl: string;
    let artworkVariant: 'black' | 'white' = 'black';
    
    if (needsWhiteQR && whiteArtwork) {
      artworkUrl = whiteArtwork;
      artworkVariant = 'white';
    } else if (blackArtwork) {
      artworkUrl = blackArtwork;
      artworkVariant = 'black';
    } else {
      artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
    }
    
    // Generate mockup via Printful if not cached
    if (!printfulClient.isConfigured) {
      res.status(404).json({ 
        error: `No mockup available for ${color}. Printful API key not configured.`,
        color 
      });
      return;
    }
    
    try {
      console.log(`[StorefrontMockup] Generating mockup for ${color} via Printful...`);
      const mockupResult = await generateMockupFromPrintful({
        blueprintId: product.blueprintId,
        printProviderId: product.printProviderId || 0,
        colorName: color,
        colorHex: colorHex || undefined,
        artworkUrl,
        artworkVariant,
      });
      
      // Update product with new mockup
      const updatedMockups = {
        ...existingMockups,
        [color]: {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
        },
      };
      
      const defaultImage = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
      await db.collection('products').doc(canonicalProductId).update({
        mockupsByColor: updatedMockups,
        defaultColor: color,
        imageUrl: defaultImage,
      });
      
      res.json({
        success: true,
        color,
        mockupUrl: mockupResult.mockupUrl,
        lifestyleMockupUrl: mockupResult.lifestyleMockupUrl,
        fromCache: mockupResult.fromCache,
        mockupsByColor: updatedMockups,
      });
    } catch (genError: any) {
      console.error(`[StorefrontMockup] Printful generation failed:`, genError.message);
      res.status(500).json({ 
        error: `Failed to generate mockup for ${color}: ${genError.message}`,
        color 
      });
    }
  } catch (error: any) {
    console.error('[StorefrontMockup] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MOCKUP API ============

app.get('/placements', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('canonicalPlacements').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mockups/get-or-generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      blueprintId, 
      printProviderId, 
      colorName, 
      colorHex,
      canonicalPlacementId = 'FRONT_CHEST',
      artworkUrl,
      artworkVariant = 'black'
    } = req.body;

    if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
      res.status(400).json({ 
        error: 'Missing required fields: blueprintId, printProviderId, colorName, artworkUrl' 
      });
      return;
    }

    const cacheKey = `${blueprintId}-${printProviderId}-${colorName}-${canonicalPlacementId}-${artworkVariant}`;
    const cacheSnapshot = await db.collection('mockupCache')
      .where('cacheKey', '==', cacheKey)
      .limit(1)
      .get();
    
    if (!cacheSnapshot.empty) {
      const cached = cacheSnapshot.docs[0].data();
      res.json({
        success: true,
        mockupUrl: cached.mockupUrl,
        lifestyleUrl: cached.lifestyleUrl,
        fromCache: true,
      });
      return;
    }
    
    // Generate via Printful if not in cache
    if (!printfulClient.isConfigured) {
      res.json({
        success: false,
        message: 'Mockup not in cache and Printful API key not configured.',
        fromCache: false,
      });
      return;
    }
    
    try {
      const mockupResult = await generateMockupFromPrintful({
        blueprintId,
        printProviderId,
        colorName,
        colorHex,
        artworkUrl,
        artworkVariant: artworkVariant as 'black' | 'white',
      });
      
      res.json({
        success: true,
        mockupUrl: mockupResult.mockupUrl,
        lifestyleUrl: mockupResult.lifestyleMockupUrl,
        fromCache: mockupResult.fromCache,
      });
    } catch (genError: any) {
      res.status(500).json({
        success: false,
        error: genError.message,
        fromCache: false,
      });
    }
  } catch (error: any) {
    console.error('[MockupAPI] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mockups/cached/:blueprintId/:printProviderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId } = req.params;
    
    const snapshot = await db.collection('mockupCache')
      .where('blueprintId', '==', parseInt(blueprintId))
      .where('printProviderId', '==', parseInt(printProviderId))
      .get();
    
    const mockups: Record<string, any> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!mockups[data.colorName]) {
        mockups[data.colorName] = {};
      }
      mockups[data.colorName][data.placementId] = {
        mockupUrl: data.mockupUrl,
        lifestyleUrl: data.lifestyleUrl,
      };
    });

    res.json({ mockups, count: Object.keys(mockups).length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DESIGNS CRUD ============

app.get('/designs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('customDesigns')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/designs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('customDesigns').add({
      ...req.body,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/designs/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/designs/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCT CATEGORIES ============

app.get('/product-categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productCategories')
      .orderBy('sortOrder')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/product-categories/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const mappingSnapshot = await db.collection('productCategoryMappings')
      .where('categoryId', '==', req.params.id)
      .get();
    
    const productIds = mappingSnapshot.docs.map(d => d.data().productId);
    
    if (productIds.length === 0) {
      res.json([]);
      return;
    }
    
    const products = await Promise.all(
      productIds.map(async (id: string) => {
        const doc = await db.collection('products').doc(id).get();
        return doc.exists ? docToObject(doc) : null;
      })
    );
    
    res.json(products.filter(Boolean));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN PRODUCT CATEGORIES ============

app.post('/admin/product-categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('productCategories').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('productCategories').doc(req.params.id).update(req.body);
    const doc = await db.collection('productCategories').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('productCategories').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ AUTH ENDPOINTS ============

app.post('/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0],
    });
    
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName: displayName || email.split('@')[0],
      isAdmin: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    res.json({ 
      success: true, 
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ ADMIN PRICING RULES ============

app.get('/admin/pricing-rules', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('pricingRules').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/pricing-rules', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('pricingRules').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/pricing-rules/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('pricingRules').doc(req.params.id).update(req.body);
    const doc = await db.collection('pricingRules').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/pricing-rules/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('pricingRules').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN PARTNER STORES ============

app.get('/admin/partner-stores', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/partner-stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('partnerStores').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partnerStores').doc(req.params.id).update(req.body);
    const doc = await db.collection('partnerStores').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partnerStores').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/partner-stores/:id/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStoreProducts')
      .where('storeId', '==', req.params.id)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/partner-stores/:id/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('partnerStoreProducts').add({
      ...req.body,
      storeId: req.params.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ QR GENERATION ============

app.post('/qr/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, color, backgroundColor, size, format } = req.body;
    
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    
    res.json({
      success: true,
      message: 'QR generation endpoint - use client-side QR library for immediate generation',
      content,
      options: { color, backgroundColor, size, format },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STORES (PUBLIC) ============

app.get('/stores', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores')
      .where('isActive', '==', true)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ FILE UPLOAD (Firebase Storage) ============

app.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    res.json({
      success: false,
      message: 'File uploads should be done directly to Firebase Storage from the client using Firebase SDK',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN MOCKUP REGENERATION ============

app.post('/admin/products/:id/regenerate-mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { color } = req.body;
    
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    if (!product.blueprintId) {
      res.status(400).json({ error: 'Product missing blueprint info' });
      return;
    }
    
    if (!printfulClient.isConfigured) {
      res.status(500).json({ error: 'Printful API key not configured' });
      return;
    }
    
    const metadata = product.metadata as { customDesignId?: string } | null;
    const designId = metadata?.customDesignId || id.replace('custom_', '');
    
    const designDoc = await db.collection('customDesigns').doc(designId).get();
    if (!designDoc.exists) {
      res.status(404).json({ error: 'Custom design not found' });
      return;
    }
    
    const design = designDoc.data()!;
    let designPlacements: Record<string, string> = {};
    if (typeof design.placementImages === 'object') {
      designPlacements = design.placementImages as Record<string, string>;
    }
    
    const blackArtwork = designPlacements['front-chest'] || designPlacements['front'];
    const whiteArtwork = designPlacements['front-chest-white'];
    
    // Get colors to regenerate
    const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
    const colorsToProcess = color ? allColors.filter(c => c.name === color) : allColors;
    
    if (colorsToProcess.length === 0) {
      res.status(400).json({ error: 'No colors to process' });
      return;
    }
    
    const results: any[] = [];
    const mockupsByColor: Record<string, any> = product.mockupsByColor || {};
    
    for (const colorInfo of colorsToProcess) {
      try {
        const needsWhiteQR = isColorDark(colorInfo.hex);
        const artworkUrl = (needsWhiteQR && whiteArtwork) ? whiteArtwork : blackArtwork;
        const artworkVariant = (needsWhiteQR && whiteArtwork) ? 'white' as const : 'black' as const;
        
        const mockupResult = await generateMockupFromPrintful({
          blueprintId: product.blueprintId,
          printProviderId: product.printProviderId || 0,
          colorName: colorInfo.name,
          colorHex: colorInfo.hex,
          artworkUrl,
          artworkVariant,
        });
        
        // Save with full key: color_size_placement (e.g., "Black_medium_front-chest")
        const graphicSize = 'medium';
        const placement = 'front-chest';
        const fullKey = `${colorInfo.name}_${graphicSize}_${placement}`;
        mockupsByColor[fullKey] = {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
          qrSize: graphicSize,
          placement,
          generatedAt: new Date().toISOString(),
        };
        
        // Also keep legacy keys for backward compatibility
        const colorSizeKey = `${colorInfo.name}_${graphicSize}`;
        mockupsByColor[colorSizeKey] = {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
          qrSize: graphicSize,
          placement,
          generatedAt: new Date().toISOString(),
        };
        
        mockupsByColor[colorInfo.name] = {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
          qrSize: graphicSize,
          placement,
          generatedAt: new Date().toISOString(),
        };
        
        results.push({ color: colorInfo.name, success: true, mockupUrl: mockupResult.mockupUrl });
        
        // Rate limit between colors
        if (colorsToProcess.indexOf(colorInfo) < colorsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err: any) {
        results.push({ color: colorInfo.name, success: false, error: err.message });
      }
    }
    
    // Update product with new mockups
    await db.collection('products').doc(id).update({ mockupsByColor });
    
    res.json({
      success: true,
      message: `Regenerated mockups for ${results.filter(r => r.success).length}/${colorsToProcess.length} colors`,
      results,
      mockupsByColor,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/products/:id/generate-all-mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productDoc = await db.collection('products').doc(id).get();
    
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
    
    if (allColors.length === 0) {
      res.status(400).json({ error: 'No colors available for this product' });
      return;
    }
    
    if (!printfulClient.isConfigured) {
      res.status(500).json({ error: 'Printful API key not configured' });
      return;
    }
    
    // Start generation in background (respond immediately for long operations)
    res.json({
      success: true,
      message: `Mockup generation started for ${allColors.length} colors. Use regenerate-mockups endpoint for synchronous generation.`,
      productId: id,
      colors: allColors.map((c: any) => c.name),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN PRODUCT VARIANTS ============

app.get('/admin/products/:id/variants', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection('productVariants')
      .where('productId', '==', id)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/variants/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const doc = await db.collection('productVariants').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }
    const current = doc.data()!;
    await db.collection('productVariants').doc(id).update({
      isEnabled: !current.isEnabled,
    });
    const updated = await db.collection('productVariants').doc(id).get();
    res.json(docToObject(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN CATALOG ============

app.get('/admin/catalog/blueprints', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('printifyBlueprints').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/blueprints/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('printifyBlueprints').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CUSTOM DESIGNS (ADMIN) ============

app.get('/admin/designs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('customDesigns')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/designs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('customDesigns').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ QR TEMPLATES ============

app.post('/admin/qr-templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('qrTemplates').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/qr-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('qrTemplates').doc(req.params.id).update(req.body);
    const doc = await db.collection('qrTemplates').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/qr-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('qrTemplates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HOSTING TIERS (ADMIN) ============

app.post('/admin/hosting-tiers', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('hostingTiers').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hostingTiers').doc(req.params.id).update(req.body);
    const doc = await db.collection('hostingTiers').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hostingTiers').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GALLERY (ADMIN) ============

app.post('/admin/gallery', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('galleryItems').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gallery/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('galleryItems').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ LIBRARY ASSETS (TEST - NO AUTH) ============

app.get('/test/admin/background-assets', async (req: Request, res: Response): Promise<void> => {
  try {
    const typeFilter = (req.query.type as string) || 'source';
    const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
    
    if (!validTypes.includes(typeFilter)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }
    
    console.log('[TestBackgroundAssets] GET request - type:', typeFilter);
    const snapshot = await db.collection('libraryAssets').get();
    
    const assets = snapshot.docs
      .map(doc => docToObject(doc))
      .filter(data => data.isActive === true && data.assetType === typeFilter)
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .map(data => {
        const storageUrl = data.storageUrl || '';
        const filename = storageUrl.split('/').pop() || '';
        return {
          ...data,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
          publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
        };
      });
    
    console.log('[TestBackgroundAssets] Returning', assets.length, 'assets');
    res.json(assets);
  } catch (error: any) {
    console.error('[TestBackgroundAssets] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/admin/background-assets', async (req: Request, res: Response): Promise<void> => {
  console.log('[TestBackgroundAssets] POST request received');
  try {
    const { name, assetType, imageData, mimeType, sourceAssetId, cropData, tags, fromZip } = req.body;
    console.log(`[TestBackgroundAssets] Uploading: ${name}, type: ${assetType}, fromZip: ${fromZip}, dataSize: ${imageData?.length || 0}`);
    
    if (!name || !assetType || !imageData) {
      console.log('[TestBackgroundAssets] Missing required fields');
      res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      return;
    }
    
    if (assetType !== 'source' && assetType !== 'cropped') {
      res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      return;
    }
    
    const bucket = storage.bucket();
    let folderPath: string;
    if (assetType === 'cropped') {
      folderPath = 'library/backgrounds/cropped';
    } else if (fromZip) {
      folderPath = 'library/backgrounds/raw/zip';
    } else {
      folderPath = 'library/backgrounds/raw';
    }
    const fileName = `${folderPath}/${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const ext = (mimeType || 'image/png').split('/')[1] || 'png';
    const fullPath = `${fileName}.${ext}`;
    
    const file = bucket.file(fullPath);
    const buffer = Buffer.from(imageData, 'base64');
    
    await file.save(buffer, {
      metadata: {
        contentType: mimeType || 'image/png',
      },
    });
    
    await file.makePublic();
    
    const fileNameOnly = fullPath.split('/').pop() || name;
    const proxyUrl = `/api/library-files/${encodeURIComponent(fileNameOnly)}`;
    const docRef = await db.collection('libraryAssets').add({
      ownerType: 'admin',
      assetType: assetType,
      mediaType: 'image',
      name,
      fileName: fullPath.split('/').pop() || name,
      originalName: name,
      mimeType: mimeType || 'image/png',
      sizeBytes: buffer.length,
      storageUrl: fullPath,
      publicUrl: proxyUrl,
      sourceAssetId: sourceAssetId || null,
      cropData: cropData || null,
      tags: tags || null,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    console.log(`[TestBackgroundAssets] Upload complete: ${doc.id}`);
    
    // If this is a cropped image with a source, handle the source image workflow
    if (assetType === 'cropped' && sourceAssetId) {
      console.log(`[TestBackgroundAssets] Processing source image workflow for: ${sourceAssetId}`);
      
      try {
        // Get the source asset from Firestore
        const sourceDoc = await db.collection('libraryAssets').doc(sourceAssetId).get();
        
        if (sourceDoc.exists) {
          const sourceData = sourceDoc.data();
          if (sourceData && sourceData.storageUrl) {
            // Download the source image from Firebase Storage
            const sourceFile = bucket.file(sourceData.storageUrl);
            const [sourceBuffer] = await sourceFile.download();
            
            // Copy to backgrounds archive folder
            const archiveFileName = `library/backgrounds/archive/${Date.now()}-${sourceData.fileName || sourceData.name}.${(sourceData.mimeType || 'image/png').split('/')[1] || 'png'}`;
            const archiveFile = bucket.file(archiveFileName);
            
            await archiveFile.save(sourceBuffer, {
              metadata: {
                contentType: sourceData.mimeType || 'image/png',
              },
            });
            await archiveFile.makePublic();
            
            console.log(`[TestBackgroundAssets] Archived source to: ${archiveFileName}`);
            
            // Create archive record
            const archiveFileNameOnly = archiveFileName.split('/').pop() || '';
            const archiveProxyUrl = `/api/library-files/${encodeURIComponent(archiveFileNameOnly)}`;
            await db.collection('libraryAssets').add({
              ownerType: 'admin',
              assetType: 'background',
              mediaType: 'image',
              name: sourceData.name,
              fileName: archiveFileNameOnly,
              originalName: sourceData.originalName,
              mimeType: sourceData.mimeType,
              sizeBytes: sourceBuffer.length,
              storageUrl: archiveFileName,
              publicUrl: archiveProxyUrl,
              sourceAssetId: sourceAssetId,
              isActive: true,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            
            // Mark original source as inactive (remove from raw)
            await db.collection('libraryAssets').doc(sourceAssetId).update({
              isActive: false,
            });
            console.log(`[TestBackgroundAssets] Marked source ${sourceAssetId} as inactive`);
          }
        }
      } catch (archiveErr: any) {
        console.error(`[TestBackgroundAssets] Archive failed (non-fatal):`, archiveErr.message);
      }
    }
    
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error("[TestBackgroundAssets] Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Test DELETE endpoint (no auth)
app.delete('/test/admin/background-assets/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`[TestBackgroundAssets] DELETE ${req.params.id}`);
    // Soft delete (set isActive to false)
    await db.collection('libraryAssets').doc(req.params.id).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[TestBackgroundAssets] Delete error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ TEST PRODUCTS ENDPOINTS (no auth) ============

// Get all products (test endpoint)
app.get('/test/admin/products', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('products').where('isEnabled', '==', true).get();
    const products = snapshot.docs.map(doc => docToObject(doc));
    console.log(`[TestProducts] GET returned ${products.length} products`);
    res.json(products);
  } catch (error: any) {
    console.error('[TestProducts] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync products from Printify (test endpoint - placeholder)
app.post('/test/admin/products/sync', async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('[TestProducts] Sync requested (placeholder)');
    res.json({ synced: 0, message: "Sync endpoint ready - Printify integration pending" });
  } catch (error: any) {
    console.error('[TestProducts] Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get stores by role type (test endpoint)
app.get('/test/admin/stores', async (req: Request, res: Response): Promise<void> => {
  try {
    const roleType = req.query.roleType as string;
    console.log(`[TestStores] GET stores for roleType: ${roleType}`);
    
    // Mock data for testing - will be replaced with database queries
    const mockStores: Record<string, Array<{ id: string; name: string; roleType: string; isActive: boolean; channelCount: number }>> = {
      internal: [
        { id: "qrgear-main", name: "QR Gear Main", roleType: "internal", isActive: true, channelCount: 3 },
      ],
      external: [
        { id: "kingdom-connects", name: "Kingdom Connects", roleType: "external", isActive: true, channelCount: 2 },
      ],
      member: [],
    };
    
    const stores = mockStores[roleType] || [];
    res.json(stores);
  } catch (error: any) {
    console.error('[TestStores] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get channels for a store (test endpoint)
app.get('/test/admin/stores/:storeId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    console.log(`[TestChannels] GET channels for store: ${storeId}`);
    
    // Mock data for testing - will be replaced with database queries
    const mockChannels: Record<string, Array<{ id: string; name: string; storeId: string; isActive: boolean; productCount: number }>> = {
      "qrgear-main": [
        { id: "homepage", name: "Homepage", storeId: "qrgear-main", isActive: true, productCount: 12 },
        { id: "apparel", name: "Apparel", storeId: "qrgear-main", isActive: true, productCount: 8 },
        { id: "accessories", name: "Accessories", storeId: "qrgear-main", isActive: true, productCount: 5 },
      ],
      "kingdom-connects": [
        { id: "church-merch", name: "Church Merch", storeId: "kingdom-connects", isActive: true, productCount: 6 },
        { id: "ministry-items", name: "Ministry Items", storeId: "kingdom-connects", isActive: true, productCount: 4 },
      ],
    };
    
    const channels = mockChannels[storeId] || [];
    res.json(channels);
  } catch (error: any) {
    console.error('[TestChannels] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ LIBRARY ASSETS (ADMIN) ============

app.get('/admin/background-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[BackgroundAssets] GET request - fetching all libraryAssets');
    const snapshot = await db.collection('libraryAssets').get();
    console.log('[BackgroundAssets] Total docs in collection:', snapshot.size);
    
    const allDocs = snapshot.docs.map(doc => {
      const data = docToObject(doc);
      console.log(`[BackgroundAssets] Doc ${doc.id}: assetType=${data.assetType}, isActive=${data.isActive}`);
      return data;
    });
    
    const assets = allDocs
      .filter(data => data.isActive === true && data.assetType === 'source')
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .map(data => {
        const storageUrl = data.storageUrl || '';
        const filename = storageUrl.split('/').pop() || '';
        return {
          ...data,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
          publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
        };
      });
    
    console.log('[BackgroundAssets] Filtered background assets:', assets.length);
    res.json(assets);
  } catch (error: any) {
    console.error('[BackgroundAssets] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/background-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  console.log('[BackgroundAssets] POST request received');
  try {
    const { name, assetType, imageData, mimeType, sourceAssetId, cropData, tags, fromZip } = req.body;
    console.log(`[BackgroundAssets] Uploading: ${name}, type: ${assetType}, fromZip: ${fromZip}, dataSize: ${imageData?.length || 0}`);
    
    if (!name || !assetType || !imageData) {
      console.log('[BackgroundAssets] Missing required fields');
      res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      return;
    }
    
    if (assetType !== 'source' && assetType !== 'cropped') {
      res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      return;
    }
    
    // Upload to Firebase Storage with organized paths
    // library/backgrounds/raw/ for individual uploads
    // library/backgrounds/raw/zip/ for ZIP uploads
    // library/backgrounds/cropped/ for cropped versions
    const bucket = storage.bucket();
    let folderPath: string;
    if (assetType === 'cropped') {
      folderPath = 'library/backgrounds/cropped';
    } else if (fromZip) {
      folderPath = 'library/backgrounds/raw/zip';
    } else {
      folderPath = 'library/backgrounds/raw';
    }
    const fileName = `${folderPath}/${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const ext = (mimeType || 'image/png').split('/')[1] || 'png';
    const fullPath = `${fileName}.${ext}`;
    
    const file = bucket.file(fullPath);
    const buffer = Buffer.from(imageData, 'base64');
    
    await file.save(buffer, {
      metadata: {
        contentType: mimeType || 'image/png',
      },
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fullPath}`;
    
    // Save metadata to Firestore libraryAssets collection
    const fileNameOnly = fullPath.split('/').pop() || name;
    const proxyUrl = `/api/library-files/${encodeURIComponent(fileNameOnly)}`;
    const docRef = await db.collection('libraryAssets').add({
      ownerType: 'admin',
      assetType: assetType, // Use the requested type (source/cropped), not hardcoded
      mediaType: 'image',
      name,
      fileName: fullPath.split('/').pop() || name,
      originalName: name,
      mimeType: mimeType || 'image/png',
      sizeBytes: buffer.length,
      storageUrl: fullPath, // Relative path without gs:// prefix
      publicUrl: proxyUrl,
      sourceAssetId: sourceAssetId || null,
      cropData: cropData || null,
      tags: tags || null,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    const doc = await docRef.get();
    console.log(`[BackgroundAssets] Upload complete: ${doc.id}`);
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error("[BackgroundAssets] Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/background-assets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Soft delete (set isActive to false)
    await db.collection('libraryAssets').doc(req.params.id).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync storage folder with database - creates DB records for existing files
app.post('/admin/background-assets/sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const folder = req.body.folder || 'library/backgrounds/raw';
    const assetType = folder.includes('cropped') ? 'cropped' : 'source';
    
    console.log(`[BackgroundAssets] Syncing folder: ${folder}`);
    
    // List all files in the storage folder
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: folder + '/' });
    
    const storageFiles = files
      .filter(f => !f.name.endsWith('/'))
      .map(f => ({
        name: f.name.split('/').pop() || f.name,
        fullPath: f.name,
        contentType: f.metadata.contentType || 'application/octet-stream',
      }));
    
    console.log(`[BackgroundAssets] Found ${storageFiles.length} files in storage`);
    
    // Get existing records from Firestore libraryAssets - filter in memory to avoid index
    const existingSnapshot = await db.collection('libraryAssets').get();
    const existingPaths = new Set(
      existingSnapshot.docs
        .map(d => d.data())
        .filter(data => data.isActive === true && data.assetType === 'source')
        .map(data => data.storageUrl)
    );
    
    // Find files that don't have database records
    const newFiles = storageFiles.filter(f => !existingPaths.has(`gs://${bucket.name}/${f.fullPath}`));
    console.log(`[BackgroundAssets] ${newFiles.length} files need database records`);
    
    // Create database records for new files
    const createdAssets: any[] = [];
    for (const file of newFiles) {
      if (!file.contentType.startsWith('image/')) continue;
      
      try {
        const displayName = file.name.replace(/\.[^/.]+$/, '');
        const proxyUrl = `/api/library-files/${encodeURIComponent(file.name)}`;
        
        const docRef = await db.collection('libraryAssets').add({
          ownerType: 'admin',
          assetType: 'background',
          mediaType: 'image',
          name: displayName,
          fileName: file.name,
          originalName: file.name,
          mimeType: file.contentType,
          sizeBytes: 0,
          storageUrl: `gs://${bucket.name}/${file.fullPath}`,
          publicUrl: proxyUrl,
          sourceAssetId: null,
          cropData: null,
          tags: null,
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        const doc = await docRef.get();
        createdAssets.push(docToObject(doc));
        console.log(`[BackgroundAssets] Created record for: ${file.name}`);
      } catch (err) {
        console.error(`[BackgroundAssets] Failed to create record for ${file.name}:`, err);
      }
    }
    
    res.json({
      scanned: storageFiles.length,
      existing: existingSnapshot.size,
      created: createdAssets.length,
      assets: createdAssets,
    });
  } catch (error: any) {
    console.error("Error syncing background assets:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ COUPONS (ADMIN) ============

app.get('/admin/coupons', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('coupons').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/coupons', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('coupons').add({
      ...req.body,
      redemptionCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).update(req.body);
    const doc = await db.collection('coupons').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GIFT PACKAGES (ADMIN) ============

app.get('/admin/gift-packages', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftPackages').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/gift-packages', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('giftPackages').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gift-packages/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('giftPackages').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GIFT CODES (ADMIN) ============

app.get('/admin/gift-codes', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftCodes').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/gift-codes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('giftCodes').add({
      ...req.body,
      isRedeemed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gift-codes/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('giftCodes').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PUBLIC GIFT CODE VALIDATION ============

app.get('/gift-codes/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftCodes')
      .where('code', '==', req.params.code.toUpperCase())
      .where('isRedeemed', '==', false)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      res.status(404).json({ error: 'Gift code not found or already redeemed' });
      return;
    }
    
    const giftCode = docToObject(snapshot.docs[0]);
    
    if (giftCode.expiresAt && new Date(giftCode.expiresAt) < new Date()) {
      res.status(400).json({ error: 'Gift code has expired' });
      return;
    }
    
    res.json(giftCode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRINTIFY STATUS ============

app.get('/printify/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ 
      connected: printifyClient.isConfigured, 
      mode: 'firebase-functions',
      message: printifyClient.isConfigured 
        ? 'Printify integration is configured and ready'
        : 'Printify API key or Shop ID not configured'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN ORDER FULFILLMENT ============

// Get all orders with fulfillment status
app.get('/admin/orders', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const orders = await Promise.all(snapshot.docs.map(async (doc) => {
      const order = docToObject(doc);
      
      // Get order items count
      const itemsSnapshot = await db.collection('orderItems')
        .where('orderId', '==', doc.id)
        .get();
      
      return {
        ...order,
        itemCount: itemsSnapshot.size,
      };
    }));
    
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order with items
app.get('/admin/orders/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderDoc = await db.collection('orders').doc(req.params.id).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = docToObject(orderDoc);
    
    // Get order items
    const itemsSnapshot = await db.collection('orderItems')
      .where('orderId', '==', req.params.id)
      .get();
    
    const items = docsToArray(itemsSnapshot);
    
    res.json({ ...order, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit order to Printify for fulfillment
app.post('/admin/orders/:id/submit-to-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    // Get the order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    // Check if already submitted
    if (order.printifyOrderId) {
      res.json({ 
        success: true, 
        message: 'Order already submitted to Printify',
        printifyOrderId: order.printifyOrderId 
      });
      return;
    }
    
    // Get shipping address from order or request body
    let shippingAddress = order.shippingAddress || req.body.shippingAddress;
    
    if (!shippingAddress) {
      res.status(400).json({ 
        error: 'Shipping address required. Provide in request body or ensure order has shipping address.' 
      });
      return;
    }
    
    // Add email if not present
    if (!shippingAddress.email) {
      shippingAddress.email = order.customerEmail || '';
    }
    
    // Submit to Printify
    const result = await submitOrderToPrintify(orderId, shippingAddress);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Order submitted to Printify successfully',
        printifyOrderId: result.printifyOrderId 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync order status from Printify
app.post('/admin/orders/:id/sync-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    if (!order.printifyOrderId) {
      res.status(400).json({ error: 'Order has not been submitted to Printify' });
      return;
    }
    
    const printifyStatus = await checkPrintifyOrderStatus(order.printifyOrderId);
    
    if (!printifyStatus) {
      res.status(500).json({ error: 'Failed to get status from Printify' });
      return;
    }
    
    // Map Printify status to our status
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'on-hold': 'pending',
      'payment-not-received': 'pending',
      'in-production': 'in_production',
      'fulfilled': 'shipped',
      'canceled': 'cancelled',
    };
    
    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (printifyStatus.status) {
      updates.status = statusMap[printifyStatus.status] || printifyStatus.status;
    }
    // Check if tracking was just added (for shipping notification email)
    const hadTrackingBefore = !!order.trackingNumber;

    if (printifyStatus.trackingNumber) {
      updates.trackingNumber = printifyStatus.trackingNumber;
      updates.trackingUrl = printifyStatus.trackingUrl;
      updates.carrier = printifyStatus.carrier;
    }
    
    await db.collection('orders').doc(orderId).update(updates);

    // Reload order data to confirm tracking was added
    const updatedOrderDoc = await db.collection('orders').doc(orderId).get();
    const updatedOrder = updatedOrderDoc.data()!;
    const hasTrackingNow = !!updatedOrder.trackingNumber;
    const hasNewTracking = hasTrackingNow && !hadTrackingBefore;

    // Send shipping notification email via NexusMail if tracking was just added
    let emailSent = false;
    if (hasNewTracking && updatedOrder.customerEmail) {
      const shippingAddress = updatedOrder.shippingAddress;
      const customerName = shippingAddress 
        ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
        : 'Customer';

      const emailResult = await nexusShippingNotification(
        db,
        orderId,
        updatedOrder.customerEmail,
        customerName,
        updatedOrder.trackingNumber,
        updatedOrder.carrier || 'Carrier',
        updatedOrder.trackingUrl
      );
      emailSent = emailResult.success;
    }
    
    res.json({ 
      success: true, 
      status: updates.status,
      trackingNumber: updates.trackingNumber,
      shippingEmailSent: emailSent,
      message: 'Order status synced from Printify'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send shipping notification email manually
app.post('/admin/orders/:id/send-shipping-email', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    if (!order.trackingNumber) {
      res.status(400).json({ error: 'Order has no tracking number' });
      return;
    }
    
    if (!order.customerEmail) {
      res.status(400).json({ error: 'Order has no customer email' });
      return;
    }
    
    const shippingAddress = order.shippingAddress;
    const customerName = shippingAddress 
      ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
      : 'Customer';

    // Use NexusMail for shipping notification (with admin override to bypass idempotency)
    const result = await nexusShippingNotification(
      db,
      orderId,
      order.customerEmail,
      customerName,
      order.trackingNumber,
      order.carrier || 'Carrier',
      order.trackingUrl
    );
    
    if (result.success) {
      res.json({ success: true, message: 'Shipping notification email sent via NexusMail' });
    } else {
      res.status(500).json({ success: false, error: result.reason });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resend order confirmation email
app.post('/admin/orders/:id/resend-confirmation', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    if (!order.customerEmail) {
      res.status(400).json({ error: 'Order has no customer email' });
      return;
    }
    
    // Get order items
    const orderItemsSnapshot = await db.collection('orderItems')
      .where('orderId', '==', orderId)
      .get();
    
    const emailItems = await Promise.all(orderItemsSnapshot.docs.map(async (doc) => {
      const item = doc.data();
      let productName = 'Product';
      if (item.productId) {
        const productDoc = await db.collection('products').doc(item.productId).get();
        if (productDoc.exists) {
          productName = productDoc.data()?.name || 'Product';
        }
      }
      return {
        productName,
        quantity: item.quantity || 1,
        price: item.price || '0',
      };
    }));

    const shippingAddress = order.shippingAddress;
    const customerName = shippingAddress 
      ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
      : 'Customer';

    // Use NexusMail for order confirmation
    const result = await nexusOrderConfirmation(
      db,
      orderId,
      order.customerEmail,
      customerName,
      emailItems,
      order.totalAmount || '0',
      shippingAddress ? {
        address1: shippingAddress.address1,
        address2: shippingAddress.address2,
        city: shippingAddress.city,
        region: shippingAddress.region,
        zip: shippingAddress.zip,
        country: shippingAddress.country,
      } : undefined
    );
    
    if (result.success) {
      res.json({ success: true, message: 'Order confirmation email resent via NexusMail' });
    } else {
      res.status(500).json({ success: false, error: result.reason });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status manually
app.patch('/admin/orders/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    const { status, trackingNumber, carrier, notes } = req.body;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (status) updates.status = status;
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (carrier !== undefined) updates.carrier = carrier;
    if (notes !== undefined) updates.notes = notes;
    
    await db.collection('orders').doc(orderId).update(updates);
    
    const updatedDoc = await db.collection('orders').doc(orderId).get();
    res.json(docToObject(updatedDoc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ NEXUSMAIL ADMIN ENDPOINTS ============

// Get NexusMail status and health
app.get('/admin/nexusmail/status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const service = getNexusMailService(db);
    const isReady = service.isReady();
    const healthScore = service.getHealthScore();
    const stats = await service.getStats();

    res.json({
      ready: isReady,
      provider: isReady ? 'resend' : 'not_configured',
      health: healthScore,
      outboxStats: stats,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seed default email templates
app.post('/admin/nexusmail/seed-templates', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const service = getNexusMailService(db);
    const templateStore = service.getTemplateStore();
    const seeded = await seedDefaultTemplates(templateStore);
    
    res.json({ 
      success: true, 
      message: `Seeded ${seeded} templates`,
      templatesSeeded: seeded,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get outbox records
app.get('/admin/nexusmail/outbox', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const service = getNexusMailService(db);
    const outboxRepo = service.getOutboxRepo();
    const limit = parseInt(req.query.limit as string) || 50;
    const records = await outboxRepo.getRecent(limit);
    
    res.json({ records });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Process pending outbox items
app.post('/admin/nexusmail/process-outbox', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const service = getNexusMailService(db);
    const limit = parseInt(req.body.limit) || 10;
    const sent = await service.processOutbox(limit);
    
    res.json({ 
      success: true, 
      sent,
      message: `Processed ${sent} emails`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Retry failed outbox items
app.post('/admin/nexusmail/retry-failed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const service = getNexusMailService(db);
    const limit = parseInt(req.body.limit) || 10;
    const sent = await service.retryFailed(limit);
    
    res.json({ 
      success: true, 
      sent,
      message: `Retried and sent ${sent} emails`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STRIPE WEBHOOKS ============

app.post('/webhooks/stripe', async (req: Request, res: Response): Promise<void> => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!sig || !webhookSecret) {
      res.status(400).json({ error: 'Missing signature or webhook secret' });
      return;
    }
    
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }
    
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);
        
        // Create order from checkout session
        try {
          const userId = session.metadata?.userId;
          const cartItemIds = session.metadata?.cartItemIds ? JSON.parse(session.metadata.cartItemIds) : [];
          
          if (!userId) {
            console.error('No userId in checkout session metadata');
            break;
          }

          // Idempotency check: prevent duplicate orders from Stripe retries
          const existingOrderSnapshot = await db.collection('orders')
            .where('stripeSessionId', '==', session.id)
            .limit(1)
            .get();
          
          if (!existingOrderSnapshot.empty) {
            console.log(`Order already exists for session ${session.id}, skipping`);
            break;
          }

          // Get cart items
          let cartItems: any[] = [];
          if (cartItemIds.length > 0) {
            // Use specific cart item IDs from metadata
            for (const itemId of cartItemIds) {
              const itemDoc = await db.collection('cartItems').doc(itemId).get();
              if (itemDoc.exists) {
                cartItems.push({ id: itemDoc.id, ...itemDoc.data() });
              }
            }
          } else {
            // Fallback: get all cart items for user
            const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
            cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }

          if (cartItems.length === 0) {
            console.warn('No cart items found for order creation');
            break;
          }

          // Calculate total from cart items
          const totalAmount = cartItems.reduce((sum, item) => {
            return sum + parseFloat(item.price || '0') * (item.quantity || 1);
          }, 0);

          // Extract shipping address from Stripe session
          const shippingDetails = session.shipping_details;
          const customerDetails = session.customer_details;
          const shippingAddress = shippingDetails ? {
            firstName: shippingDetails.name?.split(' ')[0] || '',
            lastName: shippingDetails.name?.split(' ').slice(1).join(' ') || '',
            email: customerDetails?.email || '',
            phone: shippingDetails.phone || customerDetails?.phone || '',
            address1: shippingDetails.address?.line1 || '',
            address2: shippingDetails.address?.line2 || '',
            city: shippingDetails.address?.city || '',
            region: shippingDetails.address?.state || '',
            zip: shippingDetails.address?.postal_code || '',
            country: shippingDetails.address?.country || 'US',
          } : null;

          // Create order
          const orderRef = await db.collection('orders').add({
            userId,
            status: 'paid',
            totalAmount: totalAmount.toFixed(2),
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent as string,
            customerEmail: session.customer_details?.email || null,
            shippingAddress,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`Order created: ${orderRef.id}`);

          // Create order items from cart
          for (const item of cartItems) {
            await db.collection('orderItems').add({
              orderId: orderRef.id,
              productId: item.productId,
              quantity: item.quantity || 1,
              price: item.price,
              customization: item.customization || {},
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          console.log(`Created ${cartItems.length} order items for order ${orderRef.id}`);

          // Send order confirmation email BEFORE clearing cart (use orderItems data)
          const customerEmail = customerDetails?.email;
          if (customerEmail) {
            // Fetch order items we just created for accurate email data
            const orderItemsSnapshot = await db.collection('orderItems')
              .where('orderId', '==', orderRef.id)
              .get();
            
            const emailItems = await Promise.all(orderItemsSnapshot.docs.map(async (doc) => {
              const item = doc.data();
              let productName = 'Product';
              if (item.productId) {
                const productDoc = await db.collection('products').doc(item.productId).get();
                if (productDoc.exists) {
                  productName = productDoc.data()?.name || 'Product';
                }
              }
              return {
                productName,
                quantity: item.quantity || 1,
                price: item.price || '0',
              };
            }));

            const customerName = shippingAddress 
              ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
              : customerDetails?.name || 'Customer';

            // Use NexusMail for order confirmation (queue-first, idempotent)
            await nexusOrderConfirmation(
              db,
              orderRef.id,
              customerEmail,
              customerName,
              emailItems,
              totalAmount.toFixed(2),
              shippingAddress ? {
                address1: shippingAddress.address1,
                address2: shippingAddress.address2,
                city: shippingAddress.city,
                region: shippingAddress.region,
                zip: shippingAddress.zip,
                country: shippingAddress.country,
              } : undefined
            );
          }

          // Clear cart items AFTER email is sent
          const batch = db.batch();
          for (const item of cartItems) {
            batch.delete(db.collection('cartItems').doc(item.id));
          }
          await batch.commit();
          console.log(`Cleared ${cartItems.length} cart items for user ${userId}`);

        } catch (orderError: any) {
          console.error('Error creating order from checkout:', orderError);
          // Don't fail the webhook - order can be manually reconciled
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN LIBRARY ENDPOINTS ============

// Admin: Get all library assets with optional filters
app.get('/admin/library', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerType, assetType, mediaType, category, season, event } = req.query;
    let query: FirebaseFirestore.Query = db.collection('libraryAssets');
    
    if (ownerType) query = query.where('ownerType', '==', ownerType);
    if (assetType) query = query.where('assetType', '==', assetType);
    if (mediaType) query = query.where('mediaType', '==', mediaType);
    if (category) query = query.where('category', '==', category);
    if (season) query = query.where('season', '==', season);
    if (event) query = query.where('event', '==', event);
    
    const snapshot = await query.get();
    const assets = docsToArray(snapshot);
    const assetsWithSignedUrls = await addSignedUrlsToAssets(assets);
    res.json(assetsWithSignedUrls);
  } catch (error: any) {
    console.error('[Library] Error fetching assets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get admin-owned library assets
app.get('/admin/library/admin', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetType, mediaType, category, season, event } = req.query;
    let query: FirebaseFirestore.Query = db.collection('libraryAssets').where('ownerType', '==', 'admin');
    
    if (assetType) query = query.where('assetType', '==', assetType);
    if (mediaType) query = query.where('mediaType', '==', mediaType);
    if (category) query = query.where('category', '==', category);
    if (season) query = query.where('season', '==', season);
    if (event) query = query.where('event', '==', event);
    
    const snapshot = await query.get();
    const assets = docsToArray(snapshot);
    const assetsWithSignedUrls = await addSignedUrlsToAssets(assets);
    res.json(assetsWithSignedUrls);
  } catch (error: any) {
    console.error('[Library] Error fetching admin assets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get library templates (custom designs saved to library)
app.get('/admin/library/templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('customDesigns')
      .where('savedToLibrary', '==', true)
      .get();
    const templates = docsToArray(snapshot);
    res.json(templates);
  } catch (error: any) {
    console.error('[Library] Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Create library asset
app.post('/admin/library', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const assetData = {
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection('libraryAssets').add(assetData);
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error('[Library] Error creating asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update library asset
app.put('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('libraryAssets').doc(id).update(updateData);
    const doc = await db.collection('libraryAssets').doc(id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error('[Library] Error updating asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete library asset
app.delete('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.collection('libraryAssets').doc(id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Library] Error deleting asset:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export the API function with increased timeout and memory for large uploads
export const api = onRequest(
  {
    timeoutSeconds: 540,  // 9 minutes max
    memory: '1GiB',
    cors: true,
  },
  app
);
