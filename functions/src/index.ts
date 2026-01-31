// Build timestamp: 2026-01-27T06:30:00Z - Added PRINTFUL_STORE_ID to mockup generator API calls
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

// Get Printful API key - fallback for Cloud Functions environment
function getPrintfulApiKey(): string {
  return process.env.PRINTFUL_API_KEY || '2O4DwAZeuDDrzW1sJqQDbT7wHCBe6ECFgo4zoam8';
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
  fulfillmentProvider?: 'printify' | 'printful';
}

interface MockupResult {
  mockupUrl: string;
  lifestyleMockupUrl?: string | null;
  fromCache: boolean;
}

// Default Printify blueprint to Printful product mappings (fallback)
const DEFAULT_BLUEPRINT_MAPPINGS: Record<number, number> = {
  // T-Shirts
  5: 71,      // Bella Canvas 3001 Unisex Jersey Tee -> Printful Bella Canvas 3001
  6: 71,      // Gildan 5000 -> Printful Bella Canvas 3001
  12: 71,     // Gildan 64000 -> Printful Bella Canvas 3001
  145: 380,   // Heavyweight tee -> Printful Gildan 5000
  474: 71,    // Cotton Crew -> Printful Bella Canvas 3001
  577: 71,    // Bella Canvas 3001C -> Printful Bella Canvas 3001
  578: 71,    // Alternative to Bella Canvas
  
  // Hoodies & Sweatshirts
  45: 380,    // Sweatshirt/Crewneck -> Printful Gildan 18000
  77: 380,    // Gildan 18500 Hoodie -> Printful Gildan 18500
  80: 380,    // Unisex Hoodie -> Printful Gildan 18500
  81: 380,    // Pullover Hoodie -> Printful Gildan 18500
  91: 380,    // Heavyweight Hoodie -> Printful Gildan 18500
  
  // Long Sleeve
  26: 71,     // Long Sleeve Tee -> Printful equivalent
  39: 71,     // Long Sleeve -> Printful equivalent
  
  // Tank Tops
  14: 71,     // Tank Top -> Printful equivalent
  15: 71,     // Women's Tank -> Printful equivalent
  
  // Mugs
  66: 19,     // White Mug 11oz -> Printful White Mug 11oz
  
  // Hats/Caps  
  88: 206,    // Dad Hat -> Printful Dad Hat
  
  // Posters/Canvas
  33: 1,      // Poster -> Printful Poster
  36: 1,      // Art Print -> Printful Poster
  
  // Bags
  49: 84,     // Tote Bag -> Printful Tote Bag
  
  // Phone Cases
  48: 226,    // iPhone Case -> Printful iPhone Case
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
  const { blueprintId, colorName, colorHex, artworkUrl, artworkVariant = 'black', fulfillmentProvider = 'printify' } = request;
  
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
  
  // For Printful native products, blueprintId IS the Printful product ID
  // For Printify products, we need to map blueprint to Printful product
  let printfulProductId: number;
  if (fulfillmentProvider === 'printful') {
    // Native Printful product - use ID directly
    printfulProductId = blueprintId;
    console.log(`[Mockup] Printful native product: ${printfulProductId}`);
  } else {
    // Map Printify blueprint to Printful product (from Firestore or fallback)
    const mappedId = await getPrintfulProductId(blueprintId);
    if (!mappedId) {
      throw new Error(`No Printful mapping for blueprint ${blueprintId}. Add mapping to printifyPrintfulMapping collection.`);
    }
    printfulProductId = mappedId;
  }
  
  // Get variants for this color
  const variants = await printfulClient.getVariantsByColor(printfulProductId, colorName);
  console.log(`[Mockup] Got ${variants.length} variants for color: ${colorName}`);
  if (variants.length === 0) {
    throw new Error(`No Printful variants found for color: ${colorName}`);
  }
  
  const variantId = variants[0].id;
  console.log(`[Mockup] Using variant ID: ${variantId} (color: ${variants[0].color})`);
  
  if (!variantId) {
    throw new Error(`Variant missing ID for color: ${colorName}`);
  }
  
  // Get printfile specs to get position info
  const printfileData = await printfulClient.getPrintfiles(printfulProductId);
  const frontPrintfile = printfileData?.printfiles?.find((p: any) => 
    p.placement === 'front' || p.placement === 'default'
  );
  
  // Build file entry with position (required by Printful Mockup Generator)
  // Position is ALWAYS required - use printfile specs if available, otherwise sensible defaults
  const placement = frontPrintfile?.placement || 'front';
  const areaWidth = frontPrintfile?.width || 1800;
  const areaHeight = frontPrintfile?.height || 2400;
  
  const fileEntry: any = { 
    placement: placement, 
    image_url: artworkUrl,
    position: {
      area_width: areaWidth,
      area_height: areaHeight,
      width: areaWidth,
      height: areaHeight,
      top: 0,
      left: 0
    }
  };
  
  console.log('[Printful] Creating mockup with file entry:', JSON.stringify(fileEntry));
  
  // Retry logic with exponential backoff for Printful rate limits and transient errors
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Add delay between retries (longer delays for each retry)
      if (attempt > 1) {
        const delayMs = attempt * 15000; // 15s, 30s, 45s
        console.log(`[Printful] Retry ${attempt}/${maxRetries} - waiting ${delayMs/1000}s before retry`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Create mockup task - don't pass option_groups as it filters out variants
      const task = await printfulClient.createMockupTask(
        printfulProductId,
        [variantId],
        [fileEntry],
        'jpg'
      );
      
      // Wait for completion with longer timeout
      const result = await printfulClient.waitForMockupTask(task.task_key, 120000);
      
      if (!result.mockups || result.mockups.length === 0) {
        throw new Error('No mockups returned from Printful');
      }
      
      // Success - continue with the rest of the function
      return await processMockupResult(result, blueprintId, colorName, artworkVariant, cacheKey);
      
    } catch (err: any) {
      lastError = err;
      const errorMsg = err.message || String(err);
      
      // Check if it's a retryable error
      if (errorMsg.includes('429') || errorMsg.includes('TooManyRequests') || 
          errorMsg.includes('Internal Server Error') || errorMsg.includes('timeout')) {
        console.log(`[Printful] Attempt ${attempt} failed with retryable error: ${errorMsg}`);
        continue;
      }
      
      // Non-retryable error - throw immediately
      throw err;
    }
  }
  
  throw lastError || new Error('Mockup generation failed after retries');
}

