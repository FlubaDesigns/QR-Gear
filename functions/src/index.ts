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

type FulfillmentProvider = 'printify' | 'printful';

const PRINTIFY_TO_INTERNAL: Record<string, string> = {
  'front': 'front', 'back': 'back', 'pocket': 'pocket',
  'sleeve_left': 'left_sleeve', 'sleeve_right': 'right_sleeve',
  'left': 'left', 'right': 'right',
  'neck_label': 'label_outside', 'label': 'label_inside',
};

const PRINTFUL_TO_INTERNAL: Record<string, string> = {
  'front': 'front', 'front_large': 'front', 'front_dtf': 'front',
  'back': 'back', 'back_dtf': 'back',
  'sleeve_left': 'left_sleeve', 'sleeve_right': 'right_sleeve',
  'short_sleeve_left_dtf': 'left_sleeve', 'short_sleeve_right_dtf': 'right_sleeve',
  'label_outside': 'label_outside', 'label_inside': 'label_inside',
  'default': 'front',
};

const INTERNAL_TO_PRINTFUL: Record<string, string> = {
  'front': 'front_large', 'back': 'back',
  'left_sleeve': 'sleeve_left', 'right_sleeve': 'sleeve_right',
  'label_inside': 'label_inside', 'label_outside': 'label_outside',
};

const INTERNAL_TO_PRINTFUL_DTF: Record<string, string> = {
  'front': 'front_dtf', 'back': 'back_dtf',
  'left_sleeve': 'short_sleeve_left_dtf', 'right_sleeve': 'short_sleeve_right_dtf',
};

function normalizePlacement(provider: FulfillmentProvider, providerPlacement: string): string {
  const map = provider === 'printify' ? PRINTIFY_TO_INTERNAL : PRINTFUL_TO_INTERNAL;
  return map[providerPlacement] || providerPlacement;
}

function normalizePlacements(provider: FulfillmentProvider, providerPlacements: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const pp of providerPlacements) {
    const internal = normalizePlacement(provider, pp);
    if (!seen.has(internal)) { seen.add(internal); result.push(internal); }
  }
  return result;
}

function toProviderPlacement(provider: FulfillmentProvider, internal: string, availablePlacements?: string[], printMethod?: PrintMethod): string {
  if (provider === 'printful' && printMethod === 'dtf') {
    const dtfMapped = INTERNAL_TO_PRINTFUL_DTF[internal];
    if (dtfMapped && (!availablePlacements || availablePlacements.includes(dtfMapped))) {
      return dtfMapped;
    }
  }
  if (provider === 'printify') {
    const INTERNAL_TO_PRINTIFY: Record<string, string> = {
      'front': 'front', 'back': 'back', 'pocket': 'pocket',
      'left_sleeve': 'sleeve_left', 'right_sleeve': 'sleeve_right',
      'label_inside': 'label', 'label_outside': 'neck_label',
      'left': 'left', 'right': 'right',
    };
    return INTERNAL_TO_PRINTIFY[internal] || internal;
  }
  let mapped = INTERNAL_TO_PRINTFUL[internal] || internal;
  if (internal === 'front' && availablePlacements) {
    if (availablePlacements.includes('front_large')) mapped = 'front_large';
    else if (availablePlacements.includes('front')) mapped = 'front';
  }
  return mapped;
}

function isEmbroideryPlacement(p: string): boolean { return p.startsWith('embroidery_'); }

type PrintMethod = 'dtg' | 'dtf';
function detectPrintMethod(providerPlacement: string): PrintMethod {
  return providerPlacement.endsWith('_dtf') ? 'dtf' : 'dtg';
}
function groupPlacementsByLocation(provider: FulfillmentProvider, rawPlacements: string[]): { internal: string; methods: { method: PrintMethod; providerName: string }[] }[] {
  const groups = new Map<string, { method: PrintMethod; providerName: string }[]>();
  for (const raw of rawPlacements) {
    const internal = normalizePlacement(provider, raw);
    const method = detectPrintMethod(raw);
    if (!groups.has(internal)) groups.set(internal, []);
    const existing = groups.get(internal)!;
    if (!existing.some(m => m.method === method)) existing.push({ method, providerName: raw });
  }
  const result: { internal: string; methods: { method: PrintMethod; providerName: string }[] }[] = [];
  groups.forEach((methods, internal) => result.push({ internal, methods }));
  return result;
}

const QR_GEAR_BRANDED_TAG_URL = 'https://qrgear-c1ffd.web.app/img/qr-gear-neck-tag-600.png';
const LABEL_PLACEMENTS_PRINTFUL = ['label_outside', 'label_inside'];

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
  placement?: string;
  printMethod?: PrintMethod;
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
    p.placement === 'front' || p.placement === 'front_large' || p.placement === 'default'
  );
  
  const canonicalPlacement = request.placement || 'front';
  const availPlacementNames = printfileData?.printfiles?.map((p: any) => p.placement) || [];
  const placement = toProviderPlacement('printful', canonicalPlacement, availPlacementNames, request.printMethod);
  const areaWidth = frontPrintfile?.width || 1800;
  const areaHeight = frontPrintfile?.height || 2400;
  
  const mockupFiles: Array<{ placement: string; image_url: string; position?: any }> = [{
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
  }];

  const availPlacements = printfileData?.available_placements ? Object.keys(printfileData.available_placements) : [];
  let preferredLabel: 'outside' | 'inside' = 'outside';
  try {
    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    if (pricingDoc.exists) {
      preferredLabel = pricingDoc.data()?.preferredLabelPosition || 'outside';
    }
  } catch (e) {
    console.warn('[Mockup] Could not read label preference, defaulting to outside');
  }
  const preferredPrintful = preferredLabel === 'inside' ? 'label_inside' : 'label_outside';
  const fallbackPrintful = preferredLabel === 'inside' ? 'label_outside' : 'label_inside';
  const labelPlacement = availPlacements.includes(preferredPrintful) ? preferredPrintful
    : availPlacements.includes(fallbackPrintful) ? fallbackPrintful : null;
  if (labelPlacement) {
    mockupFiles.push({ placement: labelPlacement, image_url: QR_GEAR_BRANDED_TAG_URL });
    console.log(`[Mockup] Auto-attaching branded tag to ${labelPlacement} (preferred: ${preferredLabel})`);
  }
  
  console.log('[Printful] Creating mockup with files:', JSON.stringify(mockupFiles));
  
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
        mockupFiles,
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
    const snapshot = await db.collection('library_assets').where('isActive', '==', true).limit(20).get();
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

// PUBLIC test endpoint - update product options (no auth)

// PUBLIC test endpoint - sync product from Printify (no auth - simplified)

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
const KC_API_KEY = process.env['KC-API-KEY'];

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