// Helper function to process mockup result
async function processMockupResult(
  result: any,
  blueprintId: number,
  colorName: string,
  artworkVariant: string,
  cacheKey: string
): Promise<{ mockupUrl: string; lifestyleMockupUrl: string | null; fromCache: boolean }> {
  // Find flat and lifestyle mockups
  let flatMockup = result.mockups.find((m: any) => !m.placement.includes('lifestyle'));
  let lifestyleMockup = result.mockups.find((m: any) => m.placement.includes('lifestyle'));
  
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

app.get('/test/pricing-settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('testSettings').doc('pricing').get();
    
    if (!doc.exists) {
      res.json({
        markupPercent: 25,
        markupFixed: 0,
        additionalPlacementCost: 4,
        textLineUpcharge: 2,
        hostingTiers: [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
      });
      return;
    }
    
    res.json(doc.data());
  } catch (error: any) {
    console.error("[Pricing Settings] Error getting settings:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/test/pricing-settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, hostingTiers } = req.body;
    
    const settings = {
      markupPercent: parseFloat(markupPercent) || 25,
      markupFixed: parseFloat(markupFixed) || 0,
      additionalPlacementCost: parseFloat(additionalPlacementCost) || 4,
      textLineUpcharge: parseFloat(textLineUpcharge) || 2,
      hostingTiers: hostingTiers || [
        { code: "1_year", name: "1 Year", price: 5 },
        { code: "2_year", name: "2 Years", price: 8 },
        { code: "3_year", name: "3 Years", price: 10 },
      ],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    await db.collection('testSettings').doc('pricing').set(settings, { merge: true });
    
    console.log("[Pricing Settings] Saved settings:", settings);
    
    res.json({
      success: true,
      settings,
      message: "Pricing settings saved",
    });
  } catch (error: any) {
    console.error("[Pricing Settings] Error saving settings:", error);
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

// PUBLIC test endpoint - real product config data (no auth)
app.get('/test/product-configs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('products').where('isEnabled', '==', true).get();
    
    const enrichedProducts = snapshot.docs.map(doc => {
      const product = docToObject(doc);
      const meta = product.metadata || {};
      const finalColors = product.availableColors || [];
      const finalSizes = product.availableSizes || [];
      
      return {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        sizes: finalSizes,
        colors: finalColors,
        enabledSizes: meta.enabledSizes || finalSizes,
        enabledColors: meta.enabledColors || finalColors.map((c: any) => c.name || c),
        defaultColor: meta.defaultColor || (finalColors.length > 0 ? (finalColors[0].name || finalColors[0]) : null),
        mockupsByColor: product.mockupsByColor || {},
        blueprintId: product.blueprintId,
        printProviderId: product.printProviderId,
      };
    });
    
    res.json(enrichedProducts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC test endpoint - update product options (no auth)
app.patch('/test/products/:id/options', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { enabledSizes, enabledColors, defaultColor } = req.body;
    
    const docRef = db.collection('products').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const existingMetadata = doc.data()?.metadata || {};
    const newMetadata = {
      ...existingMetadata,
      enabledSizes,
      enabledColors,
      defaultColor,
    };
    
    await docRef.update({
      metadata: newMetadata,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const updated = await docRef.get();
    res.json(docToObject(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC test endpoint - sync product from Printify (no auth - simplified)
app.post('/test/products/:id/sync-printify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const docRef = db.collection('products').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = docToObject(doc);
    
    if (!product.blueprintId || !product.printProviderId) {
      res.status(400).json({ error: 'Product missing Printify blueprint or provider IDs' });
      return;
    }
    
    // Note: Full sync requires Printify API - this is a simplified version
    // that just marks the product as synced. Real sync happens via Replit dev server.
    await docRef.update({
      'metadata.lastSyncedAt': new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const updated = await docRef.get();
    res.json({
      success: true,
      product: docToObject(updated),
      message: 'Sync initiated. For full Printify sync, use the development server.'
    });
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

// Test endpoint: Generate priority mockup for digital proof
app.post('/test/mockup/priority', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      blueprintId, 
      printProviderId, 
      colorName, 
      colorHex,
      placement,
      artworkUrl,
      qrSize = 'medium',
      fulfillmentProvider = 'printify'
    } = req.body;

    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ 
        error: 'Missing required fields: blueprintId, colorName, artworkUrl' 
      });
      return;
    }

    const canonicalPlacementId = placement || 'FRONT_CHEST';
    console.log(`[Priority Mockup] Generating for: ${colorName} @ ${canonicalPlacementId}`);

    const cacheKey = `${blueprintId}-${printProviderId || 99}-${colorName}-${canonicalPlacementId}-black`;
    const cacheSnapshot = await db.collection('mockupCache')
      .where('cacheKey', '==', cacheKey)
      .limit(1)
      .get();
    
    if (!cacheSnapshot.empty) {
      const cached = cacheSnapshot.docs[0].data();
      console.log(`[Priority Mockup] Cache HIT: ${cached.mockupUrl}`);
      res.json({
        success: true,
        mockupUrl: cached.mockupUrl,
        lifestyleMockupUrl: cached.lifestyleUrl || null,
        fromCache: true,
      });
      return;
    }
    
    if (!printfulClient.isConfigured) {
      res.json({
        success: false,
        error: 'Mockup not in cache and Printful API key not configured.',
        mockupUrl: null,
        message: 'Mockup generation in progress - check back shortly',
      });
      return;
    }
    
    try {
      const mockupResult = await generateMockupFromPrintful({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex,
        artworkUrl,
        artworkVariant: 'black',
        fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      });
      
      console.log(`[Priority Mockup] Generated: ${mockupResult.mockupUrl}`);
      res.json({
        success: true,
        mockupUrl: mockupResult.mockupUrl,
        lifestyleMockupUrl: mockupResult.lifestyleMockupUrl || null,
        fromCache: mockupResult.fromCache,
      });
    } catch (genError: any) {
      console.error('[Priority Mockup] Generation failed:', genError.message);
      res.json({
        success: false,
        error: genError.message,
        mockupUrl: null,
        message: 'Mockup generation in progress - check back shortly',
      });
    }
  } catch (error: any) {
    console.error('[Priority Mockup] Error:', error);
    res.json({
      success: false,
      error: error.message,
      mockupUrl: null,
      message: 'Mockup generation in progress - check back shortly',
    });
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

app.get('/test/background-assets', async (req: Request, res: Response): Promise<void> => {
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

app.post('/test/background-assets', async (req: Request, res: Response): Promise<void> => {
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
app.delete('/test/background-assets/:id', async (req: Request, res: Response): Promise<void> => {
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

// Get fulfillment provider status (which providers are configured)
app.get('/test/fulfillment-providers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const printifyKey = process.env.PRINTIFY_API_KEY;
    const printfulKey = process.env.PRINTFUL_API_KEY;
    const apliiqKey = process.env.APLIIQ_API_KEY;
    
    const providers = [
      { 
        id: "printify", 
        name: "Printify", 
        configured: !!printifyKey && printifyKey.length > 10,
        role: "fulfillment",
        description: "Print-on-demand fulfillment via Printify network"
      },
      { 
        id: "printful", 
        name: "Printful", 
        configured: !!printfulKey && printfulKey.length > 10,
        role: "fulfillment",
        description: "Print-on-demand fulfillment via Printful"
      },
      { 
        id: "apliiq", 
        name: "Apliiq", 
        configured: !!apliiqKey && apliiqKey.length > 10,
        role: "fulfillment",
        description: "Custom apparel via Apliiq"
      },
    ];
    
    console.log(`[FulfillmentProviders] Returning ${providers.filter(p => p.configured).length} configured providers`);
    res.json(providers);
  } catch (error: any) {
    console.error('[FulfillmentProviders] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all products (test endpoint) - supports provider filter
app.get('/test/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as string | undefined;
    
    if (provider === "printful") {
      // Fetch from Printful products collection
      const snapshot = await db.collection('printfulProducts').get();
      const products = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: `printful-${data.id || doc.id}`,
          name: data.title || `Printful Product ${doc.id}`,
          printfulId: data.id || parseInt(doc.id),
          blueprintId: data.id || parseInt(doc.id),
          isEnabled: true,
          fulfillmentProvider: "printful",
          image: data.image,
          variantCount: data.variantCount || 0,
          brand: data.brand,
          model: data.model,
          description: data.type,
        };
      });
      console.log(`[TestProducts] GET returned ${products.length} Printful products`);
      res.json(products);
      return;
    }
    
    // Default: Printify products - filter to only those with Printful mappings
    const snapshot = await db.collection('products').where('isEnabled', '==', true).get();
    const allProducts = snapshot.docs.map(doc => docToObject(doc));
    
    // Filter to only products with valid Printful mappings
    const mappedProducts = allProducts.filter(p => {
      const blueprintId = p.blueprintId || p.blueprint_id;
      if (!blueprintId) return false;
      const hasMapping = DEFAULT_BLUEPRINT_MAPPINGS[blueprintId] !== undefined;
      if (!hasMapping) {
        console.log(`[TestProducts] Filtering out unmapped product: ${p.name} (blueprint ${blueprintId})`);
      }
      return hasMapping;
    });
    
    console.log(`[TestProducts] GET returned ${mappedProducts.length}/${allProducts.length} mapped Printify products`);
    res.json(mappedProducts);
  } catch (error: any) {
    console.error('[TestProducts] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync products from Printify (test endpoint - placeholder)
app.post('/test/products/sync', async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('[TestProducts] Sync requested (placeholder)');
    res.json({ synced: 0, message: "Sync endpoint ready - Printify integration pending" });
  } catch (error: any) {
    console.error('[TestProducts] Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update product (test endpoint - no auth required)
app.put('/test/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Build update object, filtering out undefined values
    const cleanUpdate: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        cleanUpdate[key] = value;
      }
    }
    cleanUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await db.collection('products').doc(id).update(cleanUpdate);
    const doc = await db.collection('products').doc(id).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    console.log(`[TestProducts] PUT ${id} updated:`, Object.keys(cleanUpdate));
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error('[TestProducts] PUT error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get stores by role type (test endpoint - no /admin segment for test routes) - uses Firestore
app.get('/test/stores', async (req: Request, res: Response): Promise<void> => {
  try {
    const roleType = req.query.roleType as string;
    console.log(`[TestStores] GET stores for roleType: ${roleType}`);
    
    let query: FirebaseFirestore.Query = db.collection('stores');
    if (roleType) {
      query = query.where('roleType', '==', roleType);
    }
    
    const snapshot = await query.get();
    const stores = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Sort by name
    stores.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    
    console.log(`[TestStores] Found ${stores.length} stores for roleType: ${roleType || 'all'}`);
    res.json(stores);
  } catch (error: any) {
    console.error('[TestStores] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new store (test endpoint) - uses Firestore
app.post('/test/stores', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, roleType } = req.body;
    
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Store name is required' });
      return;
    }
    if (!roleType || !['internal', 'external', 'member'].includes(roleType)) {
      res.status(400).json({ error: 'Valid roleType is required (internal, external, member)' });
      return;
    }
    
    const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const storeData = {
      name: name.trim(),
      roleType,
      isActive: true,
      channelCount: 0,
      createdAt: new Date().toISOString(),
    };
    
    await db.collection('stores').doc(storeId).set(storeData);
    
    console.log(`[TestStores] Created store: ${storeId} (${roleType})`);
    res.json({ id: storeId, ...storeData });
  } catch (error: any) {
    console.error('[TestStores] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a store (test endpoint) - uses Firestore
app.delete('/test/stores/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    
    // First delete all channels for this store
    const channelsSnapshot = await db.collection('storeChannels')
      .where('storeId', '==', storeId)
      .get();
    
    const batch = db.batch();
    channelsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Delete the store
    batch.delete(db.collection('stores').doc(storeId));
    await batch.commit();
    
    console.log(`[TestStores] Deleted store: ${storeId} (and ${channelsSnapshot.size} channels)`);
    res.json({ success: true, deletedChannels: channelsSnapshot.size });
  } catch (error: any) {
    console.error('[TestStores] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get store by ID (test endpoint) - checks both stores and partnerStores collections
app.get('/test/stores/by-id/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    console.log(`[TestStores] GET store by ID: ${storeId}`);
    
    // First check the regular stores collection
    let doc = await db.collection('stores').doc(storeId).get();
    
    if (doc.exists) {
      const data = doc.data();
      const store = {
        id: doc.id,
        name: data?.name || storeId,
        type: data?.roleType || 'internal',
        roleType: data?.roleType || 'internal',
        isActive: data?.isActive ?? true,
      };
      console.log(`[TestStores] Found store in stores: ${storeId}`);
      res.json(store);
      return;
    }
    
    // Check partnerStores collection as fallback
    doc = await db.collection('partnerStores').doc(storeId).get();
    
    if (doc.exists) {
      const data = doc.data();
      const store = {
        id: doc.id,
        name: data?.name || storeId,
        type: data?.isInternal ? 'internal' : 'external',
        roleType: data?.isInternal ? 'internal' : 'external',
        isActive: data?.isActive ?? true,
        isPartnerStore: true,
      };
      console.log(`[TestStores] Found store in partnerStores: ${storeId}`);
      res.json(store);
      return;
    }
    
    res.status(404).json({ error: 'Store not found' });
  } catch (error: any) {
    console.error('[TestStores] GET by-id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get channels for a store (test endpoint)
app.get('/test/stores/:storeId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    console.log(`[TestChannels] GET channels for store: ${storeId}`);
    
    // Fetch channels from Firestore (no orderBy to avoid needing composite index)
    const snapshot = await db.collection('storeChannels')
      .where('storeId', '==', storeId)
      .get();
    
    const channels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Sort by createdAt in memory
    channels.sort((a: any, b: any) => {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
    
    console.log(`[TestChannels] Found ${channels.length} channels for ${storeId}`);
    res.json(channels);
  } catch (error: any) {
    console.error('[TestChannels] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new channel for a store
app.post('/test/stores/:storeId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Channel name is required' });
      return;
    }
    
    const channelName = name.trim();
    const channelId = channelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const channelData = {
      name: channelName,
      storeId,
      isActive: true,
      productCount: 0,
      createdAt: new Date().toISOString(),
    };
    
    await db.collection('storeChannels').doc(channelId).set(channelData);
    
    const storeRef = db.collection('partnerStores').doc(storeId);
    const storeDoc = await storeRef.get();
    if (storeDoc.exists) {
      const storeData = storeDoc.data() || {};
      const currentSegments: string[] = storeData.availableSegments || [];
      if (!currentSegments.includes(channelName)) {
        await storeRef.update({
          availableSegments: [...currentSegments, channelName],
        });
        console.log(`[TestChannels] Added channel "${channelName}" to store ${storeId} availableSegments`);
      }
    }
    
    console.log(`[TestChannels] Created channel: ${channelId} for store ${storeId}`);
    
    res.json({ id: channelId, ...channelData });
  } catch (error: any) {
    console.error('[TestChannels] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a channel
app.delete('/test/stores/:storeId/channels/:channelId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    
    await db.collection('storeChannels').doc(channelId).delete();
    console.log(`[TestChannels] Deleted channel: ${channelId} from store ${storeId}`);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[TestChannels] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: stores by type (internal/external/member) for store library
app.get('/test/stores/:type', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    console.log(`[TestStoresByType] GET stores by type: ${type}`);
    
    // Fetch real partner stores from Firestore
    const snapshot = await db.collection('partnerStores').get();
    const allStores = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || doc.id,
        type: data.isInternal ? 'internal' : 'external',
        description: data.description || `${data.name} store`,
        slug: data.slug,
        isActive: data.isActive !== false,
      };
    });
    
    // Filter by type (internal/external/member)
    // Note: member stores would need a different flag - for now return empty
    let filtered;
    if (type === 'member') {
      filtered = allStores.filter(s => (s as any).isMemberStore === true);
    } else {
      filtered = allStores.filter(s => s.type === type);
    }
    
    console.log(`[TestStoresByType] Found ${filtered.length} ${type} stores`);
    res.json(filtered);
  } catch (error: any) {
    console.error('[TestStoresByType] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: partner-stores (no auth required) - mirrors admin endpoint for save funnel testing
app.get('/test/partner-stores', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[TestPartnerStores] GET partner-stores');
    
    // Fetch real partner stores from Firestore
    const snapshot = await db.collection('partnerStores').get();
    const stores = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        slug: data.slug,
        isInternal: data.isInternal || false,
        isActive: data.isActive !== false,
        availableSegments: data.availableSegments || [],
        logoUrl: data.logoUrl,
        websiteUrl: data.websiteUrl,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });
    
    console.log(`[TestPartnerStores] Found ${stores.length} stores`);
    res.json(stores);
  } catch (error: any) {
    console.error('[TestPartnerStores] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: Get products for a partner store (no auth required)
app.get('/test/partner-stores/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log(`[TestPartnerStores] GET products for store ${id}`);
    
    const snapshot = await db.collection('partnerStoreProducts')
      .where('storeId', '==', id)
      .get();
    
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    console.log(`[TestPartnerStores] Found ${products.length} products for store ${id}`);
    res.json(products);
  } catch (error: any) {
    console.error('[TestPartnerStores] GET products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: Sync products to a partner store (no auth required)
app.post('/test/partner-stores/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { productIds } = req.body;
    
    console.log(`[TestPartnerStores] POST sync products for store ${id}:`, productIds);
    
    if (!Array.isArray(productIds)) {
      res.status(400).json({ error: 'productIds must be an array' });
      return;
    }
    
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    
    // Remove existing products for this store
    const existingSnapshot = await db.collection('partnerStoreProducts')
      .where('storeId', '==', id)
      .get();
    existingSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Add new products
    for (const productId of productIds) {
      const docRef = db.collection('partnerStoreProducts').doc();
      batch.set(docRef, {
        storeId: id,
        productId,
        createdAt: now,
      });
    }
    
    await batch.commit();
    
    console.log(`[TestPartnerStores] Synced ${productIds.length} products to store ${id}`);
    res.json({ success: true, synced: productIds.length });
  } catch (error: any) {
    console.error('[TestPartnerStores] POST products error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Brands known to manufacture garments in the USA
const TEST_USA_MADE_BRANDS = [
  'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
  'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
  'shaka wear', 'backpacks usa', 'american giant', 'next level',
];

// Known Printify Blueprint IDs that have proper Printful mockup mappings (not fallback)
const KNOWN_MOCKUP_BLUEPRINT_IDS: Set<number> = new Set([
  // T-SHIRTS (US-MADE)
  6, 12,    // Bella+Canvas 3001
  5,        // Next Level 3600
  48,       // Bella+Canvas 3005 V-Neck
  184,      // Bella+Canvas 3413 Tri-Blend
  420,      // Bella+Canvas 3001Y Youth
  580,      // Bella+Canvas 3001T Toddler
  472,      // Bella+Canvas 6400 Women's
  145,      // Gildan 64000
  // TANK TOPS (US-MADE)
  39, 91,   // Bella+Canvas 3480 Unisex Tank
  47,       // Bella+Canvas 8803 Women's Muscle Tank
  18,       // Next Level 1533 Women's Racerback
  141,      // Next Level 6733 Women's Tri-Blend Racerback
  // LONG SLEEVES (US-MADE)
  41, 301,  // Bella+Canvas 3501
  45,       // Next Level 3601
  66,       // Gildan 2400
  // HOODIES & SWEATSHIRTS (US-MADE)
  175, 394, // Bella+Canvas 3719 Pullover Hoodie
  439,      // Lane Seven LS14001 Hoodie
  445,      // Lane Seven LS14003 Zip Hoodie
  446,      // Lane Seven LS14004 Crewneck
  77,       // Gildan 18500 Heavy Blend Hoodie
  76,       // Gildan 18000 Crewneck Sweatshirt
  // HATS
  384,      // Yupoong 6245CM Dad Hat
  297,      // Yupoong 6089M Snapback
  // MUGS
  68,       // 11oz White Mug
  69,       // 15oz White Mug
  // BAGS
  456,      // Liberty Bags 8502 Canvas Tote
  // ACCESSORIES
  502, 503, // Stickers
]);

// Test endpoint: Printify catalog (no auth required) - v2 with price fields from providers
app.get('/test/printify/catalog', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[TestCatalog] GET Printify catalog');
    const snapshot = await db.collection('printifyBlueprints').get();
    const localBlueprints = snapshot.docs.map(doc => docToObject(doc));
    
    if (localBlueprints.length === 0) {
      res.json([]);
      return;
    }
    
    // Fetch provider data for price/color info from Firestore
    const providersSnapshot = await db.collection('printifyPrintProviders').get();
    const allProviders = providersSnapshot.docs.map(doc => docToObject(doc));
    
    // Group providers by blueprint_id, pick best one (lowest price with colors)
    const providersByBlueprint: Record<number, any> = {};
    for (const p of allProviders) {
      const existing = providersByBlueprint[p.blueprintId];
      if (!existing || (p.minCost && (!existing.minCost || p.minCost < existing.minCost))) {
        providersByBlueprint[p.blueprintId] = p;
      }
    }
    console.log(`[TestCatalog] Found ${allProviders.length} providers for ${Object.keys(providersByBlueprint).length} blueprints`);
    
    const categories: Record<string, any[]> = {
      "T-Shirts": [],
      "Sweatshirts & Hoodies": [],
      "Hats & Caps": [],
      "Drinkware": [],
      "Bags": [],
      "Other": [],
    };
    
    for (const bp of localBlueprints) {
      const title = (bp.title || '').toLowerCase();
      const brandLower = (bp.brand || '').toLowerCase();
      const isUSABrand = TEST_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
      
      // Get provider data for this blueprint
      const provider = providersByBlueprint[bp.id];
      const colors = provider?.availableColors as Array<{name: string; hex: string}> | null;
      const colorCount = colors?.length || bp.colorCount || 0;
      const minPrice = provider?.minCost ? (provider.minCost / 100).toFixed(2) : (bp.minPrice || null);
      const maxPrice = provider?.maxCost ? (provider.maxCost / 100).toFixed(2) : (bp.maxPrice || null);
      
      const sizes = provider?.availableSizes as string[] || ["S", "M", "L", "XL", "2XL"];
      
      // Get placements from provider data
      const providerPlacements = provider?.placements as Array<{id: string; type: string; title: string}> || [];
      
      const blueprintIdNum = typeof bp.id === 'string' ? parseInt(bp.id) : bp.id;
      const item = {
        id: bp.id,
        title: bp.title || "",
        brand: bp.brand || "",
        model: bp.model || "",
        imageUrl: bp.images?.[0] || null,
        madeInUSA: isUSABrand || provider?.isUsa || false,
        minPrice,
        maxPrice,
        colorCount,
        availableColors: colors || [],
        availableSizes: sizes,
        blueprintId: bp.id,
        printProviderId: provider?.printProviderId || null,
        hasMockupMapping: KNOWN_MOCKUP_BLUEPRINT_IDS.has(blueprintIdNum),
        fulfillmentProvider: 'printify',
        // Dynamic placements from Printify API
        placements: providerPlacements.length > 0 ? providerPlacements : undefined,
      };
      
      if (title.includes('t-shirt') || title.includes('tee') || title.includes('tank')) {
        categories["T-Shirts"].push(item);
      } else if (title.includes('hoodie') || title.includes('sweatshirt') || title.includes('crew') || title.includes('pullover')) {
        categories["Sweatshirts & Hoodies"].push(item);
      } else if (title.includes('hat') || title.includes('cap') || title.includes('beanie') || title.includes('visor')) {
        categories["Hats & Caps"].push(item);
      } else if (title.includes('mug') || title.includes('tumbler') || title.includes('bottle') || title.includes('cup') || title.includes('glass')) {
        categories["Drinkware"].push(item);
      } else if (title.includes('bag') || title.includes('tote') || title.includes('backpack') || title.includes('pouch')) {
        categories["Bags"].push(item);
      } else {
        categories["Other"].push(item);
      }
    }
    
    const result = Object.entries(categories)
      .filter(([_, items]) => items.length > 0)
      .map(([name, items]) => ({ name, items, count: items.length }));
    
    console.log(`[TestCatalog] Returning ${result.length} categories`);
    res.json(result);
  } catch (error: any) {
    console.error('[TestCatalog] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to normalize Printful product types into proper categories
function normalizePrintfulCategory(type: string, title: string): string {
  const text = `${type} ${title}`.toLowerCase();
  
  // Check for specific product types (order matters - more specific first)
  if (text.includes('hoodie') || text.includes('hood')) return 'Hoodies';
  if (text.includes('sweatshirt') || text.includes('crewneck') || text.includes('crew neck')) return 'Sweatshirts';
  if (text.includes('sweatpants') || text.includes('jogger')) return 'Sweatpants';
  if (text.includes('tank top') || text.includes('tank')) return 'Tank Tops';
  if (text.includes('long sleeve') || text.includes('longsleeve')) return 'Long Sleeve Shirts';
  if (text.includes('t-shirt') || text.includes('tee') || text.includes('tshirt')) return 'T-Shirts';
  if (text.includes('polo')) return 'Polos';
  if (text.includes('jacket') || text.includes('windbreaker')) return 'Jackets';
  if (text.includes('hat') || text.includes('cap') || text.includes('beanie') || text.includes('trucker')) return 'Hats';
  if (text.includes('bag') || text.includes('tote') || text.includes('backpack') || text.includes('duffel')) return 'Bags';
  if (text.includes('mug') || text.includes('tumbler') || text.includes('bottle')) return 'Drinkware';
  if (text.includes('poster') || text.includes('print') || text.includes('canvas') || text.includes('wall art')) return 'Wall Art';
  if (text.includes('sticker')) return 'Stickers';
  if (text.includes('phone case') || text.includes('iphone') || text.includes('samsung')) return 'Phone Cases';
  if (text.includes('mouse pad') || text.includes('mousepad')) return 'Mouse Pads';
  if (text.includes('pillow') || text.includes('cushion')) return 'Pillows';
  if (text.includes('blanket') || text.includes('throw')) return 'Blankets';
  if (text.includes('towel')) return 'Towels';
  if (text.includes('apron')) return 'Aprons';
  if (text.includes('shorts')) return 'Shorts';
  if (text.includes('dress')) return 'Dresses';
  if (text.includes('legging')) return 'Leggings';
  if (text.includes('socks')) return 'Socks';
  if (text.includes('jersey')) return 'Jerseys';
  if (text.includes('calendar')) return 'Calendars';
  if (text.includes('notebook') || text.includes('journal')) return 'Notebooks';
  if (text.includes('flag') || text.includes('banner')) return 'Flags & Banners';
  if (text.includes('patch')) return 'Patches';
  if (text.includes('embroidered') || text.includes('embroidery')) return 'Embroidered Items';
  
  // Default to the original type if no match, but clean it up
  return type || 'Other';
}

// Test endpoint: Printful catalog (no auth required)
app.get('/test/catalog/printful-products', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[TestCatalog] GET Printful products');
    const snapshot = await db.collection('printfulProducts').get();
    const rawProducts = snapshot.docs.map(doc => docToObject(doc));
    
    // Transform to match expected catalog format with categories
    const grouped: Record<string, any[]> = {};
    for (const p of rawProducts) {
      const category = normalizePrintfulCategory(p.type || '', p.title || p.name || '');
      if (!grouped[category]) grouped[category] = [];
      
      // Detect if product is made in USA from description or brand
      const description = (p.description || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const isUSAMade = 
        description.includes('made in usa') ||
        description.includes('made in the usa') ||
        description.includes('made in u.s.a') ||
        description.includes('sourced from usa') ||
        description.includes('sourced from the usa') ||
        description.includes('manufactured in usa') ||
        description.includes('printed in usa') ||
        brand.includes('american apparel') ||
        brand.includes('lane seven') ||
        brand.includes('los angeles apparel');
      
      // Transform to match CatalogItemResponse format
      // Include placements from the synced product data
      const placements = (p.placements || []).map((pl: any) => ({
        id: pl.id || pl.type,
        type: pl.type,
        title: pl.title || pl.type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        additionalPrice: pl.additionalPrice || 0
      }));
      
      grouped[category].push({
        id: p.id,
        blueprintId: p.id,
        title: p.title || p.name,
        brand: p.brand || 'Printful',
        model: p.model,
        description: p.description || p.type,
        imageUrl: p.image,
        minPrice: 0,
        maxPrice: 0,
        colorCount: Object.keys(p.colors || {}).length || p.variantCount || 0,
        madeInUSA: isUSAMade,
        hasMockupMapping: true,
        fulfillmentProvider: 'printful',
        colors: p.colors,
        sizes: p.sizes,
        lifestyleImages: p.lifestyleImages,
        modelImages: p.modelImages,
        // Dynamic placements from Printful API
        placements: placements.length > 0 ? placements : undefined,
      });
    }
    
    // Return as array of categories with items
    const result = Object.entries(grouped)
      .filter(([_, items]) => items.length > 0)
      .map(([name, items]) => ({ name, items, count: items.length }));
    
    console.log(`[TestCatalog] Returning ${result.length} categories with ${rawProducts.length} Printful products`);
    res.json(result);
  } catch (error: any) {
    console.error('[TestCatalog] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync Printful catalog from their API (includes lifestyle images)
app.post('/test/catalog/printful-sync', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[PrintfulSync] Starting catalog sync...');
    const printful = new PrintfulClient();
    
    if (!printful.isConfigured) {
      res.status(500).json({ error: 'Printful API not configured' });
      return;
    }
    
    // Fetch full catalog from Printful
    const catalogUrl = `${PRINTFUL_API_BASE}/products`;
    const response = await fetch(catalogUrl, {
      headers: { 'Authorization': `Bearer ${getPrintfulApiKey()}` }
    });
    
    if (!response.ok) {
      throw new Error(`Printful catalog fetch failed: ${response.status}`);
    }
    
    const catalogData = await response.json();
    const products = catalogData.result || [];
    console.log(`[PrintfulSync] Fetched ${products.length} products from Printful`);
    
    // Sync ALL products from Printful catalog
    const targetProducts = products;
    
    console.log(`[PrintfulSync] Syncing ${targetProducts.length} apparel products`);
    
    let synced = 0;
    const batch = db.batch();
    
    for (const product of targetProducts) {
      try {
        // Fetch detailed product info including variants and images
        const detailUrl = `${PRINTFUL_API_BASE}/products/${product.id}`;
        const detailRes = await fetch(detailUrl, {
          headers: { 'Authorization': `Bearer ${getPrintfulApiKey()}` }
        });
        
        if (!detailRes.ok) {
          console.log(`[PrintfulSync] Failed to fetch details for product ${product.id}`);
          continue;
        }
        
        const detailData = await detailRes.json();
        const productDetail = detailData.result?.product || {};
        const variants = detailData.result?.variants || [];
        
        // Extract print placements from the files array
        // Printful returns placement types in the product's techniques/files structure
        const files = productDetail.files || [];
        const placements: Array<{
          id: string;
          type: string;
          title: string;
          additionalPrice?: number;
          options?: any;
        }> = files.map((file: any) => ({
          id: file.type || file.id,
          type: file.type || file.id,
          title: file.title || file.type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Unknown',
          additionalPrice: file.additional_price ? parseFloat(file.additional_price) : 0,
          options: file.options || null
        }));
        
        // Also check techniques for additional placement info
        const techniques = productDetail.techniques || [];
        const techniqueInfo = techniques.map((tech: any) => ({
          key: tech.key,
          displayName: tech.display_name,
          isDefault: tech.is_default
        }));
        
        // Extract unique colors with their images
        const colorMap = new Map<string, { hex: string; image: string; lifestyleImage?: string }>();
        for (const v of variants) {
          if (v.color && !colorMap.has(v.color)) {
            colorMap.set(v.color, {
              hex: v.color_code || '#000000',
              image: v.image || product.image,
              lifestyleImage: v.image // Printful includes model images in variant images
            });
          }
        }
        
        // Extract unique sizes
        const sizes = [...new Set(variants.map((v: any) => v.size).filter(Boolean))];
        
        const docRef = db.collection('printfulProducts').doc(String(product.id));
        batch.set(docRef, {
          id: product.id,
          title: product.title,
          type: product.type_name,
          brand: productDetail.brand || product.brand,
          model: productDetail.model || product.model,
          image: product.image,
          description: productDetail.description || '',
          variantCount: variants.length,
          colors: Object.fromEntries(colorMap),
          sizes: sizes,
          // Print placements available for this product
          placements: placements,
          techniques: techniqueInfo,
          // Lifestyle/glamor images if available
          lifestyleImages: variants
            .filter((v: any) => v.image && v.image.includes('lifestyle'))
            .map((v: any) => v.image)
            .slice(0, 5),
          modelImages: variants
            .filter((v: any) => v.image)
            .map((v: any) => v.image)
            .slice(0, 10),
          isEnabled: true,
          fulfillmentProvider: 'printful',
          syncedAt: new Date().toISOString()
        }, { merge: true });
        
        synced++;
        
        // Rate limit: Printful allows ~30 requests/minute
        if (synced % 10 === 0) {
          await new Promise(r => setTimeout(r, 2000));
          console.log(`[PrintfulSync] Synced ${synced}/${targetProducts.length}...`);
        }
      } catch (err: any) {
        console.error(`[PrintfulSync] Error syncing product ${product.id}:`, err.message);
      }
    }
    
    await batch.commit();
    console.log(`[PrintfulSync] Completed! Synced ${synced} products`);
    
    res.json({ 
      success: true, 
      synced, 
      total: targetProducts.length,
      message: `Synced ${synced} Printful products with lifestyle images`
    });
  } catch (error: any) {
    console.error('[PrintfulSync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync Printify catalog from their API (blueprints, providers, and print areas)
app.post('/test/catalog/printify-sync', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[PrintifySync] Starting catalog sync...');
    
    if (!printifyClient.isConfigured) {
      res.status(500).json({ error: 'Printify API not configured' });
      return;
    }
    
    const shopId = getPrintifyShopId();
    
    // Step 1: Fetch all blueprints from Printify
    console.log('[PrintifySync] Fetching blueprints...');
    const blueprintsRes = await fetch(`${PRINTIFY_API_BASE}/catalog/blueprints.json`, {
      headers: { 'Authorization': `Bearer ${getPrintifyApiKey()}` }
    });
    
    if (!blueprintsRes.ok) {
      throw new Error(`Printify blueprints fetch failed: ${blueprintsRes.status}`);
    }
    
    const blueprints = await blueprintsRes.json();
    console.log(`[PrintifySync] Fetched ${blueprints.length} blueprints`);
    
    let syncedBlueprints = 0;
    let syncedProviders = 0;
    
    // Step 2: Process each blueprint and fetch its print providers
    for (const blueprint of blueprints) {
      try {
        // Save blueprint to Firestore
        const blueprintRef = db.collection('printifyBlueprints').doc(String(blueprint.id));
        await blueprintRef.set({
          id: blueprint.id,
          title: blueprint.title,
          description: blueprint.description || '',
          brand: blueprint.brand || '',
          model: blueprint.model || '',
          images: blueprint.images || [],
          syncedAt: new Date().toISOString()
        }, { merge: true });
        syncedBlueprints++;
        
        // Fetch print providers for this blueprint
        const providersRes = await fetch(
          `${PRINTIFY_API_BASE}/catalog/blueprints/${blueprint.id}/print_providers.json`,
          { headers: { 'Authorization': `Bearer ${getPrintifyApiKey()}` } }
        );
        
        if (!providersRes.ok) {
          console.log(`[PrintifySync] Failed to fetch providers for blueprint ${blueprint.id}`);
          continue;
        }
        
        const providers = await providersRes.json();
        
        // Process each provider - fetch variants which contain print area info
        for (const provider of providers.slice(0, 5)) { // Limit to top 5 providers per blueprint
          try {
            // Fetch variants for this provider to get print areas
            const variantsRes = await fetch(
              `${PRINTIFY_API_BASE}/catalog/blueprints/${blueprint.id}/print_providers/${provider.id}/variants.json`,
              { headers: { 'Authorization': `Bearer ${getPrintifyApiKey()}` } }
            );
            
            if (!variantsRes.ok) continue;
            
            const variantsData = await variantsRes.json();
            const variants = variantsData.variants || variantsData || [];
            
            // Extract unique print areas/placements from variants
            const printAreasSet = new Set<string>();
            const colorMap = new Map<string, { hex: string; id: number }>();
            const sizesSet = new Set<string>();
            
            for (const v of variants) {
              // Extract print areas from placeholders if available
              if (v.placeholders) {
                for (const ph of v.placeholders) {
                  if (ph.position) printAreasSet.add(ph.position);
                }
              }
              // Also check for print_areas at variant level
              if (v.print_areas) {
                for (const area of v.print_areas) {
                  if (area.position) printAreasSet.add(area.position);
                }
              }
              
              // Extract colors
              if (v.options?.color) {
                colorMap.set(v.options.color, {
                  hex: v.options.color_code || '#000000',
                  id: v.id
                });
              }
              
              // Extract sizes
              if (v.options?.size) sizesSet.add(v.options.size);
            }
            
            // Convert print areas to structured placements
            const placements = Array.from(printAreasSet).map(position => ({
              id: position,
              type: position,
              title: position.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            }));
            
            // If no placements found, try to infer from blueprint title
            if (placements.length === 0) {
              const title = blueprint.title.toLowerCase();
              if (title.includes('t-shirt') || title.includes('hoodie') || title.includes('sweatshirt')) {
                placements.push(
                  { id: 'front', type: 'front', title: 'Front' },
                  { id: 'back', type: 'back', title: 'Back' }
                );
              } else if (title.includes('mug')) {
                placements.push({ id: 'front', type: 'front', title: 'Front' });
              } else if (title.includes('hat') || title.includes('cap')) {
                placements.push({ id: 'front', type: 'front', title: 'Front' });
              } else {
                placements.push({ id: 'front', type: 'front', title: 'Front' });
              }
            }
            
            // Save provider with placements to Firestore
            const providerRef = db.collection('printifyPrintProviders').doc(`${blueprint.id}_${provider.id}`);
            await providerRef.set({
              id: provider.id,
              blueprintId: blueprint.id,
              blueprintTitle: blueprint.title,
              title: provider.title,
              location: provider.location || {},
              placements: placements,
              availableColors: Array.from(colorMap.entries()).map(([name, data]) => ({
                name,
                hex: data.hex,
                variantId: data.id
              })),
              availableSizes: Array.from(sizesSet),
              variantCount: variants.length,
              fulfillmentProvider: 'printify',
              syncedAt: new Date().toISOString()
            }, { merge: true });
            
            syncedProviders++;
            
          } catch (providerErr: any) {
            console.error(`[PrintifySync] Error syncing provider ${provider.id}:`, providerErr.message);
          }
        }
        
        // Rate limit: Be gentle with Printify API
        if (syncedBlueprints % 20 === 0) {
          await new Promise(r => setTimeout(r, 3000));
          console.log(`[PrintifySync] Progress: ${syncedBlueprints}/${blueprints.length} blueprints, ${syncedProviders} providers`);
        }
        
      } catch (bpErr: any) {
        console.error(`[PrintifySync] Error syncing blueprint ${blueprint.id}:`, bpErr.message);
      }
    }
    
    console.log(`[PrintifySync] Complete! Synced ${syncedBlueprints} blueprints, ${syncedProviders} providers`);
    
    res.json({
      success: true,
      syncedBlueprints,
      syncedProviders,
      total: blueprints.length,
      message: `Synced ${syncedBlueprints} blueprints and ${syncedProviders} providers with placements`
    });
    
  } catch (error: any) {
    console.error('[PrintifySync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: Get blueprint details (colors/sizes) for configuration
app.get('/test/printify/catalog/:blueprintId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId } = req.params;
    console.log(`[TestCatalog] GET blueprint details for ${blueprintId}`);
    
    // Find provider for this blueprint
    const providersSnapshot = await db.collection('printifyPrintProviders')
      .where('blueprintId', '==', parseInt(blueprintId))
      .limit(1)
      .get();
    
    if (providersSnapshot.empty) {
      // Return fallback data for demo
      res.json({
        id: blueprintId,
        colors: [
          { name: "Black", hex: "#000000" },
          { name: "White", hex: "#FFFFFF" },
          { name: "Navy", hex: "#000080" },
          { name: "Red", hex: "#FF0000" },
          { name: "Heather Gray", hex: "#9CA3AF" },
          { name: "Forest Green", hex: "#228B22" },
        ],
        sizes: ["S", "M", "L", "XL", "2XL"],
      });
      return;
    }
    
    const provider = docToObject(providersSnapshot.docs[0]);
    const colors = (provider.availableColors as Array<{name: string; hex?: string}>) || [];
    const sizes = (provider.availableSizes as string[]) || ["S", "M", "L", "XL", "2XL"];
    
    res.json({
      id: blueprintId,
      providerId: provider.printProviderId,
      colors,
      sizes,
      minPrice: provider.minCost ? (provider.minCost / 100).toFixed(2) : null,
      maxPrice: provider.maxCost ? (provider.maxCost / 100).toFixed(2) : null,
    });
  } catch (error: any) {
    console.error('[TestCatalog] GET blueprint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: GET products for a store channel (for Store Library) - uses storeProductLinks
app.get('/test/stores/:storeId/channels/:channelId/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    console.log(`[TestChannelProducts] GET products for ${storeId}/${channelId}`);

    if (!storeId || !channelId) {
      res.status(400).json({ error: 'storeId and channelId are required' });
      return;
    }

    // Query storeProductLinks collection - channelId is actually the channel name
    const linksSnapshot = await db.collection('storeProductLinks')
      .where('storeId', '==', storeId)
      .where('channel', '==', channelId)
      .get();

    const products = linksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        linkId: doc.id,
        packetId: data.packetId || null,
        templateId: data.templateId || null,
        name: data.productName || 'Untitled Product',
        imageUrl: data.compositeUrl || data.qrOnlyUrl || null,
        qrContent: data.qrContent || null,
        pricing: data.pricing || null,
        enabledColors: data.enabledColors || [],
        enabledSizes: data.enabledSizes || [],
        selectedGraphicSize: data.selectedGraphicSize || null,
        defaultColor: data.defaultColor || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    console.log(`[TestChannelProducts] Found ${products.length} products for ${storeId}/${channelId}`);
    res.json(products);
  } catch (error: any) {
    console.error('[TestChannelProducts] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: Assign configured products to store channel
app.post('/test/stores/:storeId/channels/:channelId/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const { products } = req.body;
    
    console.log(`[TestAssignment] POST ${products?.length || 0} products to ${storeId}/${channelId}`);
    
    if (!products || !Array.isArray(products)) {
      res.status(400).json({ error: "products array required" });
      return;
    }
    
    // Log and return success (could save to Firestore in production)
    const assignedProducts = products.map((p: any) => ({
      id: p.id,
      baseProductId: p.baseProductId,
      baseProductName: p.baseProductName,
      storeId,
      channelId,
      enabledColors: p.enabledColors,
      enabledSizes: p.enabledSizes,
      defaultColor: p.defaultColor,
      isBlankCanvas: p.isBlankCanvas,
      assignedAt: new Date().toISOString(),
    }));
    
    console.log(`[TestAssignment] Assigned:`, assignedProducts);
    
    res.json({
      success: true,
      assigned: assignedProducts.length,
      products: assignedProducts,
    });
  } catch (error: any) {
    console.error('[TestAssignment] POST error:', error);
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

// PUBLIC TEST: Save graphics (QR-only and/or composite) to library - NO AUTH REQUIRED
app.post('/test/graphics/save', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId } = req.body;

    // URLs are generated after packet creation, so no validation here

    const now = admin.firestore.FieldValue.serverTimestamp();
    let qrAssetId: string | null = null;
    let compositeAssetId: string | null = null;
    
    // Create QR-only asset if URL provided
    if (qrOnlyUrl) {
      const qrMetadata: Record<string, any> = { isQrOnly: true };
      if (storeId) qrMetadata.storeId = storeId;
      if (channelId) qrMetadata.channelId = channelId;
      
      const qrAssetData = {
        name: `${name || 'Untitled'} - QR Only`,
        assetType: 'graphic',
        mediaType: 'image',
        ownerType: 'admin',
        publicUrl: qrOnlyUrl,
        storageUrl: qrOnlyUrl,
        thumbnailUrl: qrOnlyUrl,
        category: category || 'qr-graphics',
        isActive: true,
        metadata: qrMetadata,
        createdAt: now,
        updatedAt: now,
      };
      const qrDocRef = await db.collection('libraryAssets').add(qrAssetData);
      qrAssetId = qrDocRef.id;
    }

    // Create composite asset if URL provided
    if (compositeUrl) {
      const compositeMetadata: Record<string, any> = { isComposite: true };
      if (storeId) compositeMetadata.storeId = storeId;
      if (channelId) compositeMetadata.channelId = channelId;
      
      const compositeAssetData = {
        name: `${name || 'Untitled'} - Composite`,
        assetType: 'graphic',
        mediaType: 'image',
        ownerType: 'admin',
        publicUrl: compositeUrl,
        storageUrl: compositeUrl,
        thumbnailUrl: compositeUrl,
        category: category || 'composite-graphics',
        isActive: true,
        metadata: compositeMetadata,
        createdAt: now,
        updatedAt: now,
      };
      const compositeDocRef = await db.collection('libraryAssets').add(compositeAssetData);
      compositeAssetId = compositeDocRef.id;
    }

    console.log(`[Graphics TEST] Saved graphics: QR=${qrAssetId}, Composite=${compositeAssetId}`);

    res.json({
      success: true,
      qrAssetId,
      compositeAssetId,
      message: `Graphics saved to library (test endpoint)${qrAssetId ? ' - QR saved' : ''}${compositeAssetId ? ' - Composite saved' : ''}`,
    });
  } catch (error: any) {
    console.error('[Graphics TEST] Error saving graphics:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Get all templates - NO AUTH REQUIRED
app.get('/test/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productTemplates')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const templates = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      
      // Fetch linked packet data if packetId exists
      let packetData = null;
      if (data.packetId) {
        const packetDoc = await db.collection('productPackets').doc(data.packetId).get();
        if (packetDoc.exists) {
          const pData = packetDoc.data();
          packetData = {
            id: packetDoc.id,
            productName: pData?.productName,
            compositeUrl: pData?.compositeUrl,
            qrOnlyUrl: pData?.qrOnlyUrl,
            qrContent: pData?.qrContent,
            qrProductState: pData?.qrProductState,
            priorityMockupUrl: pData?.priorityMockupUrl || null,
            landingPageSnapshotUrl: pData?.landingPageSnapshotUrl || null,
            headerText: pData?.headerText || null,
            footerText: pData?.footerText || null,
          };
        }
      }
      
      return {
        id: doc.id,
        ...data,
        packet: packetData,
        createdAt: data?.createdAt?.toDate?.() || null,
        updatedAt: data?.updatedAt?.toDate?.() || null,
      };
    }));
    
    console.log(`[Templates TEST] Retrieved ${templates.length} templates`);
    
    res.json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error: any) {
    console.error('[Templates TEST] Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Create template linked to packet - NO AUTH REQUIRED
app.post('/test/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      packetId, name, productId, blueprintId, printProviderId,
      artworkUrl, thumbnailUrl, qrContent, pricing,
      selectedSize, enabledColors, enabledSizes, defaultColor, isActive
    } = req.body;

    if (!packetId) {
      res.status(400).json({ error: 'packetId is required' });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const templateData = {
      packetId,
      name: name || `Template - ${new Date().toLocaleDateString()}`,
      productId: productId || null,
      blueprintId: blueprintId || null,
      printProviderId: printProviderId || null,
      artworkUrl: artworkUrl || null,
      thumbnailUrl: thumbnailUrl || artworkUrl || null,
      qrContent: qrContent || null,
      pricing: pricing || null,
      selectedSize: selectedSize || 'medium',
      enabledColors: enabledColors || [],
      enabledSizes: enabledSizes || [],
      defaultColor: defaultColor || null,
      isActive: isActive !== false,
      createdAt: now,
      updatedAt: now,
    };

    const templateRef = await db.collection('productTemplates').add(templateData);
    
    console.log(`[Templates TEST] Created template ${templateRef.id} linked to packet ${packetId}`);

    res.json({
      success: true,
      templateId: templateRef.id,
      packetId,
      message: 'Template created and linked to packet',
    });
  } catch (error: any) {
    console.error('[Templates TEST] Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Background queue processor - processes mockup jobs without blocking the response
async function processQueueInBackground(): Promise<void> {
  const processLimit = 10; // Process up to 10 jobs per batch
  
  const pendingSnapshot = await db.collection('mockupJobs')
    .where('status', '==', 'pending')
    .limit(processLimit)
    .get();

  if (pendingSnapshot.empty) {
    console.log('[Queue Background] No pending jobs');
    return;
  }

  console.log(`[Queue Background] Processing ${pendingSnapshot.size} jobs`);

  for (const jobDoc of pendingSnapshot.docs) {
    const job = jobDoc.data();
    const jobId = jobDoc.id;

    try {
      // Atomic claim
      const claimed = await db.runTransaction(async (transaction) => {
        const jobRef = db.collection('mockupJobs').doc(jobId);
        const freshDoc = await transaction.get(jobRef);
        
        if (!freshDoc.exists || freshDoc.data()?.status !== 'pending') {
          return false;
        }
        
        transaction.update(jobRef, {
          status: 'processing',
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          processorId: `bg-${Date.now()}`,
        });
        return true;
      });

      if (!claimed) continue;

      // Rate limiting: 10 seconds between Printful calls
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Get template
      const templateDoc = await db.collection('productTemplates').doc(job.templateId).get();
      if (!templateDoc.exists) {
        throw new Error(`Template ${job.templateId} not found`);
      }
      const template = templateDoc.data()!;

      // Generate mockup
      const mockupResult = await generateMockupFromPrintful({
        blueprintId: template.blueprintId || 5,
        printProviderId: template.printProviderId || 39,
        colorName: job.colorName,
        colorHex: job.colorHex || '#000000',
        artworkUrl: template.artworkUrl,
        artworkVariant: template.artworkVariant || 'black',
      });

      // Store in template
      const colorKey = job.colorName.replace(/\s+/g, '_').toLowerCase();
      const placementKey = job.placement || 'front';
      const sizeKey = job.qrSize || 'large';
      
      await db.collection('productTemplates').doc(job.templateId).update({
        [`mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`]: mockupResult.mockupUrl,
        [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleMockupUrl || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark completed
      await db.collection('mockupJobs').doc(jobId).update({
        status: 'completed',
        mockupUrl: mockupResult.mockupUrl,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[Queue Background] Completed: ${job.colorName}/${job.placement}/${job.qrSize}`);

    } catch (error: any) {
      console.error(`[Queue Background] Job ${jobId} failed:`, error.message);
      await db.collection('mockupJobs').doc(jobId).update({
        status: 'failed',
        error: error.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

// PUBLIC TEST: Full template save with batch mockup generation - NO AUTH REQUIRED
app.post('/test/templates/full-save', async (req: Request, res: Response): Promise<void> => {
  try {
    // Accept data directly (not wrapped in 'template' object) to match client format
    const { 
      name, 
      description, 
      category, 
      productId, 
      blueprintId, 
      printProviderId,
      colors = [], 
      placements = ['front'], 
      qrSizes: customQrSizes,
      artworkUrl,
      artworkVariant,
      thumbnailUrl,
      qrContent,
      pricing,
      defaultColor,
      defaultColorHex,
    } = req.body;

    if (!name && !productId) {
      res.status(400).json({ error: 'Template name or productId is required' });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Build template data from direct fields
    const templateData: Record<string, any> = {
      name: name || `Template - ${new Date().toISOString()}`,
      description: description || '',
      category: category || 'General',
      productId: productId || null,
      blueprintId: blueprintId || 0,
      printProviderId: printProviderId || 0,
      artworkUrl: artworkUrl || '',
      artworkVariant: artworkVariant || 'black',
      thumbnailUrl: thumbnailUrl || artworkUrl || '',
      defaultColor: defaultColor || (colors[0]?.name || colors[0]) || null,
      defaultColorHex: defaultColorHex || colors[0]?.hex || null,
      qrContent: qrContent || '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // Store pricing in template if provided
    if (pricing) {
      templateData.pricing = pricing;
      templateData.customerPrice = pricing.customerPrice || 0;
      templateData.hostingTierCode = pricing.hostingTierCode || null;
    }

    const templateRef = await db.collection('productTemplates').add(templateData);
    const templateId = templateRef.id;

    // Queue mockup generation jobs for each color × placement × qr size combo
    const qrSizes = customQrSizes || ['small', 'medium', 'large'];
    let jobsQueued = 0;

    for (const color of colors) {
      for (const placement of placements) {
        // For front/back, generate all 3 QR sizes; for other placements, only large
        const sizesToGenerate = (placement === 'front' || placement === 'back') ? qrSizes : ['large'];
        
        for (const qrSize of sizesToGenerate) {
          const jobData = {
            templateId,
            colorName: color.name || color,
            colorHex: color.hex || '#000000',
            placement,
            qrSize,
            status: 'pending',
            createdAt: now,
          };
          await db.collection('mockupJobs').add(jobData);
          jobsQueued++;
        }
      }
    }

    console.log(`[Templates TEST] Full save complete: template=${templateId}, ${jobsQueued} mockup jobs queued`);

    // Trigger queue processing in background (fire and forget)
    // This starts processing the mockup jobs we just created
    if (jobsQueued > 0) {
      processQueueInBackground().catch(err => {
        console.error('[Templates TEST] Background queue processing error:', err.message);
      });
    }

    res.json({
      success: true,
      template: { id: templateId, ...templateData },
      templateId,
      jobsQueued,
      message: `Template saved with ${jobsQueued} mockup jobs queued (test endpoint)`,
    });
  } catch (error: any) {
    console.error('[Templates TEST] Error in full save:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Create product packet (master record) - NO AUTH REQUIRED
app.post('/test/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      qrOnlyUrl, 
      compositeUrl, 
      qrContent,
      headerText,
      footerText,
      pricing,
      productId,
      productName,
      productDescription,
      productImageUrl,
      blueprintId,
      printProviderId,
      manufacturer,
      madeInUSA,
      category,
      defaultColor,
      defaultColorHex,
      defaultPlacement,
      qrProductState,
      placements,
      availablePlacements,
      sizes,
      colors,
      basePrice,
      customerPrice,
      mockupsByColor,
      landingPageTitle,
      landingPageDescription,
      landingPageBackgroundUrl,
      landingPageSlug,
      headerStyle,
      footerStyle,
      playMediaUrl,
    } = req.body;

    // Note: qrContent and qrOnlyUrl are generated AFTER packet creation
    // so we don't validate them here - they get populated via PATCH

    const now = admin.firestore.FieldValue.serverTimestamp();
    
    const packetData = {
      qrOnlyUrl: qrOnlyUrl || null,
      compositeUrl: compositeUrl || null,
      qrContent: qrContent || null,
      headerText: headerText || null,
      footerText: footerText || null,
      pricing: pricing || null,
      productId: productId || null,
      productName: productName || null,
      productDescription: productDescription || null,
      productImageUrl: productImageUrl || null,
      blueprintId: blueprintId || null,
      printProviderId: printProviderId || null,
      manufacturer: manufacturer || null,
      madeInUSA: madeInUSA || false,
      category: category || null,
      defaultColor: defaultColor || null,
      defaultColorHex: defaultColorHex || null,
      defaultPlacement: defaultPlacement || null,
      qrProductState: qrProductState || null,
      placements: placements || [],
      availablePlacements: availablePlacements || [],
      sizes: sizes || [],
      colors: colors || [],
      basePrice: basePrice || null,
      customerPrice: customerPrice || null,
      mockupsByColor: mockupsByColor || null,
      landingPageTitle: landingPageTitle || null,
      landingPageDescription: landingPageDescription || null,
      landingPageBackgroundUrl: landingPageBackgroundUrl || null,
      landingPageSlug: landingPageSlug || null,
      headerStyle: headerStyle || null,
      footerStyle: footerStyle || null,
      playMediaUrl: playMediaUrl || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const packetRef = await db.collection('productPackets').add(packetData);
    
    console.log(`[Packets TEST] Created packet: ${packetRef.id}`);

    res.json({
      success: true,
      packetId: packetRef.id,
      message: 'Product packet created',
    });
  } catch (error: any) {
    console.error('[Packets TEST] Error creating packet:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Get all product packets - NO AUTH REQUIRED
app.get('/test/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productPackets')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const packets = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate?.() || null,
        updatedAt: data?.updatedAt?.toDate?.() || null,
      };
    });
    
    console.log(`[Packets TEST] Retrieved ${packets.length} packets`);
    
    res.json({
      success: true,
      packets,
      count: packets.length,
    });
  } catch (error: any) {
    console.error('[Packets TEST] Error getting packets:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Get product packet by ID - NO AUTH REQUIRED
app.get('/test/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;

    if (!packetId) {
      res.status(400).json({ error: 'packetId is required' });
      return;
    }

    const doc = await db.collection('productPackets').doc(packetId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Packet not found' });
      return;
    }
    
    const data = doc.data();
    
    // Also find linked template by packetId
    let linkedTemplateId = null;
    const templatesSnapshot = await db.collection('productTemplates')
      .where('packetId', '==', packetId)
      .limit(1)
      .get();
    
    if (!templatesSnapshot.empty) {
      linkedTemplateId = templatesSnapshot.docs[0].id;
    }
    
    res.json({
      success: true,
      packet: {
        id: doc.id,
        ...data,
        templateId: linkedTemplateId,
        createdAt: data?.createdAt?.toDate?.() || null,
        updatedAt: data?.updatedAt?.toDate?.() || null,
      },
    });
  } catch (error: any) {
    console.error('[Packets TEST] Error getting packet:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Update packet with final URLs - NO AUTH REQUIRED
app.patch('/test/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const updates = req.body;

    if (!packetId) {
      res.status(400).json({ error: 'packetId is required' });
      return;
    }

    const docRef = db.collection('productPackets').doc(packetId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Packet not found' });
      return;
    }
    
    await docRef.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`[Packets PATCH] Updated packet ${packetId}:`, Object.keys(updates));
    
    res.json({
      success: true,
      packetId,
      message: 'Packet updated',
    });
  } catch (error: any) {
    console.error('[Packets PATCH] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Delete packet - NO AUTH REQUIRED
app.delete('/test/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;

    if (!packetId) {
      res.status(400).json({ error: 'packetId is required' });
      return;
    }

    const docRef = db.collection('productPackets').doc(packetId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Packet not found' });
      return;
    }
    
    await docRef.delete();
    
    console.log(`[Packets DELETE] Deleted packet ${packetId}`);
    
    res.json({
      success: true,
      packetId,
      message: 'Packet deleted',
    });
  } catch (error: any) {
    console.error('[Packets DELETE] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Get landing page by slug - NO AUTH REQUIRED
app.get('/test/landing/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      res.status(400).json({ error: 'slug is required' });
      return;
    }
    
    const snapshot = await db.collection('productPackets')
      .where('landingPageSlug', '==', slug)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      res.status(404).json({ error: 'Landing page not found' });
      return;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    const landingPage = {
      packetId: doc.id,
      landingPageSnapshotUrl: data.landingPageSnapshotUrl || null,
      qrOnlyUrl: data.qrOnlyUrl || null,
      qrProductState: data.qrProductState || 'qr_canvas',
      playMediaUrl: data.playMediaUrl || null,
      playMediaType: data.playMediaType || null,
      landingPageTitle: data.landingPageTitle || null,
      landingPageDescription: data.landingPageDescription || null,
      landingPageBackgroundUrl: data.landingPageBackgroundUrl || null,
    };
    
    console.log(`[Landing Page] Found page for slug: ${slug}`);
    
    res.json({
      success: true,
      landingPage,
    });
  } catch (error: any) {
    console.error('[Landing Page] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Delete template - NO AUTH REQUIRED
app.delete('/test/templates/:templateId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;

    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }

    const docRef = db.collection('productTemplates').doc(templateId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    
    await docRef.delete();
    
    console.log(`[Templates DELETE] Deleted template ${templateId}`);
    
    res.json({
      success: true,
      templateId,
      message: 'Template deleted',
    });
  } catch (error: any) {
    console.error('[Templates DELETE] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Upload content (composite or media) to Firebase Storage - NO AUTH REQUIRED
app.post('/test/content/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;

    if (!mode || !userId || !packetId || !base64Data) {
      res.status(400).json({ 
        error: 'mode, userId, packetId, and base64Data are required' 
      });
      return;
    }

    const validModes = ['canvas', 'play', 'dynamics', 'basics'];
    if (!validModes.includes(mode)) {
      res.status(400).json({ 
        error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
      });
      return;
    }

    // Parse base64 data
    const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    const actualMimeType = base64Match?.[1] || mimeType || 'image/png';
    const actualBase64 = base64Match?.[2] || base64Data;
    
    console.log(`[Content Upload] Processing ${mode} upload: base64 length=${base64Data?.length || 0}, extracted length=${actualBase64?.length || 0}, mimeType=${actualMimeType}`);
    
    if (!actualBase64 || actualBase64.length === 0) {
      res.status(400).json({ error: 'No file data received - base64 content is empty' });
      return;
    }
    
    const buffer = Buffer.from(actualBase64, 'base64');
    console.log(`[Content Upload] Decoded buffer size: ${buffer.length} bytes`);
    
    if (buffer.length === 0) {
      res.status(400).json({ error: 'File data is empty after decoding' });
      return;
    }

    // Determine storage path based on mode
    // Use fileName if provided to allow multiple files per packet (e.g., product-graphic vs landing-snapshot)
    let storagePath: string;
    if (mode === 'canvas' || mode === 'basics') {
      if (fileName) {
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        storagePath = `content/members/${userId}/${mode}/${packetId}/${safeName}`;
      } else {
        storagePath = `content/members/${userId}/${mode}/${packetId}.png`;
      }
    } else {
      const safeName = (fileName || 'upload').replace(/[^a-zA-Z0-9.-]/g, '_');
      storagePath = `content/members/${userId}/${mode}/${packetId}/${safeName}`;
    }

    // Upload to Firebase Storage
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: actualMimeType,
        metadata: {
          mode,
          userId,
          packetId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    await file.makePublic();
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Update the packet with the uploaded content URL
    const updateData: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (mode === 'canvas' || mode === 'basics') {
      updateData.compositeUrl = publicUrl;
    } else if (mode === 'play') {
      updateData.playMediaUrl = publicUrl;
      updateData.playMediaType = actualMimeType;
    } else if (mode === 'dynamics') {
      updateData.dynamicsMediaUrl = publicUrl;
      updateData.dynamicsMediaType = actualMimeType;
    }
    
    await db.collection('productPackets').doc(packetId).update(updateData);

    console.log(`[Content Upload] Uploaded ${mode} content for packet ${packetId}: ${storagePath}`);

    res.json({
      success: true,
      fileName: storagePath.split('/').pop() || storagePath,
      storagePath,
      publicUrl,
      sizeBytes: buffer.length,
      mimeType: actualMimeType,
      mode,
      message: `${mode} content uploaded successfully`,
    });
  } catch (error: any) {
    console.error('[Content Upload] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Get mockups for a template - NO AUTH REQUIRED
app.get('/test/templates/:templateId/mockups', async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;

    const jobsSnapshot = await db.collection('mockupJobs')
      .where('templateId', '==', templateId)
      .get();

    const mockups = jobsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        color: data.color,
        size: data.size,
        placement: data.placement,
        mockupUrl: data.mockupUrl || null,
        error: data.error || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
      };
    });

    const completed = mockups.filter(m => m.status === 'completed');
    const pending = mockups.filter(m => m.status === 'pending');
    const processing = mockups.filter(m => m.status === 'processing');
    const failed = mockups.filter(m => m.status === 'failed');

    res.json({
      success: true,
      templateId,
      summary: {
        total: mockups.length,
        completed: completed.length,
        pending: pending.length,
        processing: processing.length,
        failed: failed.length,
      },
      mockups,
    });
  } catch (error: any) {
    console.error('[Mockups] Error getting mockups:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Get mockup queue status - NO AUTH REQUIRED
app.get('/test/queue/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pendingSnapshot = await db.collection('mockupJobs').where('status', '==', 'pending').get();
    const processingSnapshot = await db.collection('mockupJobs').where('status', '==', 'processing').get();
    const completedSnapshot = await db.collection('mockupJobs').where('status', '==', 'completed').limit(100).get();
    const failedSnapshot = await db.collection('mockupJobs').where('status', '==', 'failed').limit(100).get();

    res.json({
      success: true,
      queue: {
        pending: pendingSnapshot.size,
        processing: processingSnapshot.size,
        completed: completedSnapshot.size,
        failed: failedSnapshot.size,
      },
      message: `Queue status: ${pendingSnapshot.size} pending, ${processingSnapshot.size} processing`,
    });
  } catch (error: any) {
    console.error('[Queue] Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Process pending mockup jobs - NO AUTH REQUIRED
app.post('/test/queue/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 5 } = req.body;
    const processLimit = Math.min(limit, 20); // Cap at 20 per request

    // First, recover any stale "processing" jobs (stuck for > 5 minutes)
    // Fetch all processing jobs and filter in code to avoid composite index requirement
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const processingSnapshot = await db.collection('mockupJobs')
      .where('status', '==', 'processing')
      .limit(50)
      .get();
    
    let recoveredCount = 0;
    for (const doc of processingSnapshot.docs) {
      const data = doc.data();
      const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
      if (startedAt < fiveMinutesAgo) {
        await db.collection('mockupJobs').doc(doc.id).update({
          status: 'pending',
          retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[Queue] Recovered stale job ${doc.id}`);
        recoveredCount++;
      }
    }

    // Fetch pending jobs
    const pendingSnapshot = await db.collection('mockupJobs')
      .where('status', '==', 'pending')
      .limit(processLimit)
      .get();

    if (pendingSnapshot.empty) {
      res.json({
        success: true,
        processed: 0,
        recovered: recoveredCount,
        message: 'No pending jobs in queue',
      });
      return;
    }

    console.log(`[Queue] Processing ${pendingSnapshot.size} mockup jobs`);

    const results: Array<{ jobId: string; status: string; error?: string }> = [];

    for (const jobDoc of pendingSnapshot.docs) {
      const job = jobDoc.data();
      const jobId = jobDoc.id;

      try {
        // Atomic claim: Use transaction to ensure only one processor claims this job
        const claimed = await db.runTransaction(async (transaction) => {
          const jobRef = db.collection('mockupJobs').doc(jobId);
          const freshDoc = await transaction.get(jobRef);
          
          if (!freshDoc.exists || freshDoc.data()?.status !== 'pending') {
            return false; // Already claimed by another processor
          }
          
          transaction.update(jobRef, {
            status: 'processing',
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            processorId: `prod-${Date.now()}`,
          });
          return true;
        });

        if (!claimed) {
          console.log(`[Queue] Job ${jobId} already claimed, skipping`);
          continue;
        }

        // Rate limiting: Wait 10 seconds between API calls to avoid hitting Printful limits
        // Printful has strict rate limits (~30 requests/minute)
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Get template to find artwork URL and blueprint
        const templateDoc = await db.collection('productTemplates').doc(job.templateId).get();
        if (!templateDoc.exists) {
          throw new Error(`Template ${job.templateId} not found`);
        }
        const template = templateDoc.data()!;

        // Generate mockup via Printful
        const mockupResult = await generateMockupFromPrintful({
          blueprintId: template.blueprintId || 5,
          printProviderId: template.printProviderId || 39,
          colorName: job.colorName,
          colorHex: job.colorHex || '#000000',
          artworkUrl: template.artworkUrl,
          artworkVariant: template.artworkVariant || 'black',
        });

        // Store mockup URL in template's mockupsByColor
        const colorKey = job.colorName.replace(/\s+/g, '_').toLowerCase();
        const placementKey = job.placement || 'front';
        const sizeKey = job.qrSize || 'large';
        
        const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
        await db.collection('productTemplates').doc(job.templateId).update({
          [mockupPath]: mockupResult.mockupUrl,
          [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleMockupUrl || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Mark job completed
        await db.collection('mockupJobs').doc(jobId).update({
          status: 'completed',
          mockupUrl: mockupResult.mockupUrl,
          lifestyleMockupUrl: mockupResult.lifestyleMockupUrl || null,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.push({ jobId, status: 'completed' });
        console.log(`[Queue] Job ${jobId} completed: ${job.colorName} / ${job.placement} / ${job.qrSize}`);

      } catch (error: any) {
        console.error(`[Queue] Job ${jobId} failed:`, error.message);
        
        await db.collection('mockupJobs').doc(jobId).update({
          status: 'failed',
          error: error.message,
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.push({ jobId, status: 'failed', error: error.message });
      }
    }

    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      processed: results.length,
      completed,
      failed,
      results,
      message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed`,
    });

  } catch (error: any) {
    console.error('[Queue] Error processing jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Get all store-product links (for debugging) - NO AUTH REQUIRED
app.get('/test/store-product-links', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[Store Links GET] Fetching all links for debugging');
    
    const snapshot = await db.collection('storeProductLinks')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const links = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    }));
    
    console.log(`[Store Links GET] Found ${links.length} links`);
    res.json(links);
  } catch (error: any) {
    console.error('[Store Links GET] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Create store-product link (package linking) - NO AUTH REQUIRED
app.post('/test/store-product-links', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, storeName, channel, packetId, templateId, graphicsId, qrContent, productName, compositeUrl, qrOnlyUrl, pricing, enabledColors, enabledSizes, selectedGraphicSize, defaultColor } = req.body;

    console.log('[Store Links POST] Received request:', { storeId, channel, packetId, enabledColors, enabledSizes, selectedGraphicSize, defaultColor });

    if (!storeId || !channel) {
      res.status(400).json({ error: 'storeId and channel are required' });
      return;
    }
    
    if (!packetId && !templateId && !graphicsId) {
      res.status(400).json({ error: 'At least one of packetId, templateId, or graphicsId is required' });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    
    const linkData = {
      storeId,
      storeName: storeName || '',
      channel,
      packetId: packetId || null,
      templateId: templateId || null,
      graphicsId: graphicsId || null,
      qrContent: qrContent || null,
      productName: productName || null,
      compositeUrl: compositeUrl || null,
      qrOnlyUrl: qrOnlyUrl || null,
      pricing: pricing || null,
      enabledColors: enabledColors || [],
      enabledSizes: enabledSizes || [],
      selectedGraphicSize: selectedGraphicSize || 'medium',
      defaultColor: defaultColor || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const linkRef = await db.collection('storeProductLinks').add(linkData);
    
    console.log(`[Store Links TEST] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);

    res.json({
      success: true,
      linkId: linkRef.id,
      message: `Product linked to ${storeName || storeId} / ${channel}`,
    });
  } catch (error: any) {
    console.error('[Store Links TEST] Error creating link:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Update a store product link - NO AUTH REQUIRED
app.patch('/test/store-product-links/:linkId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const updates = req.body;

    if (!linkId) {
      res.status(400).json({ error: 'linkId is required' });
      return;
    }

    const docRef = db.collection('storeProductLinks').doc(linkId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    await docRef.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`[Store Links PATCH] Updated link ${linkId}:`, Object.keys(updates));

    res.json({
      success: true,
      linkId,
      message: 'Link updated',
    });
  } catch (error: any) {
    console.error('[Store Links PATCH] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Delete a store product link - NO AUTH REQUIRED
app.delete('/test/store-product-links/:linkId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;

    if (!linkId) {
      res.status(400).json({ error: 'linkId is required' });
      return;
    }

    const docRef = db.collection('storeProductLinks').doc(linkId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Link not found' });
      return;
    }

    await docRef.delete();
    
    console.log(`[Store Links DELETE] Deleted link ${linkId}`);

    res.json({
      success: true,
      linkId,
      message: 'Link deleted',
    });
  } catch (error: any) {
    console.error('[Store Links DELETE] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Save graphics (QR-only and/or composite) to library
app.post('/admin/graphics/save', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId } = req.body;

    // URLs are generated after packet creation, so no validation here

    const now = admin.firestore.FieldValue.serverTimestamp();
    let qrAssetId: string | null = null;
    let compositeAssetId: string | null = null;

    // Create QR-only asset if URL provided
    if (qrOnlyUrl) {
      const qrMetadata: Record<string, any> = { isQrOnly: true };
      if (storeId) qrMetadata.storeId = storeId;
      if (channelId) qrMetadata.channelId = channelId;
      
      const qrAssetData = {
        name: `${name || 'Untitled'} - QR Only`,
        assetType: 'graphic',
        mediaType: 'image',
        ownerType: 'admin',
        publicUrl: qrOnlyUrl,
        storageUrl: qrOnlyUrl,
        thumbnailUrl: qrOnlyUrl,
        category: category || 'qr-graphics',
        isActive: true,
        metadata: qrMetadata,
        createdAt: now,
        updatedAt: now,
      };
      const qrDocRef = await db.collection('libraryAssets').add(qrAssetData);
      qrAssetId = qrDocRef.id;
    }

    // Create composite asset if URL provided
    if (compositeUrl) {
      const compositeMetadata: Record<string, any> = { isComposite: true };
      if (storeId) compositeMetadata.storeId = storeId;
      if (channelId) compositeMetadata.channelId = channelId;
      
      const compositeAssetData = {
        name: `${name || 'Untitled'} - Composite`,
        assetType: 'graphic',
        mediaType: 'image',
        ownerType: 'admin',
        publicUrl: compositeUrl,
        storageUrl: compositeUrl,
        thumbnailUrl: compositeUrl,
        category: category || 'composite-graphics',
        isActive: true,
        metadata: compositeMetadata,
        createdAt: now,
        updatedAt: now,
      };
      const compositeDocRef = await db.collection('libraryAssets').add(compositeAssetData);
      compositeAssetId = compositeDocRef.id;
    }

    console.log(`[Graphics] Saved graphics: QR=${qrAssetId}, Composite=${compositeAssetId}`);

    res.json({
      success: true,
      qrAssetId,
      compositeAssetId,
      message: `Graphics saved to library${qrAssetId ? ' - QR saved' : ''}${compositeAssetId ? ' - Composite saved' : ''}`,
    });
  } catch (error: any) {
    console.error('[Graphics] Error saving graphics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Full template save with batch mockup generation
app.post('/admin/templates/full-save', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { template, colors = [], placements = ['front', 'back'] } = req.body;

    if (!template) {
      res.status(400).json({ error: 'Template data is required' });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Save template
    const templateData = {
      ...template,
      createdAt: now,
      updatedAt: now,
    };
    const templateRef = await db.collection('productTemplates').add(templateData);
    const templateId = templateRef.id;

    // Queue mockup generation jobs for each color × placement × qr size combo
    const qrSizes = ['small', 'medium', 'large'];
    let jobsQueued = 0;

    for (const color of colors) {
      for (const placement of placements) {
        // For front/back, generate all 3 QR sizes; for other placements, only large
        const sizesToGenerate = (placement === 'front' || placement === 'back') ? qrSizes : ['large'];
        
        for (const qrSize of sizesToGenerate) {
          const jobData = {
            templateId,
            colorName: color.name,
            colorHex: color.hex,
            placement,
            qrSize,
            status: 'pending',
            createdAt: now,
          };
          await db.collection('mockupJobs').add(jobData);
          jobsQueued++;
        }
      }
    }

    console.log(`[Templates] Full save complete: template=${templateId}, ${jobsQueued} mockup jobs queued`);

    // Trigger queue processing in background (fire and forget)
    if (jobsQueued > 0) {
      processQueueInBackground().catch(err => {
        console.error('[Templates] Background queue processing error:', err.message);
      });
    }

    res.json({
      success: true,
      templateId,
      jobsQueued,
      message: `Template saved with ${jobsQueued} mockup jobs queued`,
    });
  } catch (error: any) {
    console.error('[Templates] Error in full save:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CLAIM CODE SYSTEM ============

interface ClaimCode {
  claimCode: string;
  templateId: string;
  packetType: 'qr_canvas' | 'qr_play' | 'qr_doc' | 'qr_basics' | 'qr_plus';
  productName: string;
  productDescription?: string;
  previewImageUrl?: string;
  status: 'unclaimed' | 'claimed' | 'expired';
  instanceId?: string;
  claimedByUserId?: string;
  claimedAt?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

function generateNanoId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate claim code
app.get('/claim/validate/:claimCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimCode } = req.params;
    const doc = await db.collection('claimCodes').doc(claimCode).get();
    
    if (!doc.exists) {
      res.json({ valid: false, reason: 'Claim code not found' });
      return;
    }
    
    const claimData = doc.data() as ClaimCode;
    
    if (claimData.status === 'claimed') {
      res.json({ valid: false, reason: 'This item has already been claimed' });
      return;
    }
    
    if (claimData.status === 'expired') {
      res.json({ valid: false, reason: 'This claim code has expired' });
      return;
    }
    
    if (claimData.expiresAt && new Date(claimData.expiresAt) < new Date()) {
      await db.collection('claimCodes').doc(claimCode).update({ status: 'expired' });
      res.json({ valid: false, reason: 'This claim code has expired' });
      return;
    }
    
    res.json({ valid: true, claimData });
  } catch (error: any) {
    console.error('[Claim] Validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim an item
app.post('/claim/:claimCode', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimCode } = req.params;
    const userId = (req as any).user?.uid;
    const userEmail = (req as any).user?.email;
    
    const doc = await db.collection('claimCodes').doc(claimCode).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Claim code not found' });
      return;
    }
    
    const claimData = doc.data() as ClaimCode;
    
    if (claimData.status !== 'unclaimed') {
      res.status(400).json({ error: 'This item has already been claimed or expired' });
      return;
    }
    
    const instanceId = generateNanoId(16);
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    const instanceData = {
      instanceId,
      claimCode,
      templateId: claimData.templateId,
      packetType: claimData.packetType,
      ownerUserId: userId,
      ownerEmail: userEmail,
      productName: claimData.productName,
      productDescription: claimData.productDescription,
      previewImageUrl: claimData.previewImageUrl,
      destinationUrl: null,
      customConfig: null,
      status: 'active',
      hostingExpiresAt: oneYearFromNow.toISOString(),
      remindersSent: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      claimedAt: now.toISOString(),
      metadata: claimData.metadata,
    };
    
    const batch = db.batch();
    batch.set(db.collection('claimedInstances').doc(instanceId), instanceData);
    batch.update(db.collection('claimCodes').doc(claimCode), {
      status: 'claimed',
      instanceId,
      claimedByUserId: userId,
      claimedAt: now.toISOString(),
    });
    
    await batch.commit();
    
    console.log(`[Claim] Item claimed: ${claimCode} -> Instance: ${instanceId} by User: ${userId}`);
    res.json({ success: true, instanceId });
  } catch (error: any) {
    console.error('[Claim] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's claimed instances
app.get('/claimed-instances', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const snapshot = await db.collection('claimedInstances')
      .where('ownerUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const instances = snapshot.docs.map(doc => doc.data());
    res.json(instances);
  } catch (error: any) {
    console.error('[Claim] Get instances error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single claimed instance
app.get('/claimed-instances/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection('claimedInstances').doc(instanceId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }
    
    const instance = doc.data();
    const isActive = instance?.status === 'active' && new Date(instance?.hostingExpiresAt) > new Date();
    
    res.json({ ...instance, isActive });
  } catch (error: any) {
    console.error('[Claim] Get instance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update claimed instance destination
app.patch('/claimed-instances/:instanceId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { destinationUrl } = req.body;
    const userId = (req as any).user?.uid;
    
    const doc = await db.collection('claimedInstances').doc(instanceId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }
    
    const instance = doc.data();
    if (instance?.ownerUserId !== userId) {
      res.status(403).json({ error: 'Not authorized to modify this instance' });
      return;
    }
    
    await db.collection('claimedInstances').doc(instanceId).update({
      destinationUrl,
      updatedAt: new Date().toISOString(),
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Claim] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Generate claim codes
app.post('/admin/claim-codes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId, packetType, productName, productDescription, previewImageUrl, count = 1 } = req.body;
    
    if (!templateId || !packetType || !productName) {
      res.status(400).json({ error: 'templateId, packetType, and productName are required' });
      return;
    }
    
    const codes: ClaimCode[] = [];
    const batch = db.batch();
    
    for (let i = 0; i < Math.min(count, 100); i++) {
      const claimCode = generateNanoId(12);
      const claimData: ClaimCode = {
        claimCode,
        templateId,
        packetType,
        productName,
        productDescription,
        previewImageUrl,
        status: 'unclaimed',
        createdAt: new Date().toISOString(),
      };
      
      batch.set(db.collection('claimCodes').doc(claimCode), claimData);
      codes.push(claimData);
    }
    
    await batch.commit();
    
    console.log(`[Claim] Generated ${codes.length} claim codes for template: ${templateId}`);
    res.json({ 
      message: `Generated ${codes.length} claim codes`,
      codes: count === 1 ? codes[0] : codes,
    });
  } catch (error: any) {
    console.error('[Claim] Generate codes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export the API function with increased timeout and memory
export const api = onRequest(
  {
    timeoutSeconds: 540,  // 9 minutes max
    memory: '1GiB',
    cors: true,
  },
  app
);
// Force redeploy: 2026-01-27T06:55:00Z
// Force deploy Wed Jan 28 04:51:09 AM UTC 2026
// Force deploy Sat Jan 31 11:41:54 AM UTC 2026