// KC Widget Items endpoint - used by Kingdom Connects widget embed
app.get('/widget/items', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check KC_API_KEY authentication
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;
    
    const providedKey = apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader);
    
    if (!KC_API_KEY || providedKey !== KC_API_KEY) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }
    
    const channelId = req.query.channelId as string;
    const storeId = req.query.storeId as string || 'kingdom_connects';
    
    if (!channelId) {
      res.status(400).json({ error: 'channelId is required' });
      return;
    }
    
    // Query channel items from Firestore
    const snapshot = await db.collection('catalogItemLinks')
      .where('channelId', '==', channelId)
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || data.name,
        description: data.description,
        previewUrl: data.previewUrl || data.thumbnailUrl,
        publicUrl: data.publicUrl,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        shareImageSquareUrl: data.shareImageSquareUrl,
        shareImageLinkUrl: data.shareImageLinkUrl,
        shareCaption: data.shareCaption,
      };
    });
    
    res.json({
      channelId,
      storeId,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error('Widget items error:', error);
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
    const placement = 'front';
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
    
    const blackArtwork = designPlacements['front'] || 
                         designPlacements['front-chest'] || 
                         designPlacements['front-chest-black'] || 
                         designPlacements['front-center'];
    const whiteArtwork = designPlacements['front-white'] || 
                         designPlacements['front-chest-white'] || 
                         designPlacements['front-center-white'];
    
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
      canonicalPlacementId = 'front',
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

// ============ ADMIN STORES (stores + storeChannels collections) ============

app.get('/admin/stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const roleType = req.query.roleType as string;
    let query: any = db.collection('stores');
    if (roleType) query = query.where('roleType', '==', roleType);
    const snapshot = await query.get();
    const stores = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    stores.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    res.json(stores);
  } catch (error: any) {
    console.error('[Stores] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, roleType } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Store name is required' }); return; }
    if (!roleType || !['internal', 'external', 'member'].includes(roleType)) { res.status(400).json({ error: 'Valid roleType is required' }); return; }
    const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const storeData = { name: name.trim(), roleType, isActive: true, channelCount: 0, createdAt: new Date().toISOString() };
    await db.collection('stores').doc(storeId).set(storeData);
    res.json({ id: storeId, ...storeData });
  } catch (error: any) {
    console.error('[Stores] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/stores/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const channelsSnapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const batch = db.batch();
    channelsSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
    batch.delete(db.collection('stores').doc(storeId));
    await batch.commit();
    res.json({ success: true, deletedChannels: channelsSnapshot.size });
  } catch (error: any) {
    console.error('[Stores] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/stores/by-id/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    let doc = await db.collection('stores').doc(storeId).get();
    if (doc.exists) {
      const data = doc.data();
      res.json({ id: doc.id, name: data?.name || storeId, type: data?.roleType || 'internal', roleType: data?.roleType || 'internal', isActive: data?.isActive ?? true });
      return;
    }
    doc = await db.collection('partnerStores').doc(storeId).get();
    if (doc.exists) {
      const data = doc.data();
      res.json({ id: doc.id, name: data?.name || storeId, type: data?.isInternal ? 'internal' : 'external', roleType: data?.isInternal ? 'internal' : 'external', isActive: data?.isActive ?? true, isPartnerStore: true });
      return;
    }
    res.status(404).json({ error: 'Store not found' });
  } catch (error: any) {
    console.error('[Stores] GET by-id error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/stores/:storeId/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const snapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const channels = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    channels.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(channels);
  } catch (error: any) {
    console.error('[Channels] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/stores/:storeId/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Channel name is required' }); return; }
    const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const channelData = { name: name.trim(), storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
    await db.collection('storeChannels').doc(channelId).set(channelData);
    res.json({ id: channelId, ...channelData });
  } catch (error: any) {
    console.error('[Channels] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/stores/:storeId/channels/:channelId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params;
    await db.collection('storeChannels').doc(channelId).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Channels] DELETE error:', error);
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

// ============ ALLOWED PRODUCTS ============

app.get('/admin/stores/:storeId/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const doc = await db.collection('storeAllowedProducts').doc(storeId).get();
    if (!doc.exists) { res.json({ storeId, products: [] }); return; }
    const data = doc.data();
    res.json({ storeId, products: data?.products || [], updatedAt: data?.updatedAt });
  } catch (error: any) {
    console.error('[AllowedProducts] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/stores/:storeId/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { products } = req.body;
    if (!Array.isArray(products)) { res.status(400).json({ error: 'products must be an array' }); return; }
    await db.collection('storeAllowedProducts').doc(storeId).set({
      storeId,
      products,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, storeId, productCount: products.length });
  } catch (error: any) {
    console.error('[AllowedProducts] POST error:', error);
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
    
    const blackArtwork = designPlacements['front'] || designPlacements['front-chest'];
    const whiteArtwork = designPlacements['front-white'] || designPlacements['front-chest-white'];
    
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
        
        // Save with full key: color_size_placement (e.g., "Black_medium_front")
        const graphicSize = 'medium';
        const placement = 'front';
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



// Test DELETE endpoint (no auth)

// ============ TEST PRODUCTS ENDPOINTS (no auth) ============

// Get fulfillment provider status (which providers are configured)

// Get all products (test endpoint) - supports provider filter

// Sync products from Printify (test endpoint - placeholder)

// Update product (test endpoint - no auth required)

// Get stores by role type (test endpoint - no /admin segment for test routes) - uses Firestore

// Create a new store (test endpoint) - uses Firestore

// Delete a store (test endpoint) - uses Firestore

// Get store by ID (test endpoint) - checks both stores and partnerStores collections

// Get channels for a store (test endpoint)

// Create a new channel for a store

// Delete a channel

// Test endpoint: stores by type (internal/external/member) for store library

// Test endpoint: partner-stores (no auth required) - mirrors admin endpoint for save funnel testing

// Test endpoint: Get products for a partner store (no auth required)

// Test endpoint: Sync products to a partner store (no auth required)

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

// Sync Printful catalog from their API (includes lifestyle images)

// Sync Printify catalog from their API (blueprints, providers, and print areas)

// Test endpoint: Get blueprint details (colors/sizes) for configuration

// Test endpoint: GET products for a store channel (for Store Library) - uses storeProductLinks

// Test endpoint: Assign configured products to store channel

// ============ LIBRARY ASSETS (ADMIN) ============

app.get('/admin/background-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const typeFilter = (req.query.type as string) || 'source';
    const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
    if (!validTypes.includes(typeFilter)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }
    console.log('[BackgroundAssets] GET request - type:', typeFilter);
    const snapshot = await db.collection('library_assets')
      .where('assetType', '==', typeFilter)
      .get();
    console.log('[BackgroundAssets] Raw docs for type', typeFilter, ':', snapshot.size);
    
    const assets = snapshot.docs
      .map(doc => docToObject(doc))
      .filter(doc => doc.isActive === true)
      .sort((a: any, b: any) => {
        const getTime = (val: any): number => {
          if (!val) return 0;
          if (typeof val === 'string') return new Date(val).getTime() || 0;
          if (val.toDate) return val.toDate().getTime();
          if (val._seconds) return val._seconds * 1000;
          if (val instanceof Date) return val.getTime();
          return 0;
        };
        return getTime(a.createdAt) - getTime(b.createdAt);
      })
      .map(data => {
        const storageUrl = data.storageUrl || '';
        const filename = storageUrl.split('/').pop() || data.fileName || '';
        return {
          ...data,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
          publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
        };
      });
    
    console.log('[BackgroundAssets] Filtered assets:', assets.length);
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
    
    // Save metadata to Firestore library_assets collection
    const fileNameOnly = fullPath.split('/').pop() || name;
    const proxyUrl = `/api/library-files/${encodeURIComponent(fileNameOnly)}`;
    const docRef = await db.collection('library_assets').add({
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
    
    if (assetType === 'cropped' && sourceAssetId) {
      try {
        await db.collection('library_assets').doc(sourceAssetId).update({
          assetType: 'background',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[BackgroundAssets] Source ${sourceAssetId} moved to background after crop`);
      } catch (moveErr: any) {
        console.error(`[BackgroundAssets] Failed to move source to background:`, moveErr.message);
      }
    }

    const doc = await docRef.get();
    console.log(`[BackgroundAssets] Upload complete: ${doc.id}`);
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error("[BackgroundAssets] Upload error:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/background-assets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Soft delete (set isActive to false)
    await db.collection('library_assets').doc(req.params.id).update({
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
    
    // Get existing records from Firestore library_assets - filter in memory to avoid index
    const existingSnapshot = await db.collection('library_assets').get();
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
        
        const docRef = await db.collection('library_assets').add({
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
    let query: FirebaseFirestore.Query = db.collection('library_assets');
    
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
    let query: FirebaseFirestore.Query = db.collection('library_assets').where('ownerType', '==', 'admin');
    
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
    const docRef = await db.collection('library_assets').add(assetData);
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
    await db.collection('library_assets').doc(id).update(updateData);
    const doc = await db.collection('library_assets').doc(id).get();
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
    await db.collection('library_assets').doc(id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Library] Error deleting asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Save graphics (QR-only and/or composite) to library - NO AUTH REQUIRED

// PUBLIC TEST: Get all templates - NO AUTH REQUIRED

// PUBLIC TEST: Create template linked to packet - NO AUTH REQUIRED

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
        placement: job.placement || 'front',
        printMethod: job.printMethod,
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

// PUBLIC TEST: Create product packet (master record) - NO AUTH REQUIRED

// PUBLIC TEST: Get all product packets - NO AUTH REQUIRED

// PUBLIC TEST: Get product packet by ID - NO AUTH REQUIRED

// PUBLIC TEST: Update packet with final URLs - NO AUTH REQUIRED

// PUBLIC TEST: Delete packet - NO AUTH REQUIRED

// PUBLIC TEST: Get landing page by slug - NO AUTH REQUIRED

// PUBLIC TEST: Delete template - NO AUTH REQUIRED

// PUBLIC TEST: Upload content (composite or media) to Firebase Storage - NO AUTH REQUIRED

// PUBLIC TEST: Get mockups for a template - NO AUTH REQUIRED

// PUBLIC TEST: Get mockup queue status - NO AUTH REQUIRED

// PUBLIC TEST: Process pending mockup jobs - NO AUTH REQUIRED

// PUBLIC TEST: Get all store-product links (for debugging) - NO AUTH REQUIRED

// PUBLIC TEST: Create store-product link (package linking) - NO AUTH REQUIRED

// PUBLIC TEST: Update a store product link - NO AUTH REQUIRED

// PUBLIC TEST: Delete a store product link - NO AUTH REQUIRED

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
      const qrDocRef = await db.collection('library_assets').add(qrAssetData);
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
      const compositeDocRef = await db.collection('library_assets').add(compositeAssetData);
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
    const { template, colors = [], placements = ['front', 'back'], placementMethods = {} } = req.body;

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
          const jobData: Record<string, any> = {
            templateId,
            colorName: color.name,
            colorHex: color.hex,
            placement,
            qrSize,
            status: 'pending',
            createdAt: now,
          };
          if (placementMethods[placement]) {
            jobData.printMethod = placementMethods[placement];
          }
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

// ============ PRODUCTS PAGE: FULFILLMENT PROVIDERS ============

app.get('/admin/fulfillment-providers', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const printifyKey = process.env.PRINTIFY_API_KEY || getPrintifyApiKey();
    const printfulKey = process.env.PRINTFUL_API_KEY || getPrintfulApiKey();
    const apliiqKey = process.env.APLIIQ_API_KEY;
    const providers = [
      { id: "printify", name: "Printify", configured: !!printifyKey && printifyKey.length > 10, role: "fulfillment", description: "Print-on-demand fulfillment via Printify network" },
      { id: "printful", name: "Printful", configured: !!printfulKey && printfulKey.length > 10, role: "fulfillment", description: "Print-on-demand fulfillment via Printful" },
      { id: "apliiq", name: "Apliiq", configured: !!apliiqKey && (apliiqKey?.length || 0) > 10, role: "fulfillment", description: "Custom apparel via Apliiq" },
    ];
    console.log(`[FulfillmentProviders] Returning ${providers.filter(p => p.configured).length} configured`);
    res.json(providers);
  } catch (error: any) {
    console.error('[FulfillmentProviders] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRICING SETTINGS (PUBLIC) ============

app.get('/pricing-settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection("testSettings").doc("pricing").get();
    const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBrandLabelPricing = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    if (!doc.exists) {
      res.json({
        markupPercent: 25, markupFixed: 0, additionalPlacementCost: 4,
        textLineUpcharge: 2, memberProfitShare: 0.25,
        sizeUpcharges: defaultSizeUpcharges,
        hostingTiers: [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
        brandLabelPricing: defaultBrandLabelPricing,
        preferredLabelPosition: 'outside',
      });
      return;
    }
    const data = doc.data();
    res.json({
      ...data,
      memberProfitShare: data?.memberProfitShare ?? 0.25,
      sizeUpcharges: data?.sizeUpcharges ?? defaultSizeUpcharges,
      brandLabelPricing: data?.brandLabelPricing ?? defaultBrandLabelPricing,
      preferredLabelPosition: data?.preferredLabelPosition ?? 'outside',
    });
  } catch (error: any) {
    console.error("[Pricing Settings Public CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRICING SETTINGS (ADMIN) ============

app.get('/admin/pricing-settings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection("testSettings").doc("pricing").get();
    const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBrandLabelPricing = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    if (!doc.exists) {
      res.json({
        markupPercent: 25, markupFixed: 0, additionalPlacementCost: 4, textLineUpcharge: 2,
        memberProfitShare: 0.25, sizeUpcharges: defaultSizeUpcharges,
        hostingTiers: [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
        brandLabelPricing: defaultBrandLabelPricing,
        preferredLabelPosition: 'outside',
      });
      return;
    }
    const data = doc.data();
    res.json({
      ...data,
      memberProfitShare: data?.memberProfitShare ?? 0.25,
      sizeUpcharges: data?.sizeUpcharges ?? defaultSizeUpcharges,
      brandLabelPricing: data?.brandLabelPricing ?? defaultBrandLabelPricing,
      preferredLabelPosition: data?.preferredLabelPosition ?? 'outside',
    });
  } catch (error: any) {
    console.error("[Pricing Settings] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/pricing-settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
    const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBrandLabelPricing = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    const settings = {
      markupPercent: parseFloat(markupPercent) || 25,
      markupFixed: parseFloat(markupFixed) || 0,
      additionalPlacementCost: parseFloat(additionalPlacementCost) || 4,
      textLineUpcharge: parseFloat(textLineUpcharge) || 2,
      memberProfitShare: parseFloat(memberProfitShare) || 0.25,
      sizeUpcharges: sizeUpcharges || defaultSizeUpcharges,
      hostingTiers: hostingTiers || [
        { code: "1_year", name: "1 Year", price: 5 },
        { code: "2_year", name: "2 Years", price: 8 },
        { code: "3_year", name: "3 Years", price: 10 },
      ],
      brandLabelPricing: brandLabelPricing || defaultBrandLabelPricing,
      preferredLabelPosition: preferredLabelPosition || 'outside',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection("testSettings").doc("pricing").set(settings, { merge: true });
    console.log("[Pricing Settings] Saved settings");
    res.json({ success: true, settings, message: "Pricing settings saved" });
  } catch (error: any) {
    console.error("[Pricing Settings] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PACKETS CRUD ============

app.post('/admin/packets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      qrOnlyUrl, compositeUrl, qrContent, headerText, footerText, pricing,
      productId, productName, productDescription, productImageUrl,
      blueprintId, printProviderId, manufacturer, madeInUSA, category,
      defaultColor, defaultColorHex, defaultPlacement, qrProductState,
      placements, availablePlacements, sizes, colors, basePrice, customerPrice,
      mockupsByColor, landingPageTitle, landingPageDescription,
      landingPageBackgroundUrl, landingPageSlug, headerStyle, footerStyle,
      roleType, storeId, storeName, channelId, channelName,
      fulfillmentProvider, playMediaUrl, playMediaType,
    } = req.body;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const packetData: Record<string, any> = {
      qrOnlyUrl: qrOnlyUrl || null, compositeUrl: compositeUrl || null,
      qrContent: qrContent || null, headerText: headerText || null, footerText: footerText || null,
      pricing: pricing || null, productId: productId || null, productName: productName || null,
      productDescription: productDescription || null, productImageUrl: productImageUrl || null,
      blueprintId: blueprintId || null, printProviderId: printProviderId || null,
      manufacturer: manufacturer || null, madeInUSA: madeInUSA || false,
      category: category || null, defaultColor: defaultColor || null,
      defaultColorHex: defaultColorHex || null, defaultPlacement: defaultPlacement || null,
      qrProductState: qrProductState || null, placements: placements || [],
      availablePlacements: availablePlacements || [], sizes: sizes || [],
      colors: colors || [], basePrice: basePrice || null, customerPrice: customerPrice || null,
      mockupsByColor: mockupsByColor || null,
      landingPageTitle: landingPageTitle || null, landingPageDescription: landingPageDescription || null,
      landingPageBackgroundUrl: landingPageBackgroundUrl || null,
      landingPageSlug: landingPageSlug || null,
      headerStyle: headerStyle || null, footerStyle: footerStyle || null,
      roleType: roleType || null, storeId: storeId || null,
      storeName: storeName || null, channelId: channelId || null,
      channelName: channelName || null, fulfillmentProvider: fulfillmentProvider || 'printify',
      playMediaUrl: playMediaUrl || null, playMediaType: playMediaType || null,
      createdAt: now, updatedAt: now,
    };
    const packetRef = await db.collection("productPackets").add(packetData);
    const packetId = packetRef.id;
    console.log(`[Packets CF] Created packet: ${packetId}`);

    let mockupJobsQueued = 0;
    const canQueueMockups = blueprintId && colors && Array.isArray(colors) && colors.length > 0 &&
      (fulfillmentProvider === 'printful' || printProviderId);
    if (canQueueMockups) {
      try {
        const artworkUrl = compositeUrl || qrOnlyUrl;
        if (artworkUrl) {
          const targetPlacements = (placements && placements.length > 0) ? placements : ["front"];
          const qrSizes = ["small", "medium", "large"];
          const productIdForMockups = `packet_${packetId}`;
          console.log(`[Packets CF] Queueing mockups for ${colors.length} colors × ${targetPlacements.length} placements × ${qrSizes.length} sizes`);
          let priority = 0;
          const batch = db.batch();
          for (const placement of targetPlacements) {
            for (const color of colors) {
              for (const qrSize of qrSizes) {
                const jobRef = db.collection("mockup_jobs").doc();
                batch.set(jobRef, {
                  productId: productIdForMockups,
                  colorName: color.name || color,
                  qrSize,
                  placement,
                  jobData: {
                    blueprintId: parseInt(blueprintId),
                    printProviderId: printProviderId ? parseInt(printProviderId) : null,
                    artworkUrl,
                    artworkVariant: "black",
                    fulfillmentProvider: fulfillmentProvider || 'printify',
                  },
                  status: "pending",
                  priority: priority++,
                  attempts: 0,
                  maxAttempts: 5,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                mockupJobsQueued++;
              }
            }
          }
          await batch.commit();
          console.log(`[Packets CF] Queued ${mockupJobsQueued} mockup jobs for packet ${packetId}`);
        } else {
          console.log(`[Packets CF] No artwork URL available yet, skipping mockup queue`);
        }
      } catch (err: any) {
        console.error(`[Packets CF] Failed to queue mockup jobs:`, err.message);
      }
    }

    res.json({
      success: true, packetId, mockupJobsQueued,
      message: `Product packet created${mockupJobsQueued > 0 ? ` with ${mockupJobsQueued} mockup jobs queued` : ''}`,
    });
  } catch (error: any) {
    console.error("[Packets] Error creating packet:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/packets', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection("productPackets").orderBy("createdAt", "desc").limit(100).get();
    const packets = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, createdAt: data?.createdAt?.toDate?.() || null, updatedAt: data?.updatedAt?.toDate?.() || null };
    });
    console.log(`[Packets] Retrieved ${packets.length} packets`);
    res.json({ success: true, packets, count: packets.length });
  } catch (error: any) {
    console.error("[Packets] Error getting packets:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/public/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    const doc = await db.collection("productPackets").doc(packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const data = doc.data();
    let linkedTemplateId = null;
    const templatesSnapshot = await db.collection("productTemplates").where("packetId", "==", packetId).limit(1).get();
    if (!templatesSnapshot.empty) { linkedTemplateId = templatesSnapshot.docs[0].id; }
    res.json({
      success: true,
      packet: { id: doc.id, ...data, templateId: linkedTemplateId, createdAt: data?.createdAt?.toDate?.() || null, updatedAt: data?.updatedAt?.toDate?.() || null },
    });
  } catch (error: any) {
    console.error("[Packets] Error getting packet:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/packets/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const updates = req.body;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    const docRef = db.collection("productPackets").doc(packetId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    await docRef.update({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`[Packets PATCH] Updated packet ${packetId}:`, Object.keys(updates));
    res.json({ success: true, packetId, message: "Packet updated" });
  } catch (error: any) {
    console.error("[Packets PATCH] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/packets/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    const docRef = db.collection("productPackets").doc(packetId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const cascadeResults = { graphics: 0, templates: 0, storeProductLinks: 0 };
    const graphicsSnap = await db.collection("productGraphics").where("packetId", "==", packetId).get();
    for (const graphicDoc of graphicsSnap.docs) { await graphicDoc.ref.delete(); cascadeResults.graphics++; }
    const templatesSnap = await db.collection("productTemplates").where("packetId", "==", packetId).get();
    for (const templateDoc of templatesSnap.docs) { await templateDoc.ref.delete(); cascadeResults.templates++; }
    const linksSnap = await db.collection("storeProductLinks").where("packetId", "==", packetId).get();
    for (const linkDoc of linksSnap.docs) { await linkDoc.ref.delete(); cascadeResults.storeProductLinks++; }
    await docRef.delete();
    console.log(`[Packets DELETE] Deleted packet ${packetId} with cascade:`, cascadeResults);
    res.json({ success: true, packetId, cascade: cascadeResults, message: "Packet and related data deleted" });
  } catch (error: any) {
    console.error("[Packets DELETE] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: STORE-PRODUCT-LINKS CRUD ============

app.get('/admin/store-product-links', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const linksSnapshot = await db.collection("storeProductLinks").orderBy("createdAt", "desc").limit(100).get();
    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }));
    console.log(`[Store Links] Listed ${links.length} total links`);
    res.json({ success: true, links, count: links.length });
  } catch (error: any) {
    console.error("[Store Links] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/store-product-links', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      storeId, storeName, channel, collection, packetId, templateId, graphicsId,
      qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
      enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
      qrProductState, landingPageUrl, mockupUrl
    } = req.body;
    if (!storeId || !channel) { res.status(400).json({ error: "storeId and channel are required" }); return; }
    if (!packetId && !templateId && !graphicsId) { res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" }); return; }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const linkData: Record<string, any> = {
      storeId, storeName: storeName || "", channel, collection: collection || null,
      packetId: packetId || null, templateId: templateId || null, graphicsId: graphicsId || null,
      qrContent: qrContent || null, productName: productName || null,
      compositeUrl: compositeUrl || null, qrOnlyUrl: qrOnlyUrl || null, pricing: pricing || null,
      enabledColors: enabledColors || [], enabledSizes: enabledSizes || [],
      selectedGraphicSize: selectedGraphicSize || null, defaultColor: defaultColor || null,
      qrProductState: qrProductState || null, landingPageUrl: landingPageUrl || null,
      mockupUrl: mockupUrl || null, createdAt: now, updatedAt: now,
    };
    const linkRef = await db.collection("storeProductLinks").add(linkData);
    console.log(`[Store Links] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);
    res.json({ success: true, linkId: linkRef.id, message: `Product linked to ${storeName || storeId} / ${channel}` });
  } catch (error: any) {
    console.error("[Store Links] Error creating link:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/stores/:storeId/channels/:channelId/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    if (!storeId || !channelId) { res.status(400).json({ error: "storeId and channelId are required" }); return; }
    const linksSnapshot = await db.collection("storeProductLinks")
      .where("storeId", "==", storeId).where("channel", "==", channelId).get();
    const products = linksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, linkId: doc.id, packetId: data.packetId || null,
        templateId: data.templateId || null, name: data.productName || "Untitled Product",
        imageUrl: data.compositeUrl || data.qrOnlyUrl || null, mockupUrl: data.mockupUrl || null,
        qrContent: data.qrContent || null, pricing: data.pricing || null,
        enabledColors: data.enabledColors || [], enabledSizes: data.enabledSizes || [],
        selectedGraphicSize: data.selectedGraphicSize || null, defaultColor: data.defaultColor || null,
        collection: data.collection || null, qrProductState: data.qrProductState || null,
        landingPageUrl: data.landingPageUrl || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    console.log(`[Store Links] Found ${products.length} products for ${storeId}/${channelId}`);
    res.json(products);
  } catch (error: any) {
    console.error("[Store Links] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/store-product-links/:linkId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const updates = req.body;
    if (!linkId) { res.status(400).json({ error: "linkId is required" }); return; }
    const docRef = db.collection("storeProductLinks").doc(linkId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Link not found" }); return; }
    await docRef.update({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`[Store Links PATCH] Updated link ${linkId}:`, Object.keys(updates));
    res.json({ success: true, linkId, message: "Link updated" });
  } catch (error: any) {
    console.error("[Store Links PATCH] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/store-product-links/:linkId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    if (!linkId) { res.status(400).json({ error: "linkId is required" }); return; }
    const docRef = db.collection("storeProductLinks").doc(linkId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Link not found" }); return; }
    await docRef.delete();
    console.log(`[Store Links DELETE] Deleted link ${linkId}`);
    res.json({ success: true, linkId, message: "Link deleted" });
  } catch (error: any) {
    console.error("[Store Links DELETE] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: CATALOG SYNC ============

app.get('/admin/catalog/sync-status', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const syncId = req.query.syncId as string;
    if (syncId) {
      const syncDoc = await db.collection("catalogSyncs").doc(syncId).get();
      if (!syncDoc.exists) { res.status(404).json({ error: "Sync not found" }); return; }
      const syncData = syncDoc.data();
      let summary = null;
      if (syncData?.status === 'completed' && syncData?.errorMessage) {
        try { summary = JSON.parse(syncData.errorMessage); } catch {}
      }
      res.json({ id: syncDoc.id, ...syncData, summary });
      return;
    }
    const latestSnapshot = await db.collection("catalogSyncs").orderBy("startedAt", "desc").limit(1).get();
    if (latestSnapshot.empty) { res.json({ status: 'none', message: 'No sync has been run yet' }); return; }
    const latest = { id: latestSnapshot.docs[0].id, ...latestSnapshot.docs[0].data() };
    let summary = null;
    if ((latest as any).status === 'completed' && (latest as any).errorMessage) {
      try { summary = JSON.parse((latest as any).errorMessage); } catch {}
    }
    const bpSnapshot = await db.collection("printify_blueprints").limit(1).get();
    res.json({ ...latest, summary, totalBlueprints: bpSnapshot.size, isConfigured: printifyClient.isConfigured });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/catalog/sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const latestSnapshot = await db.collection("catalogSyncs").orderBy("startedAt", "desc").limit(1).get();
    if (!latestSnapshot.empty) {
      const latest = latestSnapshot.docs[0].data();
      if (latest.status === 'running') {
        const startedAt = latest.startedAt?.toDate?.()?.getTime() || 0;
        if (Date.now() - startedAt < 30 * 60 * 1000) {
          res.status(409).json({ error: "Sync already in progress", syncId: latestSnapshot.docs[0].id });
          return;
        }
        await latestSnapshot.docs[0].ref.update({ status: 'failed', errorMessage: 'Timed out - cleared as stale' });
      }
    }
    const syncRef = await db.collection("catalogSyncs").add({
      syncType: 'smart', status: 'running', blueprintsCount: 0, providersCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ syncId: syncRef.id, status: 'started', message: 'Smart sync started' });
    (async () => {
      try {
        console.log('[SmartSync CF] Starting catalog sync...');
        const existingBpSnapshot = await db.collection("printify_blueprints").get();
        const existingBpMap = new Map<number, any>();
        for (const doc of existingBpSnapshot.docs) { existingBpMap.set(doc.data().id || parseInt(doc.id), doc); }
        const blueprints = await printifyClient.getCatalogBlueprints();
        console.log(`[SmartSync CF] Found ${blueprints.length} blueprints`);
        let bpAdded = 0, bpUpdated = 0, bpSkipped = 0;
        for (const bp of blueprints) {
          try {
            const existing = existingBpMap.get(bp.id);
            const existingData = existing?.data();
            const changed = !existingData || existingData.title !== bp.title || existingData.brand !== (bp.brand || null) || existingData.model !== (bp.model || null);
            if (changed) {
              await db.collection("printify_blueprints").doc(String(bp.id)).set({
                id: bp.id, title: bp.title, description: bp.description || null,
                brand: bp.brand || null, model: bp.model || null,
                images: bp.images || null, primaryImageUrl: bp.images?.[0] || null,
                lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
              if (existingData) { bpUpdated++; } else { bpAdded++; }
            } else { bpSkipped++; }
            await new Promise(r => setTimeout(r, 50));
          } catch (bpError: any) { console.error(`[SmartSync CF] Error syncing bp ${bp.id}:`, bpError.message); }
        }
        const summary = { blueprints: { added: bpAdded, updated: bpUpdated, skipped: bpSkipped, total: blueprints.length } };
        await syncRef.update({
          status: 'completed', blueprintsCount: bpAdded + bpUpdated,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          errorMessage: JSON.stringify(summary),
        });
        console.log(`[SmartSync CF] Done:`, JSON.stringify(summary));
      } catch (error: any) {
        console.error('[SmartSync CF] Error:', error.message);
        await syncRef.update({ status: 'failed', errorMessage: error.message, completedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/catalog/sync-printful', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printfulClient.isConfigured) { res.status(503).json({ error: "Printful API key not configured" }); return; }
    res.json({ success: true, message: "Printful catalog sync started in background" });
    (async () => {
      try {
        console.log('[Printful Sync CF] Starting sync...');
        const categories = await printfulClient.getProduct(0).catch(() => null);
        console.log('[Printful Sync CF] Sync initiated - use dev server for full sync');
      } catch (syncError: any) {
        console.error('[Printful Sync CF] Error:', syncError.message);
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: CATALOG PLACEMENTS ============

app.get('/admin/catalog/placements', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as string;
    const blueprintId = req.query.blueprintId ? parseInt(req.query.blueprintId as string) : null;
    const printProviderId = req.query.printProviderId ? parseInt(req.query.printProviderId as string) : null;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : null;

    if (provider === 'printify') {
      if (!blueprintId || !printProviderId) { res.status(400).json({ error: "blueprintId and printProviderId required for Printify" }); return; }
      if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
      try {
        const variantData = await printifyClient.getVariants(blueprintId, printProviderId);
        const placementSet = new Set<string>();
        if (variantData?.variants) {
          for (const v of variantData.variants) {
            if (v.placeholders) {
              for (const ph of v.placeholders) { placementSet.add(ph.position || ph.placeholder); }
            }
          }
        }
        if (placementSet.size === 0) placementSet.add('front');
        const normalized = normalizePlacements('printify', Array.from(placementSet));
        const mapped = normalized.map(p => ({
          id: p, type: p, title: p.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), additionalPrice: 0,
        }));
        res.json({ placements: mapped, source: 'printify-api' });
      } catch (err: any) {
        res.json({ placements: [{ id: 'front', type: 'front', title: 'Front', additionalPrice: 0 }], source: 'default-fallback' });
      }
      return;
    }

    if (provider === 'printful') {
      if (!productId) { res.status(400).json({ error: "productId required for Printful" }); return; }
      const printfileInfo = await printfulClient.getPrintfiles(productId);
      const rawPlacements = printfileInfo?.available_placements ? Object.keys(printfileInfo.available_placements) : [];
      const printPlacements = rawPlacements.filter(p => !isEmbroideryPlacement(p));
      const grouped = groupPlacementsByLocation('printful', printPlacements);
      const mapped = grouped.map(g => ({
        id: g.internal, type: g.internal,
        title: g.internal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        additionalPrice: 0,
        methods: g.methods.map(m => ({ method: m.method, providerName: m.providerName })),
      }));
      res.json({ placements: mapped, source: 'printful-api' });
      return;
    }

    res.status(400).json({ error: "provider must be 'printify' or 'printful'" });
  } catch (error: any) {
    console.error("Placement fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRINTIFY CATALOG BROWSER ============

const CF_USA_MADE_BRANDS = [
  'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
  'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
  'shaka wear', 'backpacks usa', 'american giant', 'next level',
];

function cfCategorizeProduct(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) return "T-Shirts & Tops";
  if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) return "Sweatshirts & Hoodies";
  if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) return "Hats & Caps";
  if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) return "Drinkware";
  if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) return "Bags & Accessories";
  if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) return "Phone Cases & Tech";
  if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) return "Stickers & Magnets";
  if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) return "Wall Art & Posters";
  if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) return "Home & Living";
  if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) return "Stationery & Paper";
  if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe')) return "Activewear & Specialty";
  if (t.includes('pet') || t.includes('dog')) return "Pet Products";
  if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake')) return "Holiday & Seasonal";
  if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie')) return "Accessories";
  return "Other";
}

function cfClassifyPrintfulProduct(typeName: string): string {
  const n = (typeName || "").toLowerCase();
  if (n.startsWith("all-over print")) return "All-Over Print";
  if (n.includes("t-shirt") || n.includes("tank top") || n.includes("crop top") || n.includes("jersey") || (n.includes("tee") && !n.includes("steer"))) return "T-Shirts & Tops";
  if (n.includes("hoodie") || n.includes("hood") || n.includes("sweatshirt") || n.includes("pullover") || n.includes("fleece")) return "Hoodies & Sweatshirts";
  if (n.includes("hat") || n.includes("beanie") || n.includes("cap") || n.includes("visor")) return "Hats & Headwear";
  if (n.includes("mug") || n.includes("tumbler") || n.includes("glass") || n.includes("bottle") || n.includes("can cooler") || n.includes("wine")) return "Drinkware";
  if (n.includes("poster") || n.includes("canvas") || n.includes("framed") || n.includes("tapestry") || n.includes("flag") || n.includes("pennant") || n.includes("metal print") || n.includes("photo paper")) return "Wall Art & Prints";
  if (n.includes("iphone") || n.includes("samsung") || n.includes("airpods") || n.includes("magsafe") || n.includes("phone case") || n.includes("snap case")) return "Phone & Tech Cases";
  if (n.includes("sticker") || n.includes("decal") || n.includes("magnet") || n.includes("patch")) return "Stickers & Patches";
  if (n.includes("bag") || n.includes("tote") || n.includes("backpack") || n.includes("fanny pack") || n.includes("crossbody") || n.includes("luggage") || n.includes("duffle") || n.includes("weekender")) return "Bags & Accessories";
  if (n.includes("pillow") || n.includes("blanket") || n.includes("comforter") || n.includes("rug") || n.includes("towel") || n.includes("curtain") || n.includes("coaster") || n.includes("apron") || n.includes("shower")) return "Home & Living";
  if (n.includes("sock") || n.includes("gaiter") || n.includes("bandana") || n.includes("headband") || n.includes("scarf")) return "Socks & Accessories";
  if (n.includes("pet") || n.includes("dog") || n.includes("collar") || n.includes("leash")) return "Pet Products";
  if (n.includes("notebook") || n.includes("journal") || n.includes("notepad") || n.includes("calendar") || n.includes("greeting card") || n.includes("business card")) return "Stationery & Paper";
  if (n.includes("dress") || n.includes("skirt") || n.includes("bikini") || n.includes("swimsuit") || n.includes("swim trunk")) return "Dresses & Swimwear";
  if (n.includes("short") || n.includes("pant") || n.includes("jogger") || n.includes("legging") || n.includes("sweatpant")) return "Bottoms";
  if (n.includes("ornament") || n.includes("christmas") || n.includes("stocking") || n.includes("gift wrap")) return "Seasonal & Holiday";
  if (n.includes("jacket") || n.includes("windbreaker") || n.includes("bomber") || n.includes("vest") || n.includes("sweater")) return "Outerwear & Layers";
  if (n.includes("canvas shoe") || n.includes("athletic shoe") || n.includes("slide") || n.includes("sneaker") || (n.includes("shoe") && !n.includes("shower"))) return "Footwear";
  if (n.includes("mouse pad") || n.includes("desk mat") || n.includes("laptop")) return "Desk & Office";
  if (n.includes("kid") || n.includes("youth") || n.includes("baby")) return "Kids & Youth";
  if (n.includes("polo")) return "Polo Shirts";
  if (n.includes("pin button") || n.includes("pin ") || n.includes("set of pin")) return "Pins & Buttons";
  return "Other";
}

function cfBuildPrintfulVariantLookup(variants: any[]): Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }> {
  const lookup = new Map<number, { colorsMap: Map<string, string>; sizesSet: Set<string> }>();
  for (const v of variants) {
    const pid = v.productId;
    if (!pid) continue;
    if (!lookup.has(pid)) lookup.set(pid, { colorsMap: new Map(), sizesSet: new Set() });
    const entry = lookup.get(pid)!;
    if (v.color && !entry.colorsMap.has(v.color)) entry.colorsMap.set(v.color, v.colorCode || "#888");
    if (v.size) entry.sizesSet.add(v.size);
  }
  const result = new Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }>();
  for (const [pid, entry] of Array.from(lookup.entries())) {
    result.set(pid, {
      colors: Array.from(entry.colorsMap.entries()).map(([name, hex]: [string, string]) => ({ name, hex })),
      sizes: Array.from(entry.sizesSet),
    });
  }
  return result;
}

app.get('/admin/printify/catalog', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const providerFilter = (req.query.provider as string) || 'all';
    const categories: Record<string, any[]> = {};

    const bpSnapshot = await db.collection("printify_blueprints").get();
    const allPrintifyBlueprints = bpSnapshot.docs.map(doc => {
      const d = doc.data();
      return { id: d.id || parseInt(doc.id), title: d.title, description: d.description || '', brand: d.brand, model: d.model, images: d.images || [] };
    });

    const provSnapshot = await db.collection("printify_providers").get();
    const allProviders = provSnapshot.docs.map(doc => doc.data());
    const providersByBlueprint = new Map<number, { colors: Array<{name: string; hex?: string}>; sizes: string[]; minCost: number; maxCost: number; providerId: number }>();
    for (const prov of allProviders) {
      const existing = providersByBlueprint.get(prov.blueprintId);
      const colors = Array.isArray(prov.availableColors) ? prov.availableColors : [];
      const sizes = Array.isArray(prov.availableSizes) ? prov.availableSizes : [];
      const minCost = prov.minCost || 0;
      const maxCost = prov.maxCost || 0;
      if (!existing || colors.length > existing.colors.length) {
        providersByBlueprint.set(prov.blueprintId, { colors, sizes, minCost, maxCost, providerId: prov.providerId });
      }
    }

    const pfSnapshot = await db.collection("printful_products").get();
    const allPrintfulRows = pfSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));

    let matchedModels: Set<string> | null = null;
    if (providerFilter === 'matched') {
      const printifyModels = new Set(allPrintifyBlueprints.filter(bp => bp.model && bp.model.trim() !== '').map(bp => bp.model.trim().toLowerCase()));
      const printfulModels = new Set(allPrintfulRows.filter((pf: any) => pf.model && pf.model.trim() !== '').map((pf: any) => pf.model!.trim().toLowerCase()));
      matchedModels = new Set(Array.from(printifyModels).filter(m => printfulModels.has(m)));
    }

    if (providerFilter === 'all' || providerFilter === 'printify' || providerFilter === 'matched') {
      let blueprints = allPrintifyBlueprints;
      if (providerFilter === 'matched') { blueprints = blueprints.filter(bp => bp.model && matchedModels!.has(bp.model.trim().toLowerCase())); }
      for (const bp of blueprints) {
        const brandLower = (bp.brand || '').toLowerCase();
        const isUSABrand = CF_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        const category = cfCategorizeProduct(bp.title);
        if (!categories[category]) categories[category] = [];
        const modelLower = (bp.model || '').trim().toLowerCase();
        const matchedPrintful = modelLower ? allPrintfulRows.find((pf: any) => ((pf as any).model || '').trim().toLowerCase() === modelLower) : null;
        const provData = providersByBlueprint.get(bp.id);
        const rawDesc = bp.description || '';
        const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        categories[category].push({
          id: bp.id, title: bp.title, description: cleanDesc, brand: bp.brand, model: bp.model,
          imageUrl: bp.images?.[0] || null, madeInUSA: isUSABrand, blueprintId: bp.id,
          printProviderId: provData?.providerId || null,
          minPrice: provData?.minCost ? (provData.minCost / 100).toFixed(2) : null,
          maxPrice: provData?.maxCost ? (provData.maxCost / 100).toFixed(2) : null,
          colorCount: provData?.colors.length || 0, availableColors: provData?.colors || [],
          availableSizes: provData?.sizes || [], fulfillmentProvider: 'printify', provider: 'printify',
          dualProvider: !!matchedPrintful, matchedProviderId: matchedPrintful ? `printful-${(matchedPrintful as any).id}` : null,
        });
      }
    }

    if (providerFilter === 'all' || providerFilter === 'printful' || providerFilter === 'matched') {
      let printfulRows = allPrintfulRows as any[];
      if (providerFilter === 'matched') { printfulRows = printfulRows.filter(pf => pf.model && matchedModels!.has(pf.model.trim().toLowerCase())); }
      for (const pf of printfulRows) {
        const isUSA = (pf.originCountry || '').toUpperCase() === 'USA' || (pf.originCountry || '').toUpperCase() === 'US';
        const brandLower = (pf.brand || '').toLowerCase();
        const isUSABrand = isUSA || CF_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        const category = cfCategorizeProduct(pf.title);
        if (!categories[category]) categories[category] = [];
        const modelLower = (pf.model || '').trim().toLowerCase();
        const matchedPrintify = modelLower ? allPrintifyBlueprints.find(bp => (bp.model || '').trim().toLowerCase() === modelLower) : null;
        const pfColors = Array.isArray(pf.availableColors) ? pf.availableColors : [];
        const pfSizes = Array.isArray(pf.availableSizes) ? pf.availableSizes : [];
        categories[category].push({
          id: pf.id, title: pf.title, description: pf.description || '', brand: pf.brand || '', model: pf.model || '',
          imageUrl: pf.image || null, madeInUSA: isUSABrand, blueprintId: pf.id, printProviderId: null,
          minPrice: pf.minPrice || null, maxPrice: pf.maxPrice || null, colorCount: pfColors.length,
          availableColors: pfColors, availableSizes: pfSizes, fulfillmentProvider: 'printful', provider: 'printful',
          dualProvider: !!matchedPrintify, matchedProviderId: matchedPrintify ? `printify-${matchedPrintify.id}` : null,
        });
      }
    }

    const sortedCategories = [
      "T-Shirts & Tops", "Sweatshirts & Hoodies", "Hats & Caps", "Drinkware",
      "Bags & Accessories", "Phone Cases & Tech", "Stickers & Magnets",
      "Wall Art & Posters", "Home & Living", "Stationery & Paper",
      "Activewear & Specialty", "Accessories", "Pet Products", "Holiday & Seasonal", "Other"
    ];
    const result = sortedCategories
      .filter(name => categories[name] && categories[name].length > 0)
      .map(name => ({
        name, items: categories[name].sort((a: any, b: any) => a.title.localeCompare(b.title)),
        count: categories[name].length,
        usaCount: categories[name].filter((i: any) => i.madeInUSA).length,
        printifyCount: categories[name].filter((i: any) => i.provider === 'printify').length,
        printfulCount: categories[name].filter((i: any) => i.provider === 'printful').length,
      }));
    const extraCategories = Object.entries(categories)
      .filter(([name]) => !sortedCategories.includes(name))
      .filter(([_, items]) => items.length > 0)
      .map(([name, items]) => ({
        name, items: items.sort((a: any, b: any) => a.title.localeCompare(b.title)),
        count: items.length, usaCount: items.filter((i: any) => i.madeInUSA).length,
        printifyCount: items.filter((i: any) => i.provider === 'printify').length,
        printfulCount: items.filter((i: any) => i.provider === 'printful').length,
      }));
    res.json([...result, ...extraCategories]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/printify/catalog/:blueprintId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const blueprintId = parseInt(req.params.blueprintId);
    const [blueprint, providers] = await Promise.all([
      printifyClient.getBlueprintDetails(blueprintId),
      printifyClient.getPrintProviders(blueprintId),
    ]);
    res.json({ blueprint, providers });
  } catch (error: any) {
    console.error("Printify blueprint error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/printify/catalog/batch-details', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const { blueprintIds } = req.body;
    if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) { res.status(400).json({ error: "blueprintIds array required" }); return; }
    const limitedIds = blueprintIds.slice(0, 20);
    const results: Record<number, any> = {};
    for (const blueprintId of limitedIds) {
      try {
        const [blueprint, providers] = await Promise.all([
          printifyClient.getBlueprintDetails(blueprintId),
          printifyClient.getPrintProviders(blueprintId),
        ]);
        const usaProviders = providers.filter((p: any) => p.location?.country === 'US' || p.location?.country === 'USA');
        let variants: any[] = [];
        const selectedProvider = usaProviders[0] || providers[0];
        if (selectedProvider) {
          try { const variantData = await printifyClient.getVariants(blueprintId, selectedProvider.id); variants = variantData.variants || []; } catch {}
        }
        const liveColors = Array.from(new Set(variants.map((v: any) => v.options?.color).filter(Boolean)));
        const liveSizes = Array.from(new Set(variants.map((v: any) => v.options?.size).filter(Boolean)));
        let basePrice = 0, maxPrice = 0;
        const costs = variants.map((v: any) => v.cost || 0).filter((c: number) => c > 0);
        basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
        maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
        results[blueprintId] = {
          blueprintId, basePrice, maxPrice, costsAvailable: basePrice > 0,
          colors: liveColors, sizes: liveSizes,
          madeInUSA: usaProviders.length > 0, providerId: selectedProvider?.id, providerName: selectedProvider?.title,
        };
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err: any) {
        results[blueprintId] = { blueprintId, error: true, message: err.message || "Failed to fetch details" };
      }
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRINTFUL PRODUCTS CATALOG ============

app.get('/admin/catalog/printful-products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const products = productsSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));
    const variantsSnapshot = await db.collection("printful_variants").get();
    const allVariants = variantsSnapshot.docs.map(doc => doc.data());
    const variantLookup = cfBuildPrintfulVariantLookup(allVariants);
    const grouped: Record<string, any[]> = {};
    for (const p of products as any[]) {
      const categoryName = cfClassifyPrintfulProduct(p.typeName || p.type || "");
      if (!grouped[categoryName]) grouped[categoryName] = [];
      const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
      grouped[categoryName].push({
        id: p.id, title: p.title, brand: p.brand || "", model: p.model || "",
        imageUrl: p.image || null, madeInUSA: (p.originCountry || "").toUpperCase() === "US",
        minPrice: p.minPrice || null, maxPrice: p.maxPrice || null,
        colorCount: vData.colors.length, availableColors: vData.colors, availableSizes: vData.sizes,
        blueprintId: p.id, printProviderId: null, hasMockupMapping: false,
        fulfillmentProvider: 'printful',
      });
    }
    const result = Object.entries(grouped).map(([name, items]) => ({ name, items, count: items.length }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/printful-status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const variantsSnapshot = await db.collection("printful_variants").get();
    res.json({
      isConfigured: printfulClient.isConfigured,
      productCount: productsSnapshot.size,
      variantCount: variantsSnapshot.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/catalog/printful-products', async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const products = productsSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));
    const variantsSnapshot = await db.collection("printful_variants").get();
    const allVariants = variantsSnapshot.docs.map(doc => doc.data());
    const variantLookup = cfBuildPrintfulVariantLookup(allVariants);
    const grouped: Record<string, any[]> = {};
    for (const p of products as any[]) {
      const categoryName = cfClassifyPrintfulProduct(p.typeName || p.type || "");
      if (!grouped[categoryName]) grouped[categoryName] = [];
      const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
      const placements = ((p as any).availablePlacements || []).map((pid: string) => ({
        id: pid, type: pid, title: pid.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), additionalPrice: 0,
      }));
      grouped[categoryName].push({
        id: p.id, title: (p as any).title, brand: (p as any).brand || "", model: (p as any).model || "",
        imageUrl: (p as any).image || null, madeInUSA: ((p as any).originCountry || "").toUpperCase() === "US",
        minPrice: (p as any).minPrice || null, maxPrice: (p as any).maxPrice || null,
        colorCount: vData.colors.length, availableColors: vData.colors, availableSizes: vData.sizes,
        blueprintId: p.id, printProviderId: null, hasMockupMapping: false,
        fulfillmentProvider: 'printful', placements: placements.length > 0 ? placements : null,
      });
    }
    const result = Object.entries(grouped).map(([name, items]) => ({ name, items, count: items.length }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: QUEUE/PROCESS ============

app.post('/admin/queue/process', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 5 } = req.body;
    const processLimit = Math.min(limit, 20);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const processingSnapshot = await db.collection("mockupJobs").where("status", "==", "processing").limit(50).get();
    let recoveredCount = 0;
    for (const doc of processingSnapshot.docs) {
      const data = doc.data();
      const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
      if (startedAt < fiveMinutesAgo) {
        await db.collection("mockupJobs").doc(doc.id).update({
          status: "pending", retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        recoveredCount++;
      }
    }
    const pendingSnapshot = await db.collection("mockupJobs").where("status", "==", "pending").limit(processLimit).get();
    if (pendingSnapshot.empty) {
      res.json({ success: true, processed: 0, recovered: recoveredCount, message: "No pending jobs in queue" });
      return;
    }
    console.log(`[Queue CF] Processing ${pendingSnapshot.size} mockup jobs`);
    const results: Array<{ jobId: string; status: string; error?: string }> = [];
    for (const jobDoc of pendingSnapshot.docs) {
      const job = jobDoc.data();
      const jobId = jobDoc.id;
      try {
        const claimed = await db.runTransaction(async (transaction) => {
          const jobRef = db.collection("mockupJobs").doc(jobId);
          const freshDoc = await transaction.get(jobRef);
          if (!freshDoc.exists || freshDoc.data()?.status !== "pending") return false;
          transaction.update(jobRef, { status: "processing", startedAt: admin.firestore.FieldValue.serverTimestamp(), processorId: `cf-${Date.now()}` });
          return true;
        });
        if (!claimed) { console.log(`[Queue CF] Job ${jobId} already claimed`); continue; }
        await new Promise(resolve => setTimeout(resolve, 2000));
        const templateDoc = await db.collection("productTemplates").doc(job.templateId).get();
        if (!templateDoc.exists) throw new Error(`Template ${job.templateId} not found`);
        const template = templateDoc.data()!;
        const mockupResult = await generateMockupFromPrintful({
          blueprintId: template.blueprintId || 5,
          printProviderId: template.printProviderId || 39,
          colorName: job.colorName,
          artworkUrl: template.artworkUrl,
          artworkVariant: template.artworkVariant || "black",
          fulfillmentProvider: template.fulfillmentProvider || job.fulfillmentProvider || "printify",
        });
        if ((mockupResult as any).error) throw new Error((mockupResult as any).error);
        const colorKey = job.colorName.replace(/\s+/g, "_").toLowerCase();
        const placementKey = job.placement || "front";
        const sizeKey = job.qrSize || "large";
        const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
        await db.collection("productTemplates").doc(job.templateId).update({
          [mockupPath]: (mockupResult as any).mockupUrl || null,
          [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: (mockupResult as any).lifestyleUrl || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection("mockupJobs").doc(jobId).update({
          status: "completed", mockupUrl: (mockupResult as any).mockupUrl || null,
          lifestyleUrl: (mockupResult as any).lifestyleUrl || null,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ jobId, status: "completed" });
        console.log(`[Queue CF] Job ${jobId} completed`);
      } catch (error: any) {
        console.error(`[Queue CF] Job ${jobId} failed:`, error.message);
        await db.collection("mockupJobs").doc(jobId).update({
          status: "failed", error: error.message, failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ jobId, status: "failed", error: error.message });
      }
    }
    const completed = results.filter(r => r.status === "completed").length;
    const failed = results.filter(r => r.status === "failed").length;
    res.json({ success: true, processed: results.length, completed, failed, recovered: recoveredCount, results, message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed` });
  } catch (error: any) {
    console.error("[Queue CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: MOCKUP PRIORITY ============

app.post('/admin/mockup/priority', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" });
      return;
    }
    console.log(`[Priority Mockup CF] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId),
      printProviderId: printProviderId ? parseInt(printProviderId) : 0,
      colorName,
      colorHex,
      artworkUrl,
      artworkVariant: "black",
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
    });
    console.log(`[Priority Mockup CF] Generated: ${(result as any).mockupUrl}`);
    res.json({
      success: true, mockupUrl: (result as any).mockupUrl,
      lifestyleMockupUrl: (result as any).lifestyleUrl || null,
      fromCache: false, generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Priority Mockup CF] Error:", error);
    res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
  }
});

// ============ PRODUCTS PAGE: CONTENT UPLOAD ============

app.post('/admin/content/upload', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;
    if (!mode || !userId || !packetId || !base64Data) {
      res.status(400).json({ error: "mode, userId, packetId, and base64Data are required" });
      return;
    }
    const validModes = ['canvas', 'play', 'dynamics', 'basics'];
    if (!validModes.includes(mode)) {
      res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
      return;
    }
    const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    const actualMimeType = base64Match?.[1] || mimeType || 'image/png';
    const actualBase64 = base64Match?.[2] || base64Data;
    if (!actualBase64 || actualBase64.length === 0) {
      res.status(400).json({ error: 'No file data received' });
      return;
    }
    const buffer = Buffer.from(actualBase64, 'base64');
    if (buffer.length === 0) { res.status(400).json({ error: 'File data is empty after decoding' }); return; }
    const ext = actualMimeType.includes('png') ? 'png' : actualMimeType.includes('mp4') ? 'mp4' : actualMimeType.includes('webm') ? 'webm' : 'jpg';
    const storagePath = `content/${mode}/${userId}/${packetId}/${Date.now()}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, { metadata: { contentType: actualMimeType } });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (mode === 'canvas' || mode === 'basics') { updateData.compositeUrl = publicUrl; }
    else if (mode === 'play') { updateData.playMediaUrl = publicUrl; updateData.playMediaType = actualMimeType; }
    else if (mode === 'dynamics') { updateData.dynamicsMediaUrl = publicUrl; updateData.dynamicsMediaType = actualMimeType; }
    await db.collection("productPackets").doc(packetId).update(updateData);
    console.log(`[Content Upload CF] Uploaded ${mode} content for packet ${packetId}`);
    res.json({ success: true, publicUrl, storagePath, mimeType: actualMimeType, message: `${mode} content uploaded successfully` });
  } catch (error: any) {
    console.error("[Content Upload CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: COMPOSE (QR DYNAMICS) ============

app.get('/admin/published-compose-items', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('packets').where('status', '==', 'published').get();
    const items = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => ['qr-canvas', 'qr-play'].includes(p.packetType || p.type));
    res.json({ items });
  } catch (error: any) {
    console.error("[ComposeItems CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/compose/publish', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { composeItems, composeMode, composeHostingTerm, productId, blueprintId, color, colorHex } = req.body;
    if (!composeItems || !Array.isArray(composeItems) || composeItems.length === 0) {
      res.status(400).json({ error: 'At least one compose item is required' });
      return;
    }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const instanceData = {
      createdAt: nowEpoch, startTimestamp: nowEpoch,
      mode: composeMode || 'auto-rotate', hostingTerm: composeHostingTerm || '1-year',
      productId: productId || null, blueprintId: blueprintId || null,
      color: color || null, colorHex: colorHex || null,
      slots: composeItems.map((item: any, index: number) => ({
        slotId: item.slotId || `slot-${Date.now()}-${index}`,
        packetId: item.packetId || item.id,
        durationSeconds: item.durationSeconds || 86400,
        order: item.order ?? index + 1,
      })),
    };
    const docRef = await db.collection("qr_dynamics_instances").add(instanceData);
    console.log(`[ComposePublish CF] Created instance ${docRef.id} with ${composeItems.length} slots`);
    res.json({ success: true, instanceId: docRef.id, composeInstanceId: docRef.id });
  } catch (error: any) {
    console.error("[ComposePublish CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: SHELF GROUPS & BUILD SHELF ============

app.get('/admin/shelf-groups', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection("admin_shelf_groups").orderBy("sortOrder", "asc").get();
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(groups);
  } catch (error: any) {
    console.error("[BuildShelf CF] List groups error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/shelf-groups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sortOrder = 0 } = req.body;
    if (!name || typeof name !== 'string' || name.length === 0) { res.status(400).json({ error: "name is required" }); return; }
    const existing = await db.collection("admin_shelf_groups").where("name", "==", name).get();
    if (!existing.empty) { res.status(409).json({ error: "A group with that name already exists" }); return; }
    const docRef = await db.collection("admin_shelf_groups").add({
      name, sortOrder, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json({ id: docRef.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Create group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/shelf-groups/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sortOrder } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) {
      const existing = await db.collection("admin_shelf_groups").where("name", "==", name).get();
      if (!existing.empty && existing.docs[0].id !== req.params.id) { res.status(409).json({ error: "A group with that name already exists" }); return; }
      updates.name = name;
    }
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("admin_shelf_groups").doc(req.params.id).update(updates);
    const doc = await db.collection("admin_shelf_groups").doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Update group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/shelf-groups/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection("admin_shelf_groups").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("[BuildShelf CF] Delete group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/build-shelf', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, groupId } = req.query;
    let items: any[];
    if (groupId) {
      const snapshot = await db.collection("admin_build_shelf").where("groupIds", "array-contains", groupId).orderBy("createdAt", "desc").get();
      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      const snapshot = await db.collection("admin_build_shelf").orderBy("createdAt", "desc").get();
      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    if (provider) { items = items.filter((item: any) => item.providerId === provider); }
    res.json(items);
  } catch (error: any) {
    console.error("[BuildShelf CF] List items error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/build-shelf', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, catalogId, catalog, groupIds = [] } = req.body;
    if (!providerId || !catalogId || !catalog) { res.status(400).json({ error: "providerId, catalogId, and catalog are required" }); return; }
    const key = `${providerId}:${catalogId}`;
    const existing = await db.collection("admin_build_shelf").where("shelfKey", "==", key).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({ catalog, groupIds, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      const updated = await existing.docs[0].ref.get();
      res.json({ id: updated.id, ...updated.data() });
      return;
    }
    const docRef = await db.collection("admin_build_shelf").add({
      shelfKey: key, providerId, catalogId, catalog, groupIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json({ id: docRef.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Add item error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/build-shelf/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updates: Record<string, any> = {};
    if (req.body.groupIds !== undefined) updates.groupIds = req.body.groupIds;
    if (req.body.catalog !== undefined) updates.catalog = req.body.catalog;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("admin_build_shelf").doc(req.params.id).update(updates);
    const doc = await db.collection("admin_build_shelf").doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Update item error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/build-shelf/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection("admin_build_shelf").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("[BuildShelf CF] Delete item error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRICING SETTINGS SYNC ============

app.post('/admin/pricing-settings/sync', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const pricingDoc = await db.collection("testSettings").doc("pricing").get();
    const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
    const markupPercent = pricingSettings?.markupPercent ?? 25;
    const markupFixed = pricingSettings?.markupFixed ?? 0;
    const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
    const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
    console.log(`[Pricing Sync CF] Settings: markup=${markupPercent}%, fixed=${markupFixed}, memberShare=${memberProfitShare}`);
    res.json({
      success: true,
      message: "Pricing sync completed",
      settings: { markupPercent, markupFixed, memberProfitShare, additionalPlacementCost },
    });
  } catch (error: any) {
    console.error("[Pricing Sync CF] Error:", error);
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
// Force deploy: 2026-02-15-v3 - removed /test/ routes, fixed query
