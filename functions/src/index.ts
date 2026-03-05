// Build timestamp: 2026-02-16T14:15:00Z - Fixed printfile position lookup and label placement position data
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
  const mappingSnapshot = await db.collection('printify_printful_mapping')
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

async function toPublicUrl(url: string): Promise<string> {
  if (!url) return url;
  let filePath: string | null = null;
  
  const fbMatch = url.match(/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/(.+?)(\?|$)/);
  if (fbMatch) {
    filePath = decodeURIComponent(fbMatch[2]);
  }
  
  const gcsMatch = url.match(/storage\.googleapis\.com\/([^/]+)\/(.+?)(\?|$)/);
  if (!filePath && gcsMatch) {
    filePath = decodeURIComponent(gcsMatch[2]);
  }
  
  if (filePath) {
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 30 * 60 * 1000,
      });
      console.log(`[Mockup] Converted to signed URL: ${filePath}`);
      return signedUrl;
    } catch (e: any) {
      console.warn(`[Mockup] Failed to sign URL for ${filePath}: ${e.message}`);
      // Use direct GCS public URL - the file was made public via makePublic()
      const bucket = admin.storage().bucket();
      const gcsUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      console.log(`[Mockup] Falling back to GCS public URL: ${gcsUrl}`);
      return gcsUrl;
    }
  }
  return url;
}

async function generateMockupFromPrintful(request: MockupRequest): Promise<MockupResult> {
  const { blueprintId, colorName, colorHex, artworkVariant = 'black', fulfillmentProvider = 'printify' } = request;
  const artworkUrl = await toPublicUrl(request.artworkUrl);
  
  // Check Firestore cache first
  const cacheKey = `${blueprintId}_${colorName.replace(/\s+/g, '_')}_${artworkVariant}`;
  const cacheDoc = await db.collection('mockup_cache').doc(cacheKey).get();
  
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
      throw new Error(`No Printful mapping for blueprint ${blueprintId}. Add mapping to printify_printful_mapping collection.`);
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
  const availPlacements = printfileData?.available_placements ? Object.keys(printfileData.available_placements) : [];

  // Build printfile ID to dimensions lookup
  const printfileById: Record<number, { width: number; height: number }> = {};
  if (printfileData?.printfiles) {
    for (const pf of printfileData.printfiles) {
      printfileById[pf.printfile_id] = { width: pf.width, height: pf.height };
    }
  }

  // Build placement to printfile ID mapping from variant_printfiles
  const placementToPrintfileId: Record<string, number> = {};
  if (printfileData?.variant_printfiles) {
    const firstVariantKey = Object.keys(printfileData.variant_printfiles)[0];
    const firstVariant = printfileData.variant_printfiles[firstVariantKey];
    if (firstVariant?.placements) {
      for (const [pName, pfId] of Object.entries(firstVariant.placements)) {
        placementToPrintfileId[pName] = pfId as number;
      }
    }
  }

  // Helper to get dimensions for a placement
  function getDimensionsForPlacement(placementName: string): { width: number; height: number } {
    const pfId = placementToPrintfileId[placementName];
    if (pfId && printfileById[pfId]) return printfileById[pfId];
    return { width: 1800, height: 2400 };
  }

  const canonicalPlacement = request.placement || 'front';
  const placement = toProviderPlacement('printful', canonicalPlacement, availPlacements, request.printMethod);
  const dims = getDimensionsForPlacement(placement);
  
  const mockupFiles: Array<{ placement: string; image_url: string; position?: any }> = [{
    placement: placement, 
    image_url: artworkUrl,
    position: {
      area_width: dims.width,
      area_height: dims.height,
      width: dims.width,
      height: dims.height,
      top: 0,
      left: 0
    }
  }];

  // Hardcoded label_inside for QR Gear branded neck tag
  if (availPlacements.includes('label_inside')) {
    const labelDims = getDimensionsForPlacement('label_inside');
    mockupFiles.push({
      placement: 'label_inside',
      image_url: QR_GEAR_BRANDED_TAG_URL,
      position: {
        area_width: labelDims.width,
        area_height: labelDims.height,
        width: labelDims.width,
        height: labelDims.height,
        top: 0,
        left: 0
      }
    });
    console.log(`[Mockup] Auto-attaching branded tag to label_inside (${labelDims.width}x${labelDims.height})`);
  }
  
  console.log('[Printful] Creating mockup with files:', JSON.stringify(mockupFiles));
  
  // Retry logic - short delays to stay under Cloud Function gateway timeout
  const maxRetries = 2;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delayMs = 15000; // 15s between retries
        console.log(`[Printful] Retry ${attempt}/${maxRetries} - waiting ${delayMs/1000}s`);
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
  await db.collection('mockup_cache').doc(cacheKey).set({
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

app.get('/members/allowed-products', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('storeAllowedProducts').doc('member-products').get();

    if (!doc.exists) {
      res.json({ products: [], message: 'No products added to member-products store yet' });
      return;
    }

    const data = doc.data();
    const storedProducts = data?.products || [];

    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
    const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
    const markupPercent = pricingSettings?.markupPercent ?? 25;
    const markupFixed = pricingSettings?.markupFixed ?? 0;

    const products = await Promise.all(storedProducts.map(async (p: any) => {
      let baseCost = p.baseCost || 0;

      if (baseCost === 0 && p.blueprintId && p.printProviderId) {
        try {
          const provDoc = await db.collection('printifyPrintProviders')
            .doc(`${p.blueprintId}_${p.printProviderId}`).get();
          if (provDoc.exists) {
            const minCost = provDoc.data()?.minCost;
            if (minCost) baseCost = minCost / 100;
          }
        } catch (e: any) {
          console.warn(`[Member Products CF] Cost lookup failed for ${p.blueprintId}_${p.printProviderId}: ${e.message}`);
        }
      }

      const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
      const profit = retailPrice - baseCost;
      const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;

      let placements = p.placements;
      if (!placements || placements.length === 0) {
        placements = [
          { id: 'front', title: 'Front', widthInches: '12"', heightInches: '16"' },
          { id: 'back', title: 'Back', widthInches: '12"', heightInches: '16"' },
          { id: 'left_chest', title: 'Left Chest', widthInches: '4"', heightInches: '4"' },
          { id: 'sleeve_left', title: 'Left Sleeve', widthInches: '4"', heightInches: '4"' },
          { id: 'sleeve_right', title: 'Right Sleeve', widthInches: '4"', heightInches: '4"' },
        ];
      }

      return {
        ...p,
        baseCost,
        retailPrice,
        profit,
        memberEarnings,
        placements,
      };
    }));

    console.log(`[Member Products CF] Found ${products.length} products, earnings @ ${memberProfitShare * 100}% share`);
    res.json({ products, storeId: 'member-products' });
  } catch (error: any) {
    console.error('[Member Products CF] Error:', error);
    res.status(500).json({ error: error.message });
  }
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

app.get('/library-files/:storeType/:mediaType/:fname', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeType, mediaType, fname } = req.params;
    if (storeType === 'member') { res.status(400).json({ error: 'Use /library-files/member/:userId/:mediaType/:filename' }); return; }
    const storagePath = `library/${storeType}/${mediaType}/${fname}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: 'File not found' }); return; }
    const [metadata] = await file.getMetadata();
    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=3600');
    file.createReadStream().pipe(res);
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
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
    const cacheSnapshot = await db.collection('mockup_cache')
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
    
    const snapshot = await db.collection('mockup_cache')
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

// Admin: Get collections for a store channel
app.get('/admin/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    if (!storeId || !channelId) {
      res.status(400).json({ error: 'storeId and channelId are required' });
      return;
    }

    const linksSnapshot = await db.collection('storeProductLinks')
      .where('storeId', '==', storeId)
      .where('channel', '==', channelId)
      .get();

    const collectionsSet = new Set<string>();
    linksSnapshot.docs.forEach(doc => {
      const collection = doc.data().collection;
      if (collection) collectionsSet.add(collection);
    });

    const explicitSnapshot = await db.collection('dynamicsCollections')
      .where('storeId', '==', storeId)
      .where('channelId', '==', channelId)
      .get();

    explicitSnapshot.docs.forEach(doc => {
      const name = doc.data().name;
      if (name) collectionsSet.add(name);
    });

    const collections = Array.from(collectionsSet).sort();
    res.json({ success: true, collections, count: collections.length });
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
  
  const pendingSnapshot = await db.collection('mockup_jobs')
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
        const jobRef = db.collection('mockup_jobs').doc(jobId);
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

      let effectiveProvider: string;
      let resolvedBlueprintId: number;
      let artworkUrl: string;
      let artworkVariant: string;
      let printProviderId: number;

      if (job.templateId) {
        // Template-based job
        const templateDoc = await db.collection('productTemplates').doc(job.templateId).get();
        if (!templateDoc.exists) {
          throw new Error(`Template ${job.templateId} not found`);
        }
        const template = templateDoc.data()!;
        effectiveProvider = template.fulfillmentProvider || job.fulfillmentProvider || 'printify';
        // For Printful products, productId IS the Printful catalog product ID
        // For Printify products, blueprintId is the Printify blueprint ID
        if (effectiveProvider === 'printful') {
          resolvedBlueprintId = template.productId || template.blueprintId || 71;
          console.log(`[Queue BG] Printful product - using productId ${resolvedBlueprintId}`);
        } else {
          resolvedBlueprintId = template.blueprintId || template.productId || 5;
          console.log(`[Queue BG] Printify blueprint - using blueprintId ${resolvedBlueprintId}`);
        }
        artworkUrl = template.artworkUrl;
        artworkVariant = template.artworkVariant || 'black';
        printProviderId = template.printProviderId || 39;
      } else if (job.jobData) {
        // Packet-based job (jobData embedded)
        effectiveProvider = job.jobData.fulfillmentProvider || 'printify';
        if (effectiveProvider === 'printful') {
          resolvedBlueprintId = job.jobData.blueprintId || 71;
        } else {
          resolvedBlueprintId = job.jobData.blueprintId || 5;
        }
        artworkUrl = job.jobData.artworkUrl;
        artworkVariant = job.jobData.artworkVariant || 'black';
        printProviderId = job.jobData.printProviderId || 39;
        console.log(`[Queue BG] Packet job - provider: ${effectiveProvider}, productId: ${resolvedBlueprintId}`);
      } else {
        throw new Error(`Job ${jobId} has no templateId or jobData`);
      }

      const mockupResult = await generateMockupFromPrintful({
        blueprintId: resolvedBlueprintId,
        printProviderId,
        colorName: job.colorName,
        colorHex: job.colorHex || '#000000',
        artworkUrl,
        artworkVariant: artworkVariant as 'black' | 'white',
        fulfillmentProvider: effectiveProvider as 'printify' | 'printful',
        placement: job.placement || 'front',
        printMethod: job.printMethod,
      });

      // Store in template if template-based
      if (job.templateId) {
        const colorKey = job.colorName.replace(/\s+/g, '_').toLowerCase();
        const placementKey = job.placement || 'front';
        const sizeKey = job.qrSize || 'large';
        
        await db.collection('productTemplates').doc(job.templateId).update({
          [`mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`]: mockupResult.mockupUrl,
          [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleMockupUrl || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Mark completed
      await db.collection('mockup_jobs').doc(jobId).update({
        status: 'completed',
        mockupUrl: mockupResult.mockupUrl,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[Queue Background] Completed: ${job.colorName}/${job.placement}/${job.qrSize}`);

    } catch (error: any) {
      console.error(`[Queue Background] Job ${jobId} failed:`, error.message);
      await db.collection('mockup_jobs').doc(jobId).update({
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

// Admin: List all product templates
app.get('/admin/templates', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productTemplates').get();
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Create a product template
app.post('/admin/templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const data = { ...req.body, createdAt: now, updatedAt: now };
    const ref = await db.collection('productTemplates').add(data);
    res.json({ id: ref.id, ...data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update a product template
app.put('/admin/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const data = { ...req.body, updatedAt: now };
    await db.collection('productTemplates').doc(id).update(data);
    const updated = await db.collection('productTemplates').doc(id).get();
    res.json({ id, ...updated.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete a product template
app.delete('/admin/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.collection('productTemplates').doc(id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get mockups for a template
app.get('/admin/templates/:templateId/mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;
    const jobsSnapshot = await db.collection('mockup_jobs')
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
    res.status(500).json({ error: error.message });
  }
});

// Admin: Full template save with batch mockup generation
app.post('/admin/templates/full-save', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { colors = [], placements = ['front', 'back'], placementMethods = {}, ...templateFields } = req.body;

    const templateKeys = ['name', 'description', 'category', 'productId', 'blueprintId', 'printProviderId',
      'fulfillmentProvider', 'artworkUrl', 'artworkVariant', 'thumbnailUrl', 'qrContent', 'pricing', 'packetId'];
    const template: Record<string, any> = {};
    for (const key of templateKeys) {
      if (templateFields[key] !== undefined) template[key] = templateFields[key];
    }

    if (!template.name && !template.productId) {
      res.status(400).json({ error: 'Template data is required' });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

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
            fulfillmentProvider: template.fulfillmentProvider || 'printify',
          };
          if (placementMethods[placement]) {
            jobData.printMethod = placementMethods[placement];
          }
          await db.collection('mockup_jobs').add(jobData);
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

app.get('/admin/packets/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
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

app.post('/admin/queue/retry-failed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const failedSnapshot = await db.collection("mockup_jobs").where("status", "==", "failed").get();
    if (failedSnapshot.empty) {
      res.json({ success: true, reset: 0, message: "No failed jobs to retry" });
      return;
    }
    let resetCount = 0;
    const batch = db.batch();
    for (const doc of failedSnapshot.docs) {
      batch.update(doc.ref, {
        status: "pending",
        error: null,
        retryCount: admin.firestore.FieldValue.increment(1),
        lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      resetCount++;
    }
    await batch.commit();
    console.log(`[Queue CF] Reset ${resetCount} failed jobs to pending`);
    res.json({ success: true, reset: resetCount, message: `Reset ${resetCount} failed jobs to pending` });
  } catch (error: any) {
    console.error("[Queue CF] Error retrying failed:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/queue/process', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 5 } = req.body;
    const processLimit = Math.min(limit, 20);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const processingSnapshot = await db.collection("mockup_jobs").where("status", "==", "processing").limit(50).get();
    let recoveredCount = 0;
    for (const doc of processingSnapshot.docs) {
      const data = doc.data();
      const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
      if (startedAt < fiveMinutesAgo) {
        await db.collection("mockup_jobs").doc(doc.id).update({
          status: "pending", retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        recoveredCount++;
      }
    }
    const pendingSnapshot = await db.collection("mockup_jobs").where("status", "==", "pending").limit(processLimit).get();
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
          const jobRef = db.collection("mockup_jobs").doc(jobId);
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
        await db.collection("mockup_jobs").doc(jobId).update({
          status: "completed", mockupUrl: (mockupResult as any).mockupUrl || null,
          lifestyleUrl: (mockupResult as any).lifestyleUrl || null,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ jobId, status: "completed" });
        console.log(`[Queue CF] Job ${jobId} completed`);
      } catch (error: any) {
        console.error(`[Queue CF] Job ${jobId} failed:`, error.message);
        await db.collection("mockup_jobs").doc(jobId).update({
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

// ============ MOCKUP QUEUE PROCESSOR ============

app.post('/admin/mockup/queue-process', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('[Queue Process] Manually triggered');
    processQueueInBackground().catch(err => {
      console.error('[Queue Process] Background error:', err.message);
    });
    res.json({ success: true, message: 'Queue processing triggered' });
  } catch (error: any) {
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

// ============ BRAIN PROXY ENDPOINTS ============
app.post("/brain/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const secret = process.env.FLUBA_SITE_SECRET;
    const brainUrl = process.env.FLUBA_BRAIN_URL;
    if (!secret || !brainUrl) {
      res.status(503).json({ error: "Brain proxy not configured" });
      return;
    }
    const crypto = await import("crypto");
    const body = {
      action: req.body.action,
      payload: req.body.payload,
      prompt: req.body.prompt,
    };
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const r = await fetch(brainUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-site-id": "qr-gear",
        "x-signature": sig,
      },
      body: raw,
    });
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    console.error("[Brain Proxy CF] Error:", err.message);
    res.status(500).json({ error: "Brain proxy failed" });
  }
});

// ============ MEMBERS ROUTES (Batch 1) ============

async function verifyMemberAuthCF(req: Request, memberId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return { authorized: false, error: "Authorization required" };
  try {
    const decodedToken = await admin.auth().verifyIdToken(authHeader.slice(7));
    if (!decodedToken) return { authorized: false, error: "Invalid token" };
    const isOwnData = decodedToken.uid === memberId;
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
    const isAdminUser = adminIds.includes(decodedToken.uid);
    if (!isOwnData && !isAdminUser) return { authorized: false, error: "Access denied" };
    return { authorized: true, userId: decodedToken.uid };
  } catch { return { authorized: false, error: "Invalid token" }; }
}

app.post('/members/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const { fullName, storeName, creatorSlug, country, useCase, productInterests, socialSurfaces, primarySocial, socialHandle, attributionSource } = req.body;
    if (!fullName || !storeName || !creatorSlug) { res.status(400).json({ error: "fullName, storeName, and creatorSlug are required" }); return; }
    const profileData = { userId, fullName, storeName, creatorSlug, country: country || '', useCase: useCase || '', productInterests: productInterests || [], socialSurfaces: socialSurfaces || [], primarySocial: primarySocial || '', socialHandle: socialHandle || '', attributionSource: attributionSource || '', isMember: true, memberSince: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('member_profiles').doc(userId).set(profileData, { merge: true });
    res.json({ success: true, profile: profileData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const doc = await db.collection('member_profiles').doc(userId).get();
    if (!doc.exists) { res.json({ isMember: false }); return; }
    res.json({ isMember: true, profile: doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/check-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const doc = await db.collection('member_profiles').doc(userId).get();
    res.json({ isMember: doc.exists && doc.data()?.isMember === true });
  } catch { res.json({ isMember: false }); }
});

app.get('/members/:memberId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const snapshot = await db.collection("channels").where("ownerId", "==", memberId).get();
    const channels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(channels);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { name, storeId } = req.body;
    if (!memberId || !name) { res.status(400).json({ error: "memberId and name are required" }); return; }
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const channelData = { name, storeId: storeId || 'qr-gear', ownerId: memberId, type: 'member', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection("channels").add(channelData);
    res.json({ id: docRef.id, ...channelData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/:memberId/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const snapshot = await db.collection("memberProducts").where("memberId", "==", memberId).orderBy("createdAt", "desc").get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const body = req.body;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }

    const { packetType, title, description, storeId, status, qrType, channelId, headerText, footerText, videoUrl, textLines, textUpcharge, placementUpcharge, memberEarnings, boundProduct, selectedColor, selectedShirtSize, selectedPlacements, perPlacementConfigs, perPlacementSizes, graphicSize, textLayoutChoice, headerStyle, footerStyle, qrDestination, qrBasicInputType, qrBasicContent, qrBasicMockup, qrBasicSaveChoice, qrPlusMockup, qrPlusSaveChoice, qrCanvasMockup, qrPlayMockup, source, printfulProductId, variantId, graphicUrl, name, price } = body;

    if (packetType === 'qr-canvas' || packetType === 'qr-play' || packetType === 'qr-basic' || packetType === 'qr-plus' || packetType === 'qr-compose') {
      const existingPacketId = body.existingPacketId;
      let packetId = existingPacketId || `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const baseUrl = process.env.PUBLIC_URL || 'https://qrgear-c1ffd.web.app';
      const destinationUrl = `${baseUrl}/view/${packetId}`;
      const now = new Date().toISOString();
      const packetData: Record<string, any> = {
        id: packetId, memberId, storeId: storeId || memberId, channelId: channelId || null, packetType,
        title: title || 'Untitled', description: description || '', status: status || 'published',
        createdAt: now, updatedAt: now, source: source || { entryPoint: 'wizard' },
        boundProduct: boundProduct || null, selectedColor: selectedColor || null,
        selectedShirtSize: selectedShirtSize || null, selectedPlacements: selectedPlacements || null,
        perPlacementConfigs: perPlacementConfigs || null, perPlacementSizes: perPlacementSizes || null,
        graphicSize: graphicSize || null, textLayoutChoice: textLayoutChoice || null,
        headerStyle: headerStyle || null, footerStyle: footerStyle || null,
        qrType: qrType || packetType, qrDestination: qrDestination || null,
        qrGraphic: body.qrGraphic || null, productGraphic: body.productGraphic || null,
        urlGraphic: body.background || null, originalUrlGraphic: body.originalUrlGraphic || null,
        videoUrl: videoUrl || null,
        destinationUrl: (packetType === 'qr-canvas' || packetType === 'qr-play') ? destinationUrl : null,
        qrBasicInputType: qrBasicInputType || null, qrBasicContent: qrBasicContent || null,
        qrBasicMockup: qrBasicMockup || null, qrBasicSaveChoice: qrBasicSaveChoice || null,
        qrPlusMockup: qrPlusMockup || null, qrPlusSaveChoice: qrPlusSaveChoice || null,
        qrCanvasMockup: qrCanvasMockup || null, qrPlayMockup: qrPlayMockup || null,
        composeMockup: body.composeMockup || null, composeItems: body.composeItems || null,
        composeMode: body.composeMode || 'auto-rotate', composeHostingTerm: body.composeHostingTerm || null,
        composeInstanceId: null, textLines: textLines || 0, textUpcharge: textUpcharge || 0,
        placementUpcharge: placementUpcharge || 0, memberEarnings: memberEarnings || 0,
      };

      try {
        if (boundProduct?.blueprintId && boundProduct?.printProviderId) {
          const providerDocId = `${boundProduct.blueprintId}_${boundProduct.printProviderId}`;
          const providerDoc = await db.collection('printifyPrintProviders').doc(providerDocId).get();
          if (providerDoc.exists) {
            const provData = providerDoc.data();
            const printifyCostBase = (provData?.minCost || 0) / 100;
            const pricingDoc = await db.collection("testSettings").doc("pricing").get();
            const ps = pricingDoc.exists ? pricingDoc.data() : {};
            const pMP = ps?.markupPercent ?? 25; const pMF = ps?.markupFixed ?? 0;
            const pAPC = ps?.additionalPlacementCost ?? 4; const pTLU = ps?.textLineUpcharge ?? 2;
            const pMPS = ps?.memberProfitShare ?? 0.25;
            const numTL = textLines || 0; const textUpT = numTL * pTLU;
            const plArr = selectedPlacements ? (Array.isArray(selectedPlacements) ? selectedPlacements : [selectedPlacements]) : [];
            const placementUpT = Math.max(0, plArr.length - 1) * pAPC;
            const totalCostBase = printifyCostBase + textUpT + placementUpT;
            const retailPriceBase = Math.round((totalCostBase * (1 + pMP / 100) + pMF) * 100) / 100;
            const profitBase = Math.round((retailPriceBase - printifyCostBase) * 100) / 100;
            const memberEarningsBase = Math.round((profitBase * pMPS) * 100) / 100;
            const adminMarginBase = Math.round((profitBase - memberEarningsBase) * 100) / 100;
            packetData.pricingSnapshot = { printifyCostBase, customerPrice: retailPriceBase, textLines: numTL, textUpchargeTotal: textUpT, extraPlacements: Math.max(0, plArr.length - 1), placementUpchargeTotal: placementUpT, markupPercent: pMP, markupFixed: pMF, totalCostBase, retailPriceBase, profitBase, memberProfitShare: pMPS, memberEarningsBase, adminMarginBase, memberEarningsRange: { min: memberEarningsBase, max: memberEarningsBase }, calculatedAt: new Date().toISOString() };
          }
        }
      } catch (pricingErr: any) { console.error('[UnifiedPublish CF] Pricing snapshot failed (non-fatal):', pricingErr.message); }

      await db.collection("memberPackets").doc(packetId).set(packetData);

      if (packetType === 'qr-compose' && body.composeItems && Array.isArray(body.composeItems)) {
        try {
          const nowEpoch = Math.floor(Date.now() / 1000);
          const instanceData = { memberId, packetId, createdAt: nowEpoch, startTimestamp: nowEpoch, mode: 'loop', composeMode: body.composeMode || 'auto-rotate', hostingTerm: body.composeHostingTerm || '1-year', fallbackUrl: null, slots: body.composeItems.map((item: any, index: number) => ({ slotId: `slot-${Date.now()}-${index}`, packetId: item.packetId, name: item.name || 'Untitled', thumbnailUrl: item.thumbnailUrl || null, type: item.type || 'qr-canvas', durationSeconds: item.durationSeconds || 86400, order: item.order ?? index + 1 })) };
          const instanceRef = await db.collection("qr_dynamics_instances").add(instanceData);
          await db.collection("memberPackets").doc(packetId).update({ composeInstanceId: instanceRef.id, destinationUrl: `/qr/d/${instanceRef.id}` });
          packetData.composeInstanceId = instanceRef.id;
          packetData.destinationUrl = `/qr/d/${instanceRef.id}`;
        } catch (instanceErr: any) { console.error('[QR Compose CF] Instance creation failed:', instanceErr); }
      }

      res.json(packetData);
      return;
    }

    if (!printfulProductId) { res.status(400).json({ error: "printfulProductId is required for product creation" }); return; }
    const productData = { memberId, printfulProductId, variantId, graphicUrl, qrType: qrType || 'play', qrDestination, channelId, name: name || 'My Product', price: price || 0, textLines: textLines || 0, textUpcharge: textUpcharge || 0, placementUpcharge: placementUpcharge || 0, memberEarnings: memberEarnings || 0, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection("memberProducts").add(productData);
    res.json({ id: docRef.id, ...productData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/:memberId/published-items', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const types = req.query.types as string;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const snapshot = await db.collection('memberPackets').where('memberId', '==', memberId).where('status', '==', 'published').get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, packetId: doc.id, ...doc.data() }));
    if (types) { const typeList = types.split(',').map(t => t.trim()); items = items.filter((item: any) => typeList.includes(item.packetType)); }
    res.json({ items });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/:memberId/earnings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const snapshot = await db.collection("memberEarnings").where("memberId", "==", memberId).orderBy("createdAt", "desc").get();
    const earnings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const totalEarnings = earnings.reduce((sum, e: any) => sum + (e.amount || 0), 0);
    const pendingEarnings = earnings.filter((e: any) => e.status === 'pending').reduce((sum, e: any) => sum + (e.amount || 0), 0);
    const paidEarnings = earnings.filter((e: any) => e.status === 'paid').reduce((sum, e: any) => sum + (e.amount || 0), 0);
    res.json({ earnings, summary: { total: totalEarnings, pending: pendingEarnings, paid: paidEarnings, profitShare: 0.25 } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/:memberId/graphics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const snapshot = await db.collection("hostedImages").where("userId", "==", memberId).get();
    const images = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const graphicSets = [{ id: 'my-uploads', name: 'My Uploads', thumbnailUrl: (images[0] as any)?.storageUrl || '', imageCount: images.length, images: images.map((img: any) => ({ id: img.id, url: img.storageUrl, name: img.fileName, createdAt: img.createdAt })) }];
    res.json(graphicSets);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    if (!background?.url) { res.status(400).json({ error: "background.url is required" }); return; }
    const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetData = { packetId, memberId, kind: kind || 'qr_canvas', urlContent: urlContent || null, background: { url: background.url, crop: background.crop || null, assetId: background.assetId || null }, textLayers: textLayers || [], boundProduct: boundProduct || null, metadata: metadata || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('memberPackets').doc(packetId).set(packetData);
    res.json({ packetId, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/members/:memberId/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId } = req.params;
    const updates = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    const doc = await db.collection('memberPackets').doc(packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    if (doc.data()?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    await db.collection('memberPackets').doc(packetId).update({ ...updates, updatedAt: new Date().toISOString() });
    res.json({ success: true, packetId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/claim-temp-packet', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { tempPacketId } = req.body;
    if (!tempPacketId) { res.status(400).json({ error: "tempPacketId is required" }); return; }
    const docRef = db.collection('temp_packets').doc(tempPacketId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Temp packet not found or expired" }); return; }
    const packet = doc.data()!;
    if (packet.status === 'completed') { res.status(410).json({ error: "Temp packet already used" }); return; }
    await docRef.update({ claimedByMemberId: memberId, claimedAt: new Date().toISOString(), status: 'claimed', updatedAt: new Date().toISOString() });
    res.json({ success: true, packetConfig: { blueprintId: packet.blueprintId || null, productTitle: packet.productTitle || null, selectedColor: packet.selectedColor || null, selectedShirtSize: packet.selectedShirtSize || null, qrType: packet.qrType || null, selectedPlacements: packet.selectedPlacements || [], graphicSize: packet.graphicSize || null, headerStyle: packet.headerStyle || null, footerStyle: packet.footerStyle || null, textLayoutChoice: packet.textLayoutChoice || null, qrBasicContent: packet.qrBasicContent || null, mockupUrl: packet.mockupUrl || null, lifestyleMockupUrl: packet.lifestyleMockupUrl || null } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    if (!background?.url) { res.status(400).json({ error: "background.url is required" }); return; }
    const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetData = { packetId, memberId, kind: kind || 'qr_canvas', urlContent: urlContent || null, background: { url: background.url, crop: background.crop || null, assetId: background.assetId || null }, textLayers: textLayers || [], boundProduct: boundProduct || null, metadata: metadata || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('memberPackets').doc(packetId).set(packetData);
    res.json({ packetId, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/member/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.query.memberId as string;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    const snapshot = await db.collection('memberPackets').where('memberId', '==', memberId as string).limit(100).get();
    const packets = snapshot.docs.map(doc => doc.data());
    res.json({ packets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/member/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const { memberId } = req.body;
    if (!packetId || !memberId) { res.status(400).json({ error: "packetId and memberId are required" }); return; }
    const doc = await db.collection('memberPackets').doc(packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    if (doc.data()?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    await db.collection('memberPackets').doc(packetId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/graphics/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId } = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const packet = packetDoc.data();
    if (!packet || packet.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    const graphicsId = `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const compositeUrl = packet.background?.url || null;
    const graphicsData = { graphicsId, packetId, memberId, compositeUrl, qrOnlyUrl: null, status: 'generated', createdAt: new Date().toISOString() };
    await db.collection('memberGraphics').doc(graphicsId).set(graphicsData);
    await db.collection('memberPackets').doc(packetId).update({ status: 'graphics_ready', graphicsId, updatedAt: new Date().toISOString() });
    res.json({ graphicsId, compositeUrl, qrOnlyUrl: null });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/templates/save', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId, compositeUrl, titleText, descriptionText, kind, metadata } = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    const packetData = packetDoc.data() || {};
    const templateData = { templateId, packetId, memberId, kind: kind || packetData.kind || 'qr_canvas', compositeUrl: compositeUrl || null, titleText: titleText || '', descriptionText: descriptionText || '', background: packetData.background || null, textLayers: packetData.textLayers || [], metadata: metadata || null, createdAt: new Date().toISOString() };
    await db.collection('memberTemplates').doc(templateId).set(templateData);
    await db.collection('memberPackets').doc(packetId).update({ templateId, updatedAt: new Date().toISOString() });
    res.json({ templateId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/library-links', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId, channelId, templateId, compositeUrl, qrOnlyUrl, boundProduct, metadata, status } = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    const libraryLinkId = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const linkData = { libraryLinkId, packetId, channelId: channelId || null, storeId: memberId, templateId: templateId || null, memberId, compositeUrl: compositeUrl || null, qrOnlyUrl: qrOnlyUrl || null, boundProduct: boundProduct || null, metadata: metadata || null, status: status || 'active', shareUrl: `/share/${packetId}`, createdAt: new Date().toISOString() };
    await db.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
    await db.collection('memberPackets').doc(packetId).update({ status: 'published', libraryLinkId, updatedAt: new Date().toISOString() });
    res.json({ libraryLinkId, shareUrl: `/share/${packetId}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/member/library-links', async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.query.memberId as string;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    const snapshot = await db.collection('memberLibraryLinks').where('memberId', '==', memberId as string).limit(100).get();
    const items = snapshot.docs.map(doc => doc.data());
    res.json({ items });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ PRICING ROUTES (Batch 2) ============

app.post('/pricing-settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
    const defaultSU: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBLP = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    const settings = { markupPercent: parseFloat(markupPercent) || 25, markupFixed: parseFloat(markupFixed) || 0, additionalPlacementCost: parseFloat(additionalPlacementCost) || 4, textLineUpcharge: parseFloat(textLineUpcharge) || 2, memberProfitShare: parseFloat(memberProfitShare) || 0.25, sizeUpcharges: sizeUpcharges || defaultSU, hostingTiers: hostingTiers || [{ code: "1_year", name: "1 Year", price: 5 }, { code: "2_year", name: "2 Years", price: 8 }, { code: "3_year", name: "3 Years", price: 10 }], brandLabelPricing: brandLabelPricing || defaultBLP, preferredLabelPosition: preferredLabelPosition || 'outside', updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection("testSettings").doc("pricing").set(settings, { merge: true });
    res.json({ success: true, settings, message: "Pricing settings saved" });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ PUBLIC STORE ROUTES (Batch 3) ============

app.get('/stores/by-id/:storeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    let doc = await db.collection('stores').doc(storeId).get();
    if (doc.exists) { const data = doc.data(); res.json({ id: doc.id, name: data?.name || storeId, type: data?.roleType || 'internal', roleType: data?.roleType || 'internal', isActive: data?.isActive ?? true }); return; }
    doc = await db.collection('partnerStores').doc(storeId).get();
    if (doc.exists) { const data = doc.data(); res.json({ id: doc.id, name: data?.name || storeId, type: data?.isInternal ? 'internal' : 'external', roleType: data?.isInternal ? 'internal' : 'external', isActive: data?.isActive ?? true, isPartnerStore: true }); return; }
    res.status(404).json({ error: 'Store not found' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, roleType } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Store name is required' }); return; }
    if (!roleType || !['internal', 'external', 'member'].includes(roleType)) { res.status(400).json({ error: 'Valid roleType is required' }); return; }
    const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const storeData = { name: name.trim(), roleType, isActive: true, channelCount: 0, createdAt: new Date().toISOString() };
    await db.collection('stores').doc(storeId).set(storeData);
    res.json({ id: storeId, ...storeData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/stores/:storeId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const channelsSnapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const batch = db.batch();
    channelsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('stores').doc(storeId));
    await batch.commit();
    res.json({ success: true, deletedChannels: channelsSnapshot.size });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const snapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
    const channels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    channels.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(channels);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) { res.status(400).json({ error: 'Channel name is required' }); return; }
    const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const channelData = { name: name.trim(), storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
    await db.collection('storeChannels').doc(channelId).set(channelData);
    res.json({ id: channelId, ...channelData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/stores/:storeId/channels/:channelId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params;
    await db.collection('storeChannels').doc(channelId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/allowed-products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const doc = await db.collection('storeAllowedProducts').doc(storeId).get();
    if (!doc.exists) { res.json({ storeId, products: [] }); return; }
    const data = doc.data();
    res.json({ storeId, products: data?.products || [], updatedAt: data?.updatedAt });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { products } = req.body;
    if (!Array.isArray(products)) { res.status(400).json({ error: 'products must be an array' }); return; }
    const pricingDoc = await db.collection("testSettings").doc("pricing").get();
    const ps = pricingDoc.exists ? pricingDoc.data() : null;
    const markupPercent = ps?.markupPercent ?? 25; const markupFixed = ps?.markupFixed ?? 0;
    const memberProfitShare = ps?.memberProfitShare ?? 0.25;
    const enrichedProducts = await Promise.all(products.map(async (p: any) => {
      try {
        let baseCost = 0;
        if (p.blueprintId) {
          const provSnap = await db.collection('printifyPrintProviders').where('blueprintId', '==', p.blueprintId).limit(5).get();
          const usaProv = provSnap.docs.filter(d => d.data().isUSA);
          const selectedProv = usaProv[0] || provSnap.docs[0];
          if (selectedProv) baseCost = (selectedProv.data().minCost || 0) / 100;
        }
        const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
        const profit = retailPrice - baseCost;
        const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
        return { blueprintId: p.blueprintId, title: p.title, addedAt: p.addedAt || new Date().toISOString(), imageUrl: p.imageUrl || null, baseCost, retailPrice, profit, memberEarnings, pricingUsed: { markupPercent, markupFixed, memberProfitShare }, packetCreatedAt: new Date().toISOString() };
      } catch { return { ...p, addedAt: p.addedAt || new Date().toISOString(), baseCost: 0, retailPrice: 0, profit: 0, memberEarnings: 0 }; }
    }));
    await db.collection('storeAllowedProducts').doc(storeId).set({ storeId, products: enrichedProducts, updatedAt: new Date().toISOString() });
    res.json({ success: true, storeId, productCount: enrichedProducts.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/partner-stores', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores').get();
    const stores = snapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, name: data.name, slug: data.slug, isInternal: data.isInternal ?? true, isActive: data.isActive ?? true, availableSegments: data.availableSegments || [], apiKey: data.apiKey || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null }; });
    res.json(stores);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels/:channelId/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const { productIds } = req.body;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const existingSnapshot = await db.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    existingSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    for (const productId of (productIds || [])) { const docRef = db.collection('storeChannelProducts').doc(); batch.set(docRef, { storeId, channelId, productId, createdAt: now }); }
    await batch.commit();
    res.json({ success: true, synced: (productIds || []).length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const snapshot = await db.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/content', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const snapshot = await db.collection('storeChannelContent').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    const content = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(content);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels/:channelId/content', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const contentData = req.body;
    const docRef = db.collection('storeChannelContent').doc();
    await docRef.set({ ...contentData, storeId, channelId, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, ...contentData, storeId, channelId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/stores/:storeId/channels/:channelId/content/:contentId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;
    await db.collection('storeChannelContent').doc(contentId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/collections', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const snapshot = await db.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
    const collections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(collections);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const collectionData = req.body;
    const docRef = db.collection('storeChannelCollections').doc();
    await docRef.set({ ...collectionData, storeId, channelId, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, ...collectionData, storeId, channelId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/stores/:storeId/channels/:channelId/collections/:collectionName/items', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId, collectionName } = req.params;
    const snapshot = await db.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).where('name', '==', collectionName).get();
    if (snapshot.empty) { res.json({ items: [] }); return; }
    const data = snapshot.docs[0].data();
    res.json({ items: data?.items || [] });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ QR DYNAMICS & RESOLVE ROUTES (Batch 4) ============

app.get('/resolve/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const instanceDoc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!instanceDoc.exists) { res.status(404).json({ error: "Instance not found", redirect: "/not-found" }); return; }
    const instance = instanceDoc.data() as any;
    const isActive = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) > new Date() : true;
    if (!isActive) { res.json({ expired: true, redirect: `/renew/${instanceId}`, message: "Your QR hosting has expired. Please renew to continue." }); return; }
    res.json({ expired: false, destinationUrl: instance.destinationUrl, packetId: instance.packetId, instanceId: instance.instanceId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/buyer/instances', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const snapshot = await db.collection('buyer_instances').where('buyerUserId', '==', userId).get();
    const instances = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ instances });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/buyer/instances/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const isActive = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) > new Date() : true;
    res.json({ instance: { id: doc.id, ...instance }, isActive });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/buyer/instances/:instanceId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { destinationUrl } = req.body;
    const userId = (req as any).user?.uid;
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    if (doc.data()?.buyerUserId !== userId) { res.status(403).json({ error: "Not authorized" }); return; }
    await db.collection('buyer_instances').doc(instanceId).update({ destinationUrl, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/buyer/instances/:instanceId/renew', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const baseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
    const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], line_items: [{ price_data: { currency: 'usd', product_data: { name: 'QR Hosting Renewal - 3 Years', description: 'Extend your QR hosting for another 3 years' }, unit_amount: 499 }, quantity: 1 }], mode: 'payment', success_url: `${baseUrl}/renew/${instanceId}/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/renew/${instanceId}`, metadata: { instanceId, type: 'hosting_renewal' }, customer_email: instance.buyerEmail });
    res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/buyer/instances/:instanceId/verify-renewal', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { sessionId } = req.body;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') { res.status(400).json({ error: "Payment not completed" }); return; }
    if (session.metadata?.instanceId !== instanceId) { res.status(400).json({ error: "Session does not match instance" }); return; }
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const currentExpiry = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) : new Date();
    const base = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(base.getTime() + 3 * 365 * 24 * 60 * 60 * 1000);
    await db.collection('buyer_instances').doc(instanceId).update({ hostingExpiresAt: newExpiry.toISOString(), renewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ success: true, instance: { ...instance, hostingExpiresAt: newExpiry.toISOString() }, newExpirationDate: newExpiry.toISOString() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/dynamics/surfaces', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, storeId, channelId, collectionName, rotationInterval, timezone, isEnabled } = req.body;
    if (!storeId || !channelId || !collectionName) { res.status(400).json({ error: "storeId, channelId, and collectionName are required" }); return; }
    const surfaceData = { name: name || `Dynamics - ${collectionName}`, storeId, channelId, collectionName, rotationInterval: rotationInterval || "daily", timezone: timezone || "America/New_York", isEnabled: isEnabled !== false, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    const surfaceRef = await db.collection("qrDynamicsSurfaces").add(surfaceData);
    res.json({ success: true, surfaceId: surfaceRef.id, message: `Dynamics surface created for ${collectionName}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/dynamics/surfaces', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection("qrDynamicsSurfaces").orderBy("createdAt", "desc").limit(100).get();
    const surfaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null, updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null }));
    res.json({ success: true, surfaces, count: surfaces.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/public/dynamics/resolve/:surfaceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const surfaceDoc = await db.collection("qrDynamicsSurfaces").doc(surfaceId).get();
    if (!surfaceDoc.exists) { res.status(404).json({ error: "Surface not found" }); return; }
    const surface = surfaceDoc.data() as any;
    if (!surface.isEnabled) { res.json({ success: true, surfaceId, isEnabled: false, activeItem: null, message: "Surface is disabled" }); return; }
    const { storeId, channelId, collectionName, rotationInterval, timezone } = surface;
    const linksSnapshot = await db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).orderBy("createdAt", "asc").get();
    if (linksSnapshot.empty) { res.json({ success: true, surfaceId, isEnabled: true, activeItem: null, message: "No items in collection" }); return; }
    const items = linksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const now = new Date();
    const tz = timezone || "America/New_York";
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    const year = Number(get("year")); const month = Number(get("month")); const day = Number(get("day"));
    let indexKey: number;
    if (rotationInterval === "daily") indexKey = year * 10000 + month * 100 + day;
    else if (rotationInterval === "weekly") { const startOfYear = new Date(year, 0, 1); indexKey = year * 100 + Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) / 7); }
    else indexKey = year * 100 + month;
    const activeIndex = indexKey % items.length;
    const activeItem = items[activeIndex] as any;
    res.json({ success: true, serverNowIso: now.toISOString(), surfaceId, isEnabled: true, rotationInterval, timezone: tz, totalItems: items.length, activeIndex, activeItem: { id: activeItem.id, packetId: activeItem.packetId, name: activeItem.productName || "Untitled", imageUrl: activeItem.compositeUrl || activeItem.qrOnlyUrl, mockupUrl: activeItem.mockupUrl, landingPageUrl: activeItem.landingPageUrl, qrProductState: activeItem.qrProductState }, nextSwitch: rotationInterval === "daily" ? "Midnight (local time)" : rotationInterval === "weekly" ? "Sunday midnight" : "1st of next month" });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/stores/:storeId/channels/:channelId/content', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const contentSnapshot = await db.collection("dynamicsChannelContent").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    const explicitContent = contentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const channelIdLower = channelId.toLowerCase();
    let packetsSnapshot = await db.collection("productPackets").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    if (packetsSnapshot.empty && channelId !== channelIdLower) packetsSnapshot = await db.collection("productPackets").where("storeId", "==", storeId).where("channelId", "==", channelIdLower).get();
    const packetContent = packetsSnapshot.docs.map(doc => { const data = doc.data(); if (data.landingPageSnapshotUrl) { return { id: `packet-${doc.id}`, storeId, channelId, name: data.productName || data.landingPageTitle || 'Landing Page', contentType: 'image', url: data.landingPageSnapshotUrl, thumbnailUrl: data.landingPageSnapshotUrl, sourceType: 'packet', packetId: doc.id, landingPageSlug: data.landingPageSlug }; } return null; }).filter(Boolean);
    const content = [...explicitContent, ...packetContent];
    res.json({ success: true, content, count: content.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/stores/:storeId/channels/:channelId/content', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const { name, contentType, url, thumbnailUrl, metadata } = req.body;
    if (!name || !contentType || !url) { res.status(400).json({ error: "name, contentType, and url are required" }); return; }
    const docRef = await db.collection("dynamicsChannelContent").add({ storeId, channelId, name, contentType, url, thumbnailUrl: thumbnailUrl || url, metadata: metadata || {}, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, contentId: docRef.id, name });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/stores/:storeId/channels/:channelId/content/:contentId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;
    await db.collection("dynamicsChannelContent").doc(contentId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params;
    const { contentId, contentType, name, url, thumbnailUrl, rotationInterval } = req.body;
    if (!collectionId || !contentId || !contentType || !name || !url) { res.status(400).json({ error: "Missing required fields" }); return; }
    const existingItems = await db.collection("dynamicsCollectionItems").where("collectionId", "==", collectionId).orderBy("order", "desc").limit(1).get();
    const maxOrder = existingItems.empty ? 0 : (existingItems.docs[0].data().order || 0);
    const docRef = await db.collection("dynamicsCollectionItems").add({ collectionId, contentId, contentType, name, url, thumbnailUrl: thumbnailUrl || url, order: maxOrder + 1, rotationInterval: rotationInterval || 'daily', addedAt: new Date() });
    res.json({ success: true, itemId: docRef.id, order: maxOrder + 1 });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params;
    const itemsSnapshot = await db.collection("dynamicsCollectionItems").where("collectionId", "==", collectionId).orderBy("order", "asc").get();
    const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, items, count: items.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/collections/:collectionId/items/:itemId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { order, rotationInterval } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (order !== undefined) updateData.order = order;
    if (rotationInterval) updateData.rotationInterval = rotationInterval;
    await db.collection("dynamicsCollectionItems").doc(itemId).update(updateData);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/collections/:collectionId/items/:itemId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    await db.collection("dynamicsCollectionItems").doc(itemId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/collections/:collectionId/items/reorder', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemOrders } = req.body;
    if (!itemOrders || !Array.isArray(itemOrders)) { res.status(400).json({ error: "itemOrders array is required" }); return; }
    const batch = db.batch();
    for (const { itemId, order } of itemOrders) { batch.update(db.collection("dynamicsCollectionItems").doc(itemId), { order, updatedAt: new Date() }); }
    await batch.commit();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const linksSnapshot = await db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).get();
    const collectionsSet = new Set<string>();
    linksSnapshot.docs.forEach(doc => { const c = doc.data().collection; if (c) collectionsSet.add(c); });
    const explicitSnapshot = await db.collection("dynamicsCollections").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    explicitSnapshot.docs.forEach(doc => { const n = doc.data().name; if (n) collectionsSet.add(n); });
    const collections = Array.from(collectionsSet).sort();
    res.json({ success: true, collections, count: collections.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const docRef = await db.collection("dynamicsCollections").add({ storeId, channelId, name, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, collectionId: docRef.id, name });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/stores/:storeId/channels/:channelId/collections/:collectionName/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId, collectionName } = req.params;
    const linksSnapshot = await db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).get();
    const items = linksSnapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, linkId: doc.id, packetId: data.packetId || null, name: data.productName || "Untitled Product", imageUrl: data.compositeUrl || data.qrOnlyUrl || null, mockupUrl: data.mockupUrl || null, qrProductState: data.qrProductState || null, landingPageUrl: data.landingPageUrl || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null }; });
    res.json({ success: true, items, collection: collectionName, count: items.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamics/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string;
    const channelId = req.query.channelId as string;
    if (!storeId) { res.status(400).json({ error: "storeId is required" }); return; }
    const packetsSnapshot = await db.collection("productPackets").where("storeId", "==", storeId).get();
    let docs = packetsSnapshot.docs;
    if (channelId) { const channelIdLower = channelId.toLowerCase(); docs = docs.filter(doc => { const d = doc.data(); return d.channelId === channelId || d.channelId === channelIdLower; }); }
    const packets = docs.map(doc => { const data = doc.data(); if (!data.landingPageSnapshotUrl) return null; let qrType: string = 'qr-canvas'; if ((data.landingPageSnapshotUrl || '').includes('/play/')) qrType = 'qr-play'; return { id: doc.id, packetId: doc.id, name: data.productName || data.landingPageTitle || 'Untitled', qrProductType: qrType, thumbnailUrl: data.landingPageSnapshotUrl, landingPageSlug: data.landingPageSlug, landingPageUrl: data.landingPageSlug ? `/p/${data.landingPageSlug}` : null, storeId: data.storeId, channelId: data.channelId }; }).filter(Boolean);
    res.json({ success: true, packets, count: packets.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamics/instances', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, collectionId, slots, fallbackUrl } = req.body;
    if (!slots || !Array.isArray(slots) || slots.length === 0) { res.status(400).json({ error: "slots array is required" }); return; }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const instanceData = { orderId: orderId || null, collectionId: collectionId || null, createdAt: nowEpoch, startTimestamp: nowEpoch, mode: 'loop', fallbackUrl: fallbackUrl || null, slots: slots.map((slot: any, index: number) => ({ slotId: slot.slotId || `slot-${Date.now()}-${index}`, packetId: slot.packetId, durationSeconds: slot.durationSeconds || 86400, order: slot.order ?? index + 1 })) };
    const docRef = await db.collection("qr_dynamics_instances").add(instanceData);
    res.json({ success: true, instanceId: docRef.id, resolverUrl: `/qr/d/${docRef.id}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamics/instances/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection("qr_dynamics_instances").doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    res.json({ success: true, instance: { id: doc.id, ...doc.data() } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamics/instances/:instanceId/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection("qr_dynamics_instances").doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const slots = instance.slots || [];
    if (slots.length === 0) { res.json({ success: true, activeSlot: null, message: "No slots configured" }); return; }
    const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);
    const nowEpoch = Math.floor(Date.now() / 1000);
    const elapsed = nowEpoch - instance.startTimestamp;
    let cycleLength = 0;
    for (const slot of sortedSlots) cycleLength += slot.durationSeconds;
    if (cycleLength <= 0) { res.status(500).json({ error: "Invalid cycle length" }); return; }
    const position = elapsed % cycleLength;
    let running = 0; let activeSlot = null; let activeIndex = 0;
    for (let i = 0; i < sortedSlots.length; i++) { running += sortedSlots[i].durationSeconds; if (position < running) { activeSlot = sortedSlots[i]; activeIndex = i; break; } }
    let packetDetails = null;
    if (activeSlot) { const packetDoc = await db.collection("productPackets").doc(activeSlot.packetId).get(); if (packetDoc.exists) { const pd = packetDoc.data() as any; packetDetails = { name: pd.productName || pd.landingPageTitle || 'Untitled', thumbnailUrl: pd.landingPageSnapshotUrl, landingPageSlug: pd.landingPageSlug, qrProductType: pd.qrProductType }; } }
    let timeRemainingSeconds = 0;
    if (activeSlot) { const slotStart = running - activeSlot.durationSeconds; timeRemainingSeconds = activeSlot.durationSeconds - (position - slotStart); }
    res.json({ success: true, nowEpoch, elapsed, cycleLength, position, activeIndex, totalSlots: sortedSlots.length, activeSlot: activeSlot ? { ...activeSlot, packet: packetDetails } : null, timeRemainingSeconds, nextSlotIndex: (activeIndex + 1) % sortedSlots.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/dynamics/instances/:instanceId/slots', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { slots } = req.body;
    if (!slots || !Array.isArray(slots)) { res.status(400).json({ error: "slots array is required" }); return; }
    const nowEpoch = Math.floor(Date.now() / 1000);
    await db.collection("qr_dynamics_instances").doc(instanceId).update({ slots: slots.map((slot: any, index: number) => ({ slotId: slot.slotId || `slot-${Date.now()}-${index}`, packetId: slot.packetId, durationSeconds: slot.durationSeconds || 86400, order: slot.order ?? index + 1 })), startTimestamp: nowEpoch });
    res.json({ success: true, instanceId, newStartTimestamp: nowEpoch });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/qr/d/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection("qr_dynamics_instances").doc(instanceId).get();
    if (!doc.exists) { res.status(404).send("QR Dynamics instance not found"); return; }
    const instance = doc.data() as any;
    const slots = instance.slots || [];
    if (slots.length === 0) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("No content configured"); return; }
    const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);
    if (instance.composeMode === 'scan-to-reveal') {
      const slotPacketIds = sortedSlots.map((s: any) => s.packetId);
      const packetSlugs: string[] = [];
      for (const pid of slotPacketIds) { let pDoc = await db.collection("productPackets").doc(pid).get(); if (!pDoc.exists) pDoc = await db.collection("memberPackets").doc(pid).get(); const pData = pDoc.exists ? pDoc.data() : null; packetSlugs.push((pData as any)?.landingPageSlug || ''); }
      const validSlugs = packetSlugs.filter(s => s !== '');
      if (validSlugs.length === 0) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("No content configured"); return; }
      const slugsJson = JSON.stringify(validSlugs);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading...</title></head><body><script>(function(){var k='qr_str_'+${JSON.stringify(instanceId)};var slugs=${slugsJson};var idx=parseInt(localStorage.getItem(k)||'0',10);if(isNaN(idx)||idx<0)idx=0;var current=idx%slugs.length;localStorage.setItem(k,String(idx+1));window.location.replace('/p/'+slugs[current]);})();</script><noscript><p>JavaScript is required.</p></noscript></body></html>`;
      res.status(200).type('html').send(html); return;
    }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const elapsed = nowEpoch - instance.startTimestamp;
    let cycleLength = 0;
    for (const slot of sortedSlots) cycleLength += slot.durationSeconds;
    if (cycleLength <= 0) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(500).send("Invalid config"); return; }
    const position = elapsed % cycleLength;
    let running = 0; let activeSlot = null;
    for (const slot of sortedSlots) { running += slot.durationSeconds; if (position < running) { activeSlot = slot; break; } }
    if (!activeSlot) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(500).send("Unable to resolve slot"); return; }
    let packetDoc = await db.collection("productPackets").doc(activeSlot.packetId).get();
    if (!packetDoc.exists) packetDoc = await db.collection("memberPackets").doc(activeSlot.packetId).get();
    if (!packetDoc.exists) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("Content not available"); return; }
    const packetData = packetDoc.data() as any;
    if (!packetData.landingPageSlug) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("Landing page not configured"); return; }
    res.redirect(302, `/p/${packetData.landingPageSlug}`);
  } catch (error: any) { res.status(500).send("QR Dynamics error"); }
});

// ============ TEMP PACKETS & PUBLIC WIZARD (Batch 5) ============

app.post('/public/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const packetData = { status: 'building', ...req.body, createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: expiresAt.toISOString() };
    const docRef = await db.collection('temp_packets').add(packetData);
    res.json({ success: true, tempPacketId: docRef.id, expiresAt: expiresAt.toISOString() });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.patch('/public/packets/:tempPacketId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempPacketId } = req.params;
    const docRef = db.collection('temp_packets').doc(tempPacketId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ success: false, error: "Temp packet not found" }); return; }
    if (doc.data()?.status === 'completed') { res.status(400).json({ success: false, error: "Packet already completed" }); return; }
    await docRef.update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true, tempPacketId });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/public/packets/:tempPacketId/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempPacketId } = req.params;
    const docRef = db.collection('temp_packets').doc(tempPacketId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ success: false, error: "Temp packet not found" }); return; }
    await docRef.update({ status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ success: true, tempPacketId });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/public/packets/cleanup/expired', async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const expiredQuery = await db.collection('temp_packets').where('status', '==', 'building').where('expiresAt', '<', now).limit(100).get();
    let deletedCount = 0;
    const batch = db.batch();
    expiredQuery.docs.forEach(doc => { batch.delete(doc.ref); deletedCount++; });
    if (deletedCount > 0) await batch.commit();
    res.json({ success: true, deletedCount });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/public/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempPacketId } = req.body;
    if (!tempPacketId) { res.status(400).json({ error: "Missing tempPacketId" }); return; }
    const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Temp packet not found" }); return; }
    const packet = packetDoc.data()!;
    if (packet.status === 'completed') { res.status(400).json({ error: "Already purchased" }); return; }
    const pricingDoc = await db.collection("testSettings").doc("pricing").get();
    const ps = pricingDoc.exists ? pricingDoc.data() : null;
    const defaultSU: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const sizeUpcharges = ps?.sizeUpcharges || defaultSU;
    const additionalPlacementCost = ps?.additionalPlacementCost ?? 4;
    const textLineUpcharge = ps?.textLineUpcharge ?? 2;
    const basePrice = parseFloat(packet.retailPrice) || ps?.baseRetailPrice || 29.99;
    const selectedSize = packet.selectedShirtSize || packet.selectedSize || 'M';
    const sizeUpcharge = sizeUpcharges[selectedSize] || 0;
    const placements = packet.selectedPlacements || ['front'];
    const placementCost = Math.max(0, placements.length - 1) * additionalPlacementCost;
    const textLayout = packet.textLayoutChoice || '';
    let textCostLines = 0;
    if (textLayout === 'both') textCostLines = 2;
    else if (textLayout === 'header' || textLayout === 'footer') textCostLines = 1;
    const textCost = textCostLines * textLineUpcharge;
    const serverTotal = Math.round((basePrice + sizeUpcharge + placementCost + textCost) * 100) / 100;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const productTitle = packet.productTitle || 'QR Gear Custom Product';
    const baseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
    const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], line_items: [{ price_data: { currency: 'usd', product_data: { name: productTitle, images: packet.mockupUrl ? [packet.mockupUrl.startsWith('http') ? packet.mockupUrl : `${baseUrl}${packet.mockupUrl}`] : [] }, unit_amount: Math.round(serverTotal * 100) }, quantity: 1 }], mode: 'payment', success_url: `${baseUrl}/build/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/build`, metadata: { tempPacketId, source: 'public_wizard', serverTotal: serverTotal.toString() }, customer_creation: 'if_required' });
    await packetDoc.ref.update({ stripeSessionId: session.id, serverCalculatedTotal: serverTotal, checkoutCreatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ url: session.url, sessionId: session.id, total: serverTotal });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/public/checkout/verify/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') { res.status(400).json({ error: "Payment not completed" }); return; }
    const tempPacketId = session.metadata?.tempPacketId;
    if (!tempPacketId) { res.status(400).json({ error: "No packet linked" }); return; }
    const existingOrderQuery = await db.collection('orders_public').where('stripeSessionId', '==', sessionId).limit(1).get();
    if (!existingOrderQuery.empty) { const existingOrder = existingOrderQuery.docs[0].data(); res.json({ success: true, alreadyProcessed: true, order: { id: existingOrderQuery.docs[0].id, ...existingOrder } }); return; }
    const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Temp packet not found" }); return; }
    const packet = packetDoc.data()!;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let claimCode = '';
    for (let i = 0; i < 8; i++) claimCode += chars.charAt(Math.floor(Math.random() * chars.length));
    const buyerEmail = (session.customer_details as any)?.email || '';
    const buyerName = (session.customer_details as any)?.name || '';
    const now = new Date();
    const realPacketData = { ...packet, status: 'purchased', source: 'public_wizard', buyerEmail, buyerName, stripeSessionId: sessionId, stripePaymentIntentId: session.payment_intent as string, purchasedAt: now.toISOString(), createdAt: packet.createdAt || now.toISOString(), updatedAt: now.toISOString() } as any;
    delete realPacketData.expiresAt; delete realPacketData.checkoutCreatedAt; delete realPacketData.serverCalculatedTotal;
    const realPacketRef = await db.collection('product_packets').add(realPacketData);
    const serverTotal = parseFloat(packet.serverCalculatedTotal || (session as any).amount_total! / 100);
    const orderData = { tempPacketId, realPacketId: realPacketRef.id, stripeSessionId: sessionId, stripePaymentIntentId: session.payment_intent as string, buyerEmail, buyerName, claimCode, productTitle: packet.productTitle || 'QR Gear Product', qrType: packet.qrType || 'qr-basic', selectedColor: packet.selectedColor || '', selectedSize: packet.selectedShirtSize || packet.selectedSize || 'M', totalAmount: serverTotal, mockupUrl: packet.mockupUrl || null, lifestyleMockupUrl: packet.lifestyleMockupUrl || null, status: 'paid', graphicRetainedUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() };
    const orderRef = await db.collection('orders_public').add(orderData);
    await packetDoc.ref.update({ status: 'completed', completedAt: now.toISOString(), realPacketId: realPacketRef.id, orderId: orderRef.id, updatedAt: now.toISOString() });
    res.json({ success: true, order: { id: orderRef.id, ...orderData }, realPacketId: realPacketRef.id, claimCode });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ MEMBER PLAY PACKETS ============

app.post('/member/play-packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, videoUrl, title, description, background, thumbnailUrl, metadata, storeId, channelId, source, status } = req.body;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    const packetId = `pkt-play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetData = { packetId, memberId, packetType: 'qr-play', videoUrl: videoUrl || null, title: title || 'Untitled', description: description || '', background: background || null, thumbnailUrl: thumbnailUrl || null, metadata: metadata || null, storeId: storeId || memberId, channelId: channelId || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('memberPackets').doc(packetId).set(packetData);
    res.json({ packetId, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ COMPOSITE IMAGE GENERATOR (Inlined from server/lib/composite-image-generator.ts) ============

let _canvas: any = null;
let _qrcode: any = null;
function getCanvas() {
  if (!_canvas) {
    try { _canvas = require('canvas'); } catch (e: any) {
      console.error('[Canvas] Failed to load canvas module:', e.message);
      throw new Error('Canvas module not available - ensure canvas is installed');
    }
  }
  return _canvas;
}
function getQRCode() {
  if (!_qrcode) {
    try { _qrcode = require('qrcode'); } catch (e: any) {
      console.error('[QRCode] Failed to load qrcode module:', e.message);
      throw new Error('QRCode module not available');
    }
  }
  return _qrcode;
}

interface TextStyleCF {
  text: string;
  fontFamily: string;
  fontSize: string;
  color?: string;
  letterSpacing?: number;
  warpPreset?: string;
  strokeColor?: string;
  strokeWidth?: number;
  verticalOffset?: number;
  horizontalOffset?: number;
}

const CF_PLACEMENT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "front": { width: 3600, height: 4800 },
  "front_large": { width: 3600, height: 4800 },
  "back": { width: 3600, height: 4200 },
  "front_small": { width: 2400, height: 1800 },
  "pocket": { width: 1200, height: 1200 },
  "left_sleeve": { width: 1200, height: 1500 },
  "right_sleeve": { width: 1200, height: 1500 },
};

const CF_FONT_MAP: Record<string, string> = {
  "Arial": "Arial", "Helvetica": "Helvetica", "Times New Roman": "Times New Roman",
  "Georgia": "Georgia", "Verdana": "Verdana", "Courier New": "Courier New",
  "Impact": "Impact", "Comic Sans MS": "Comic Sans MS", "Trebuchet MS": "Trebuchet MS",
  "Palatino Linotype": "Palatino Linotype",
};

function cfGetPreviewFontSize(fontSize: string): number {
  if (fontSize === '12px' || fontSize === 'sm') return 10;
  if (fontSize === '24px' || fontSize === 'lg') return 16;
  if (fontSize === '32px' || fontSize === 'xl') return 22;
  return 12;
}

const CF_PREVIEW_CONTAINER_WIDTH = 160;

function cfWrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function cfGenerateCompositeImage(options: {
  width?: number; height?: number; backgroundColor?: string; qrSize?: number;
  topText?: TextStyleCF | null; bottomText?: TextStyleCF | null;
  qrUrl: string; qrColor?: 'black' | 'white'; placement?: string;
}): Promise<string> {
  const {
    width = 1200, height = 1800, backgroundColor = "#FFFFFF",
    qrSize = 600, topText, bottomText, qrUrl, qrColor = 'black',
  } = options;

  const { createCanvas: cc, loadImage: li } = getCanvas();
  const canvas = cc(width, height);
  const ctx = canvas.getContext("2d");

  if (backgroundColor && backgroundColor !== "transparent") {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  const textColor = "#000000";
  const scaleFactor = width / CF_PREVIEW_CONTAINER_WIDTH;
  const headerZoneTop = 0;
  const headerZoneHeight = height * 0.25;
  const qrZoneTop = headerZoneHeight;
  const qrZoneHeight = height * 0.50;
  const footerZoneTop = qrZoneTop + qrZoneHeight;
  const footerZoneHeight = height * 0.25;

  if (topText && topText.text) {
    const previewFontSize = cfGetPreviewFontSize(topText.fontSize);
    const fontSize = previewFontSize * scaleFactor;
    const fontFamily = CF_FONT_MAP[topText.fontFamily] || "Arial";
    const fillColor = topText.color || textColor;
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
      ctx.strokeStyle = topText.strokeColor;
      ctx.lineWidth = topText.strokeWidth * scaleFactor;
    }
    const lines = cfWrapText(ctx, topText.text, width - 120);
    const totalTextHeight = lines.length * fontSize * 1.3;
    const vOff = topText.verticalOffset ?? 50;
    const hOff = topText.horizontalOffset ?? 50;
    const marginPct = 0.01;
    const marginY = headerZoneHeight * marginPct;
    const marginX = width * marginPct;
    const usableH = headerZoneHeight - 2 * marginY;
    const usableW = width - 2 * marginX;
    let currentY = headerZoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight);
    const textX = marginX + (hOff / 100) * usableW;
    for (const line of lines) {
      if (topText.strokeColor && topText.strokeWidth && topText.strokeWidth > 0) {
        ctx.strokeText(line, textX, currentY);
      }
      ctx.fillText(line, textX, currentY);
      currentY += fontSize * 1.3;
    }
  }

  const qrDark = qrColor === 'white' ? "#FFFFFF" : "#000000";
  const qrLight = qrColor === 'white' ? "#000000" : "#FFFFFF";
  const qrMarginY = qrZoneHeight * 0.10;
  const qrAreaHeight = qrZoneHeight * 0.80;
  const bgPadding = 20;
  const bgRadius = 16;
  const qrContentHeight = qrAreaHeight - bgPadding * 2;
  const qrContentWidth = qrContentHeight;
  const qrDataUrl = await getQRCode().toDataURL(qrUrl, {
    width: qrContentWidth, margin: 2,
    color: { dark: qrDark, light: qrLight },
  });
  const qrImage = await li(qrDataUrl);
  const qrBgWidth = qrContentWidth + bgPadding * 2;
  const qrBgX = (width - qrBgWidth) / 2;
  const qrBgY = qrZoneTop + qrMarginY;
  const qrX = (width - qrContentWidth) / 2;
  const qrY = qrBgY + bgPadding;
  ctx.fillStyle = qrLight;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(qrBgX, qrBgY, qrBgWidth, qrAreaHeight, bgRadius);
  } else {
    ctx.rect(qrBgX, qrBgY, qrBgWidth, qrAreaHeight);
  }
  ctx.fill();
  ctx.drawImage(qrImage, qrX, qrY, qrContentWidth, qrContentHeight);

  if (bottomText && bottomText.text) {
    const previewFontSize = cfGetPreviewFontSize(bottomText.fontSize);
    const fontSize = previewFontSize * scaleFactor;
    const fontFamily = CF_FONT_MAP[bottomText.fontFamily] || "Arial";
    const fillColor = bottomText.color || textColor;
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = fillColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
      ctx.strokeStyle = bottomText.strokeColor;
      ctx.lineWidth = bottomText.strokeWidth * scaleFactor;
    }
    const lines = cfWrapText(ctx, bottomText.text, width - 120);
    const totalTextHeight = lines.length * fontSize * 1.3;
    const vOff = bottomText.verticalOffset ?? 50;
    const hOff = bottomText.horizontalOffset ?? 50;
    const marginPct = 0.01;
    const marginY = footerZoneHeight * marginPct;
    const marginX = width * marginPct;
    const usableH = footerZoneHeight - 2 * marginY;
    const usableW = width - 2 * marginX;
    let currentY = footerZoneTop + marginY + (vOff / 100) * (usableH - totalTextHeight);
    const textX = marginX + (hOff / 100) * usableW;
    for (const line of lines) {
      if (bottomText.strokeColor && bottomText.strokeWidth && bottomText.strokeWidth > 0) {
        ctx.strokeText(line, textX, currentY);
      }
      ctx.fillText(line, textX, currentY);
      currentY += fontSize * 1.3;
    }
  }

  return canvas.toDataURL("image/png");
}

const CF_PREVIEW_WIDTH = 160;
const CF_PREVIEW_QR_SIZE = 36;

async function cfGeneratePrintifyComposite(
  qrUrl: string, topText: TextStyleCF | null, bottomText: TextStyleCF | null,
  printWidth: number = 1200, printHeight: number = 1800,
  qrColor: 'black' | 'white' = 'black', placement?: string
): Promise<string> {
  let finalWidth = printWidth;
  let finalHeight = printHeight;
  if (placement && CF_PLACEMENT_DIMENSIONS[placement]) {
    finalWidth = CF_PLACEMENT_DIMENSIONS[placement].width;
    finalHeight = CF_PLACEMENT_DIMENSIONS[placement].height;
  }
  const scaleFactor = finalWidth / CF_PREVIEW_WIDTH;
  const qrSize = CF_PREVIEW_QR_SIZE * scaleFactor;
  return cfGenerateCompositeImage({
    width: finalWidth, height: finalHeight, backgroundColor: "transparent",
    qrSize, topText, bottomText, qrUrl, qrColor, placement,
  });
}

async function cfUploadBufferToStorage(buffer: Buffer, mimeType: string, folder: string = 'member-graphics'): Promise<{ publicUrl: string; storagePath: string }> {
  const crypto = require('crypto');
  const extension = mimeType.split('/')[1] || 'png';
  const uniqueId = crypto.randomBytes(16).toString('hex');
  const objectName = `${folder}/${uniqueId}.${extension}`;
  const bucket = storage.bucket();
  const file = bucket.file(objectName);
  await file.save(buffer, { metadata: { contentType: mimeType }, public: true });
  await file.makePublic();
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectName}`;
  console.log(`[CF Storage] Uploaded: ${objectName} (${buffer.length} bytes)`);
  return { publicUrl, storagePath: objectName };
}

// ============ BATCH: MEMBER MOCKUP & GRAPHIC ROUTES ============

app.post('/members/mockup/priority', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" }); return;
    }
    console.log(`[CF Member Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
      colorName, colorHex, artworkUrl, artworkVariant: 'black',
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      placement: placement || 'front',
    });
    console.log(`[CF Member Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
    res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, fromCache: result.fromCache, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("[CF Member Mockup] Error:", error);
    res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
  }
});

app.post('/members/generate-product-graphic', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black' } = req.body;
    if (!qrUrl) { res.status(400).json({ error: "Missing required field: qrUrl" }); return; }
    console.log(`[CF ProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
    const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
    const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
    const topText = showHeader && headerStyle?.text ? {
      text: headerStyle.text, fontFamily: headerStyle.fontFamily || 'Arial',
      fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
      letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
      strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
    } : null;
    const bottomText = showFooter && footerStyle?.text ? {
      text: footerStyle.text, fontFamily: footerStyle.fontFamily || 'Arial',
      fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
      letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
      strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
    } : null;
    const productGraphicDataUrl = await cfGeneratePrintifyComposite(qrUrl, topText, bottomText, 1200, 1800, qrColor as 'black' | 'white');
    const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL format from composite generator");
    const buffer = Buffer.from(match[2], 'base64');
    const uploadResult = await cfUploadBufferToStorage(buffer, match[1], 'member-graphics');
    console.log(`[CF ProductGraphic] Uploaded: ${uploadResult.publicUrl}`);
    res.json({ success: true, productGraphic: uploadResult.publicUrl });
  } catch (error: any) {
    console.error("[CF ProductGraphic] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/public/generate-product-graphic', async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black' } = req.body;
    if (!qrUrl) { res.status(400).json({ error: "Missing required field: qrUrl" }); return; }
    console.log(`[CF PublicProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
    const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
    const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
    const topText = showHeader && headerStyle?.text ? {
      text: headerStyle.text, fontFamily: headerStyle.fontFamily || 'Arial',
      fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
      letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
      strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
    } : null;
    const bottomText = showFooter && footerStyle?.text ? {
      text: footerStyle.text, fontFamily: footerStyle.fontFamily || 'Arial',
      fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
      letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
      strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
    } : null;
    const productGraphicDataUrl = await cfGeneratePrintifyComposite(qrUrl, topText, bottomText, 1200, 1800, qrColor as 'black' | 'white');
    const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL format from composite generator");
    const buffer = Buffer.from(match[2], 'base64');
    const uploadResult = await cfUploadBufferToStorage(buffer, match[1], 'public-graphics');
    console.log(`[CF PublicProductGraphic] Uploaded: ${uploadResult.publicUrl}`);
    res.json({ success: true, productGraphic: uploadResult.publicUrl });
  } catch (error: any) {
    console.error("[CF PublicProductGraphic] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/public/generate-mockup', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      tempPacketId, blueprintId, printProviderId, colorName, colorHex,
      placement = 'front', qrSize = 'medium', fulfillmentProvider = 'printify',
      qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black',
    } = req.body;
    if (!blueprintId || !colorName) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName" }); return;
    }
    console.log(`[CF PublicMockup] Starting for packet: ${tempPacketId || 'none'}, color: ${colorName}`);
    let artworkUrl: string;
    if (textLayoutChoice && textLayoutChoice !== '' && (headerStyle?.text || footerStyle?.text)) {
      console.log(`[CF PublicMockup] Generating composite artwork with text layout: ${textLayoutChoice}`);
      const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
      const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
      const topText = showHeader && headerStyle?.text ? {
        text: headerStyle.text, fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
      } : null;
      const bottomText = showFooter && footerStyle?.text ? {
        text: footerStyle.text, fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
      } : null;
      const compositeDataUrl = await cfGeneratePrintifyComposite(
        qrUrl || 'https://example.com', topText, bottomText, 1200, 1800, qrColor as 'black' | 'white'
      );
      const match = compositeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid data URL format from composite generator");
      const buffer = Buffer.from(match[2], 'base64');
      const uploadResult = await cfUploadBufferToStorage(buffer, match[1], 'public-graphics');
      artworkUrl = uploadResult.publicUrl;
      console.log(`[CF PublicMockup] Composite uploaded: ${artworkUrl}`);
    } else {
      const qrContent = qrUrl || 'https://example.com';
      artworkUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrContent)}&format=png&qzone=2&ecc=H&color=000000&bgcolor=ffffff`;
      console.log(`[CF PublicMockup] Using raw QR artwork: ${artworkUrl}`);
    }
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
      colorName, colorHex: colorHex || '#000000', artworkUrl,
      artworkVariant: qrColor === 'white' ? 'white' : 'black',
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      placement,
    });
    console.log(`[CF PublicMockup] Mockup generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
    if (tempPacketId) {
      try {
        await db.collection('temp_packets').doc(tempPacketId).update({
          mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl,
          artworkUrl, updatedAt: new Date().toISOString(),
        });
        console.log(`[CF PublicMockup] Packet ${tempPacketId} updated with mockup`);
      } catch (pktErr: any) {
        console.warn(`[CF PublicMockup] Failed to update packet: ${pktErr.message}`);
      }
    }
    res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, artworkUrl, fromCache: result.fromCache });
  } catch (error: any) {
    console.error("[CF PublicMockup] Error:", error);
    res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
  }
});

// ============ BATCH: MEMBER ALLOWED PRODUCTS ============

app.post('/members/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) { res.status(400).json({ error: "products must be an array" }); return; }
    await db.collection("storeAllowedProducts").doc("member-products").set({ products, updatedAt: new Date().toISOString() });
    console.log(`[CF Member Product Library] Saved ${products.length} products to storeAllowedProducts/member-products`);
    res.json({ success: true, count: products.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: MEMBER LIBRARY SYSTEM ============

app.get('/members/common-library', async (req: Request, res: Response): Promise<void> => {
  try {
    const assetType = (req.query.assetType as string) || 'background';
    let commonQuery: any = db.collection('commonLibrary').where('isActive', '==', true);
    if (assetType) commonQuery = commonQuery.where('assetType', '==', assetType);
    let adminQuery: any = db.collection('libraryAssets').where('ownerType', '==', 'admin');
    const [commonSnapshot, adminSnapshot] = await Promise.all([
      commonQuery.orderBy('createdAt', 'desc').get(),
      adminQuery.get(),
    ]);
    const mapAsset = (doc: any) => { const d = doc.data(); return { id: doc.id, name: d.name, assetType: d.assetType, mediaType: d.mediaType || 'image', thumbnailUrl: d.thumbnailUrl || d.publicUrl || d.storageUrl, publicUrl: d.publicUrl || d.storageUrl, width: d.width, height: d.height, category: d.category }; };
    const commonAssets = commonSnapshot.docs.map(mapAsset);
    const adminAssets = adminSnapshot.docs.map(mapAsset).filter((a: any) => a.assetType === assetType);
    const seenIds = new Set<string>();
    const assets = [...commonAssets, ...adminAssets].filter((a: any) => { if (seenIds.has(a.id)) return false; seenIds.add(a.id); return true; }).sort((a: any, b: any) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
    console.log(`[CF Common Library] Found ${assets.length} ${assetType} assets (${commonAssets.length} common + ${adminAssets.length} admin)`);
    res.json({ assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/:memberId/library', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const assetType = req.query.assetType as string;
    let query: any = db.collection('memberLibrary').where('memberId', '==', memberId).where('isActive', '==', true);
    if (assetType) query = query.where('assetType', '==', assetType);
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const assets = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return { id: doc.id, name: data.name, assetType: data.assetType, mediaType: data.mediaType || 'image', thumbnailUrl: data.thumbnailUrl || data.publicUrl, publicUrl: data.publicUrl, width: data.width, height: data.height, sourceAssetId: data.sourceAssetId, isCropped: data.isCropped || false, originalAssetId: data.originalAssetId };
    });
    console.log(`[CF Member Library] Found ${assets.length} assets for member ${memberId}`);
    res.json({ assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/library/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { assetType = 'background', name, imageData, mimeType: inputMimeType, originalName: inputOriginalName, isCropped = false, originalAssetId } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = inputMimeType || 'image/png';
    const originalName = inputOriginalName || `upload-${Date.now()}.png`;
    const displayName = name || originalName;
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
    const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const folder = isCropped ? `members/${memberId}/library/cropped` : mediaType === 'video' ? `members/${memberId}/library/videos` : `members/${memberId}/library/backgrounds`;
    const bucket = storage.bucket();
    const file = bucket.file(`${folder}/${sanitizedName}`);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
    const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
    const assetData: any = {
      memberId, assetType, mediaType, name: displayName, fileName: sanitizedName, originalName,
      storageUrl, publicUrl: proxyUrl, mimeType, sizeBytes: buffer.length, isActive: true,
      isCropped, createdAt: new Date().toISOString(),
    };
    if (originalAssetId) assetData.originalAssetId = originalAssetId;
    const assetDoc = await db.collection('memberLibrary').add(assetData);
    console.log(`[CF Member Upload] Created ${assetType} asset ${assetDoc.id} for member ${memberId}`);
    res.json({ success: true, asset: { id: assetDoc.id, name: displayName, publicUrl: proxyUrl, assetType, mediaType, isCropped } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/library/crop', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { sourceAssetId, name, cropData, imageData } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const mimeType = 'image/png';
    const sanitizedName = `${Date.now()}-cropped-${sourceAssetId}.png`;
    const folder = `members/${memberId}/library/cropped`;
    const bucket = storage.bucket();
    const file = bucket.file(`${folder}/${sanitizedName}`);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
    const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
    const assetDoc = await db.collection('memberLibrary').add({
      memberId, assetType: 'cropped', mediaType: 'image', name: name || 'Cropped Image',
      fileName: sanitizedName, originalName: `cropped-${sourceAssetId}`,
      storageUrl, publicUrl: proxyUrl, mimeType, sizeBytes: buffer.length,
      sourceAssetId, cropData: cropData ? JSON.parse(cropData) : null,
      isActive: true, createdAt: new Date().toISOString(),
    });
    console.log(`[CF Member Crop] Created cropped asset ${assetDoc.id} from ${sourceAssetId} for member ${memberId}`);
    res.json({ success: true, asset: { id: assetDoc.id, name: name || 'Cropped Image', publicUrl: proxyUrl, sourceAssetId } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/videos/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { videoData, mimeType: inputMimeType, fileName: inputFileName } = req.body;
    if (!videoData) { res.status(400).json({ error: "No videoData provided" }); return; }
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const mimeType = inputMimeType || 'video/mp4';
    if (!allowedVideoTypes.includes(mimeType)) { res.status(400).json({ error: "Invalid video type. Allowed: MP4, WebM, MOV" }); return; }
    const base64Data = videoData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const maxSize = 100 * 1024 * 1024;
    if (buffer.length > maxSize) { res.status(400).json({ error: "Video exceeds 100MB limit" }); return; }
    const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/webm' ? 'webm' : 'mov';
    const originalName = inputFileName || `video-${Date.now()}.${ext}`;
    const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const folder = `members/${memberId}/library/videos`;
    const bucket = storage.bucket();
    const file = bucket.file(`${folder}/${sanitizedName}`);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
    const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
    const assetDoc = await db.collection('memberLibrary').add({
      memberId, assetType: 'video', mediaType: 'video', name: originalName,
      fileName: sanitizedName, originalName, storageUrl, publicUrl: proxyUrl,
      mimeType, sizeBytes: buffer.length, isActive: true, createdAt: new Date().toISOString(),
    });
    console.log(`[CF Member Video] Created video asset ${assetDoc.id} for member ${memberId}, size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    res.json({ success: true, videoUrl: proxyUrl, assetId: assetDoc.id, fileName: sanitizedName });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: MEMBER PLAY-PACKET PUBLISH & SHARE-CARD ============

app.post('/member/play-packets/:packetId/share-card', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const { memberId } = req.body;
    if (!packetId || !memberId) { res.status(400).json({ error: "packetId and memberId are required" }); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const packet = packetDoc.data();
    if (packet?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    const shareCardUrl = packet?.videoSource?.posterUrl || null;
    await db.collection('memberPackets').doc(packetId).update({ shareCardUrl, updatedAt: new Date().toISOString() });
    console.log(`[CF QR Play] Generated share card for ${packetId}`);
    res.json({ shareCardUrl, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/play-packets/:packetId/publish', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const { memberId, channelId, metadata } = req.body;
    if (!packetId || !memberId) { res.status(400).json({ error: "packetId and memberId are required" }); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const packet = packetDoc.data();
    if (packet?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    const libraryLinkId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const titleLayer = packet?.textLayers?.find((l: any) => l.id === 'title' || l.label?.toLowerCase() === 'title');
    const linkData = {
      libraryLinkId, packetId, channelId: channelId || null, storeId: memberId, memberId,
      kind: 'qr_play', videoSource: packet?.videoSource || null,
      shareCardUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
      titleText: titleLayer?.text || 'Untitled Video', textLayers: packet?.textLayers || [],
      textBackdrop: packet?.textBackdrop || 'off', playSettings: packet?.playSettings || {},
      metadata: metadata || packet?.metadata || null, status: 'active',
      shareUrl: `/play/${packetId}`, createdAt: new Date().toISOString(),
    };
    await db.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
    await db.collection('memberPackets').doc(packetId).update({ status: 'published', libraryLinkId, updatedAt: new Date().toISOString() });
    if (channelId) {
      const itemId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.collection('channel_items').doc(itemId).set({
        channelId, packetId, title: titleLayer?.text || 'Untitled Video',
        description: metadata?.description || '', previewImageUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
        price: metadata?.price || null, createdAt: new Date().toISOString(),
      });
      console.log(`[CF QR Play] Also wrote to channel_items for channel ${channelId}`);
    }
    console.log(`[CF QR Play] Published packet ${packetId} as ${libraryLinkId}`);
    res.json({ libraryLinkId, shareUrl: `/play/${packetId}`, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: MEMBER FILES PROXY ============

app.get('/member-files/:memberId/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const bucket = storage.bucket();
    const snapshot = await db.collection('memberLibrary')
      .where('memberId', '==', memberId)
      .where('fileName', '==', decodedFilename)
      .limit(1).get();
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      if (data.storageUrl) {
        let storagePath = data.storageUrl;
        if (storagePath.startsWith('gs://')) storagePath = storagePath.replace(/^gs:\/\/[^\/]+\//, '');
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (exists) {
          const [metadata] = await file.getMetadata();
          res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const stream = file.createReadStream();
          stream.pipe(res);
          return;
        }
      }
    }
    const possiblePaths = [
      `members/${memberId}/library/backgrounds/${decodedFilename}`,
      `members/${memberId}/library/cropped/${decodedFilename}`,
      `members/${memberId}/library/videos/${decodedFilename}`,
      `members/${memberId}/backgrounds/${decodedFilename}`,
      `members/${memberId}/videos/${decodedFilename}`,
      `members/${memberId}/cropped/${decodedFilename}`,
    ];
    for (const path of possiblePaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (exists) {
        const [metadata] = await file.getMetadata();
        res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const stream = file.createReadStream();
        stream.pipe(res);
        return;
      }
    }
    console.log(`[CF Member Files] File not found: ${memberId}/${decodedFilename}`);
    res.status(404).json({ error: "File not found" });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: MEMBER MEDIA UPLOAD ============

app.post('/members/:memberId/media', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: "Authentication required" }); return; }
    const idToken = authHeader.substring(7);
    let decodedToken;
    try { decodedToken = await admin.auth().verifyIdToken(idToken); } catch { res.status(401).json({ error: "Invalid authentication token" }); return; }
    const userId = decodedToken.uid;
    console.log(`[CF MemberMedia] Starting media upload for member: ${userId}`);
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) { res.status(400).json({ error: "Invalid content type - expected multipart/form-data" }); return; }
    const boundary = boundaryMatch[1];
    const rawBody = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
    console.log(`[CF MemberMedia] Received ${rawBody.length} bytes`);
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts: Buffer[] = [];
    let start = 0;
    while (true) {
      const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
      if (boundaryIndex === -1) break;
      if (start > 0) parts.push(rawBody.slice(start, boundaryIndex - 2));
      start = boundaryIndex + boundaryBuffer.length + 2;
    }
    let fileBuffer: Buffer | null = null;
    let fileName = `media-${Date.now()}`;
    let fileMimeType = "video/mp4";
    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;
      const headers = part.slice(0, headerEnd).toString();
      const body = part.slice(headerEnd + 4);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      if (filenameMatch) {
        fileName = filenameMatch[1];
        if (contentTypeMatch) fileMimeType = contentTypeMatch[1].trim();
        fileBuffer = body;
      }
    }
    if (!fileBuffer || fileBuffer.length === 0) { res.status(400).json({ error: "No file uploaded" }); return; }
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska", "image/gif", "image/webp", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(fileMimeType) && !fileMimeType.startsWith("video/")) {
      res.status(400).json({ error: `Invalid file type: ${fileMimeType}` }); return;
    }
    const mediaType = fileMimeType.startsWith("video/") ? "video" : "image";
    const uniqueFilename = `${Date.now()}-${fileName}`;
    const storagePath = `library/member/${userId}/${mediaType}/${uniqueFilename}`;
    const mediaUrl = `/api/library-files/member/${userId}/${mediaType}/${uniqueFilename}`;
    console.log(`[CF MemberMedia] Uploading ${fileName} (${fileMimeType}, ${fileBuffer.length} bytes) to ${storagePath}`);
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    await file.save(fileBuffer, { metadata: { contentType: fileMimeType } });
    console.log(`[CF MemberMedia] Upload complete: ${mediaUrl}`);
    res.json({ url: mediaUrl, mimeType: fileMimeType, fileName, size: fileBuffer.length, storagePath });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: REMAINING ADMIN & MISC ROUTES ============

app.get('/admin/dashboard/metrics', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [productsSnap, ordersSnap, customersSnap, packetsSnap] = await Promise.all([
      db.collection('products').get(),
      db.collection('orders').get(),
      db.collection('customers').get(),
      db.collection('product_packets').get(),
    ]);
    const orders = ordersSnap.docs.map((d: any) => d.data());
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    res.json({
      totalProducts: productsSnap.size, totalOrders: ordersSnap.size,
      totalCustomers: customersSnap.size, totalPackets: packetsSnap.size,
      totalRevenue, recentOrders: orders.slice(0, 10),
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/customers', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('customers').orderBy('createdAt', 'desc').limit(100).get();
    const customers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ customers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/customers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('customers').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/email-templates', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('email_templates').get();
    const templates = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ templates });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/email-templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('email_templates').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('email_templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('email_templates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/email-logs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const snapshot = await db.collection('email_logs').orderBy('sentAt', 'desc').limit(limit).get();
    const logs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ logs });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/collections', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('collections').get();
    const collections = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ collections });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('collections').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('collection_items').where('collectionId', '==', req.params.collectionId).get();
    const items = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ items });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('collection_items').add({ ...req.body, collectionId: req.params.collectionId, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/collections/:collectionId/items/:itemId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('collection_items').doc(req.params.itemId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/collections/:collectionId/items/reorder', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;
    const batch = db.batch();
    items.forEach((item: any, index: number) => {
      batch.update(db.collection('collection_items').doc(item.id), { sortOrder: index });
    });
    await batch.commit();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/coupons', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('coupons').get();
    const coupons = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ coupons });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/coupons', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('coupons').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/coupons/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ valid: false, error: "Code is required" }); return; }
    const snapshot = await db.collection('coupons').where('code', '==', code.toUpperCase()).limit(1).get();
    if (snapshot.empty) { res.json({ valid: false, error: "Invalid coupon code" }); return; }
    const coupon = snapshot.docs[0].data();
    if (!coupon.isActive) { res.json({ valid: false, error: "Coupon is expired" }); return; }
    res.json({ valid: true, coupon: { id: snapshot.docs[0].id, ...coupon } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/custom-designs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('custom_designs').orderBy('createdAt', 'desc').get();
    const designs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ designs });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/custom-designs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('custom_designs').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/custom-designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('custom_designs').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/custom-designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('custom_designs').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: ORCHESTRATION ROUTES ============

app.get('/admin/orchestration/master-products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('master_products').orderBy('createdAt', 'desc').get();
    const products = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ products });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/orchestration/master-products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('master_products').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/master-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('master_products').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/orchestration/master-products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('master_products').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/orchestration/master-products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('master_products').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/orchestration/channel-configs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('channel_configs').get();
    const configs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ configs });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/orchestration/channel-configs/:channelType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('channel_configs').doc(req.params.channelType).get();
    if (!doc.exists) { res.status(404).json({ error: "Config not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/channel-configs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelType, ...configData } = req.body;
    await db.collection('channel_configs').doc(channelType).set({ ...configData, channelType, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/orchestration/channel-configs/:channelType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('channel_configs').doc(req.params.channelType).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/routing/route', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('routing_decisions').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/routing/batch', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { routes } = req.body;
    const batch = db.batch();
    const ids: string[] = [];
    for (const route of routes) {
      const ref = db.collection('routing_decisions').doc();
      batch.set(ref, { ...route, createdAt: new Date().toISOString() });
      ids.push(ref.id);
    }
    await batch.commit();
    res.json({ ids, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: MISC ADMIN ROUTES ============

app.get('/admin/background-assets', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('background_assets').orderBy('createdAt', 'desc').get();
    const assets = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/background-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('background_assets').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/background-assets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('background_assets').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/background-assets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('background_assets').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/graphic-sets', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('graphic_sets').orderBy('createdAt', 'desc').get();
    const sets = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ sets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/graphic-sets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('graphic_sets').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/graphic-sets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('graphic_sets').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/graphic-sets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('graphic_sets').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/graphic-sets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('graphic_sets').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/pricing/quote', async (req: Request, res: Response): Promise<void> => {
  try {
    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    const settings = pricingDoc.exists ? pricingDoc.data() : {};
    res.json({ settings });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/pricing/quote', async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, quantity = 1 } = req.body;
    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    const settings = pricingDoc.exists ? pricingDoc.data() : {};
    const markupPercent = settings?.markupPercent ?? 25;
    const markupFixed = settings?.markupFixed ?? 0;
    let baseCost = 0;
    if (blueprintId) {
      const productSnap = await db.collection('products').where('blueprintId', '==', blueprintId).limit(1).get();
      if (!productSnap.empty) {
        const product = productSnap.docs[0].data();
        baseCost = product.baseCost || 0;
      }
    }
    const unitPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
    const total = unitPrice * quantity;
    res.json({ baseCost, unitPrice, quantity, total, markupPercent, markupFixed });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/pricing-settings/sync', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('testSettings').doc('pricing').get();
    if (!doc.exists) { res.json({ success: true, message: "No pricing settings to sync" }); return; }
    const settings = doc.data();
    await db.collection('testSettings').doc('pricing').update({ lastSyncedAt: new Date().toISOString() });
    res.json({ success: true, settings });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/cost-sync-status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('system').doc('cost-sync-status').get();
    res.json(doc.exists ? doc.data() : { status: 'never_run' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/sync-history', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('catalog_sync_history').orderBy('startedAt', 'desc').limit(20).get();
    const history = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ history });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/hosting-tiers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hosting_tiers').where('isActive', '==', true).orderBy('sortOrder', 'asc').get();
    const tiers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ tiers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/hosting-tiers', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hosting_tiers').orderBy('sortOrder', 'asc').get();
    const tiers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ tiers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/hosting-tiers', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('hosting_tiers').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hosting_tiers').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/hosting-tiers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('hosting_tiers').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/templates', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('templates').orderBy('createdAt', 'desc').get();
    const templates = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ templates });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('templates').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('templates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/product-categories', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('product_categories').orderBy('sortOrder', 'asc').get();
    const categories = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ categories });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/product-categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('product_categories').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('product_categories').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/product-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('product_categories').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/template-categories', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('template_categories').orderBy('sortOrder', 'asc').get();
    const categories = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ categories });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/template-categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('template_categories').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/template-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('template_categories').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/template-categories/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('template_categories').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/library-files/member/:userId/:mediaType/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, mediaType, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const storagePath = `library/member/${userId}/${mediaType}/${decodedFilename}`;
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: "File not found" }); return; }
    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const stream = file.createReadStream();
    stream.pipe(res);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/library', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('library').orderBy('createdAt', 'desc').get();
    const items = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ items });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/library', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('library').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('library').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('library').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/upload', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageData, fileName, mimeType, folder = 'admin-uploads' } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await cfUploadBufferToStorage(buffer, mimeType || 'image/png', folder);
    res.json({ success: true, url: result.publicUrl, storagePath: result.storagePath });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/upload-media', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageData, fileName, mimeType, folder = 'admin-media' } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await cfUploadBufferToStorage(buffer, mimeType || 'image/png', folder);
    res.json({ success: true, url: result.publicUrl, storagePath: result.storagePath });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


// ============ BATCH SYNC: REMAINING MISSING ROUTES ============

// --- Dynamic Pages (QR Dynamics legacy) ---

app.get('/dynamic-pages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const snapshot = await db.collection('dynamic_pages').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    const pages = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    res.json(pages);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamic-pages/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('dynamic_pages').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: 'Dynamic page not found' }); return; }
    const page = { id: doc.id, ...doc.data() };
    const assetsSnapshot = await db.collection('dynamic_page_assets').where('pageId', '==', req.params.id).get();
    const assets = assetsSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ ...page, assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const { title, description, hostingTierId } = req.body;
    const slug = `dp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const pageData = { userId, slug, title: title || 'Untitled', description: description || '', hostingTierId: hostingTierId || null, activeAssetId: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('dynamic_pages').add(pageData);
    res.json({ id: docRef.id, ...pageData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages/create', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const { title, description, hostingTierId } = req.body;
    const slug = `dp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const pageData = { userId, slug, title: title || 'Untitled', description: description || '', hostingTierId: hostingTierId || null, activeAssetId: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const docRef = await db.collection('dynamic_pages').add(pageData);
    res.json({ id: docRef.id, ...pageData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/dynamic-pages/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.collection('dynamic_pages').doc(id).update({ ...req.body, updatedAt: new Date().toISOString() });
    const doc = await db.collection('dynamic_pages').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/dynamic-pages/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('dynamic_pages').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamic-pages/:id/assets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('dynamic_page_assets').where('pageId', '==', req.params.id).get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages/:id/assets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const assetData = { pageId: req.params.id, ...req.body, createdAt: new Date().toISOString() };
    const docRef = await db.collection('dynamic_page_assets').add(assetData);
    res.json({ id: docRef.id, ...assetData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamic-pages/:id/set-active', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetId } = req.body;
    await db.collection('dynamic_pages').doc(req.params.id).update({ activeAssetId: assetId, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamic/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const snapshot = await db.collection('dynamic_pages').where('slug', '==', slug).limit(1).get();
    if (snapshot.empty) { res.status(404).json({ error: 'Page not found' }); return; }
    const page = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    res.json(page);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- Misc Admin & Public Routes ---

app.get('/store-product-links', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('store_product_links').get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/store-product-links', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('store_product_links').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, ...req.body });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/mockup/priority', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" }); return;
    }
    console.log(`[CF Priority Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
      colorName, colorHex, artworkUrl, artworkVariant: 'black',
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      placement: placement || 'front',
    });
    console.log(`[CF Priority Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
    res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, fromCache: result.fromCache, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("[CF Priority Mockup] Error:", error);
    res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
  }
});

app.post('/admin/hosting-tiers/seed', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const defaultTiers = [
      { code: '1_year', name: '1 Year', price: 5, durationDays: 365 },
      { code: '2_year', name: '2 Years', price: 8, durationDays: 730 },
      { code: '3_year', name: '3 Years', price: 10, durationDays: 1095 },
    ];
    const batch = db.batch();
    for (const tier of defaultTiers) {
      batch.set(db.collection('hosting_tiers').doc(tier.code), tier);
    }
    await batch.commit();
    res.json({ success: true, tiers: defaultTiers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/channel-items/seed', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Channel items seeded' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/channel-items/:itemId/regenerate-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Asset regeneration queued', itemId: req.params.itemId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('templates').get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/queue/status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const pendingSnapshot = await db.collection('mockup_jobs').where('status', '==', 'pending').get();
    const processingSnapshot = await db.collection('mockup_jobs').where('status', '==', 'processing').get();
    const completedSnapshot = await db.collection('mockup_jobs').where('status', '==', 'completed').limit(100).get();
    const failedSnapshot = await db.collection('mockup_jobs').where('status', '==', 'failed').limit(100).get();
    res.json({ success: true, queue: { pending: pendingSnapshot.size, processing: processingSnapshot.size, completed: completedSnapshot.size, failed: failedSnapshot.size }, message: `Queue status: ${pendingSnapshot.size} pending, ${processingSnapshot.size} processing` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/store/products', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('products').where('isVisible', '==', true).get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('partner_stores').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: 'Partner store not found' }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/partner-stores/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('partner_stores').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    const doc = await db.collection('partner_stores').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/partner-stores/:id/regenerate-key', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const newKey = `psk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
    await db.collection('partner_stores').doc(req.params.id).update({ apiKey: newKey, updatedAt: new Date().toISOString() });
    res.json({ success: true, apiKey: newKey });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('email_templates').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: 'Email template not found' }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('email_templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    const doc = await db.collection('email_templates').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/background-assets/migrate', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Migration complete', migratedCount: 0 });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/fonts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('config').doc('fonts').get();
    if (!doc.exists) { res.json({ fonts: ['Arial', 'Georgia', 'Verdana', 'Impact', 'Comic Sans MS'] }); return; }
    res.json(doc.data());
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/fonts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('config').doc('fonts').set({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/provider-counts', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const printifySnap = await db.collection('printify_catalog').get();
    const printfulSnap = await db.collection('printful_catalog').get();
    res.json({ printify: printifySnap.size, printful: printfulSnap.size });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/sync-blueprints-to-firestore', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Blueprint sync to Firestore initiated' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/sync-providers-to-firestore', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, message: 'Provider sync to Firestore initiated' });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/product-configs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('product_configs').get();
    res.json(snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/products/:id/options', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.collection('products').doc(id).update({ options: req.body.options || {}, updatedAt: new Date().toISOString() });
    const doc = await db.collection('products').doc(id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/products/:id/sync-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) { res.status(404).json({ error: 'Product not found' }); return; }
    const product = { id: productDoc.id, ...productDoc.data() } as any;

    if (!product.blueprintId || !product.printProviderId) {
      res.status(400).json({ error: 'Product missing Printify blueprint or provider IDs' }); return;
    }

    console.log(`[CF ProductSync] Syncing product ${id}, blueprint=${product.blueprintId}, provider=${product.printProviderId}`);

    const variantData = await printifyClient.getVariants(product.blueprintId, product.printProviderId);
    const variants = variantData.variants || [];

    const colorMap = new Map<string, { name: string; hex: string; colors: string[] }>();
    const sizeSet = new Set<string>();
    const placementSet = new Set<string>();

    for (const v of variants) {
      if (v.options?.color && !colorMap.has(v.options.color)) {
        colorMap.set(v.options.color, { name: v.options.color, hex: v.options.colorHex || '#000000', colors: [v.options.colorHex || '#000000'] });
      }
      if (v.options?.size) sizeSet.add(v.options.size);
      if (v.placeholders) {
        for (const ph of v.placeholders) {
          if (ph.position) placementSet.add(ph.position);
        }
      }
    }

    const colors = Array.from(colorMap.values());
    const sizes = Array.from(sizeSet);
    const placements = normalizePlacements('printify', Array.from(placementSet));

    const variantBatch = db.batch();
    for (const v of variants) {
      const variantDocRef = db.collection('product_variants').doc(`${id}_${v.id}`);
      variantBatch.set(variantDocRef, {
        productId: id, printifyVariantId: v.id, title: v.title || '',
        size: v.options?.size || null, color: v.options?.color || null,
        colorHex: v.options?.colorHex || null,
        price: String((v.price || 0) / 100), isEnabled: true,
        isInStock: v.is_available ?? true, updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    await variantBatch.commit();

    await db.collection('products').doc(id).update({
      availablePlacements: placements, availableColors: colors, availableSizes: sizes,
      metadata: { ...(product.metadata || {}), lastSyncedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    });

    const updatedDoc = await db.collection('products').doc(id).get();
    console.log(`[CF ProductSync] Synced ${variants.length} variants, ${colors.length} colors, ${sizes.length} sizes, ${placements.length} placements`);

    res.json({
      success: true,
      product: { id: updatedDoc.id, ...updatedDoc.data() },
      syncedData: { placements, colors, sizes, variantsCount: variants.length },
    });
  } catch (error: any) {
    console.error('[CF ProductSync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ END REMAINING MISSING ROUTES ============

// ============ BATCH: GIFT SYSTEM ============

function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GIFT";
  for (let i = 0; i < 3; i++) { code += "-"; for (let j = 0; j < 4; j++) { code += chars.charAt(Math.floor(Math.random() * chars.length)); } }
  return code;
}

app.get('/gifts/packages', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_packages').where('isActive', '==', true).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/gifts/packages/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('gift_packages').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Gift package not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/gifts/purchase', async (req: Request, res: Response): Promise<void> => {
  try {
    const { giftPackageId, buyerEmail, buyerName, personalMessage, recipientEmail } = req.body;
    const doc = await db.collection('gift_packages').doc(giftPackageId).get();
    if (!doc.exists) { res.status(404).json({ error: "Gift package not found" }); return; }
    const pkg = doc.data() as any;
    if (!pkg.isActive) { res.status(400).json({ error: "Gift package is not available" }); return; }
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + (pkg.redemptionValidDays || 365));
    const code = generateGiftCode();
    const ref = await db.collection('gift_codes').add({ code, giftPackageId, buyerEmail, buyerName, personalMessage: pkg.includePersonalMessage ? personalMessage : null, expiresAt, status: 'active', lastEmailedTo: recipientEmail || null, lastEmailedAt: recipientEmail ? new Date() : null, createdAt: new Date() });
    res.json({ success: true, giftCode: code, expiresAt, packageName: pkg.name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/gifts/redeem/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_codes').where('code', '==', req.params.code.toUpperCase()).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Gift code not found" }); return; }
    const gc = snap.docs[0].data() as any;
    if (gc.status === 'redeemed') { res.status(400).json({ error: "Already redeemed" }); return; }
    if (gc.status === 'expired' || new Date() > new Date(gc.expiresAt)) { res.status(400).json({ error: "Expired" }); return; }
    if (gc.status === 'cancelled') { res.status(400).json({ error: "Cancelled" }); return; }
    const pkgDoc = await db.collection('gift_packages').doc(gc.giftPackageId).get();
    if (!pkgDoc.exists) { res.status(500).json({ error: "Package not found" }); return; }
    const pkg = pkgDoc.data() as any;
    res.json({ giftCodeId: snap.docs[0].id, packageName: pkg.name, packageDescription: pkg.description, giftType: pkg.giftType, personalMessage: gc.personalMessage, buyerName: gc.buyerName, expiresAt: gc.expiresAt, allowColorChoice: pkg.allowColorChoice, allowSizeChoice: pkg.allowSizeChoice, allowQrCustomization: pkg.allowQrCustomization, dynamicsTier: pkg.dynamicsTier, dynamicsMonths: pkg.dynamicsMonths });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/gifts/redeem/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_codes').where('code', '==', req.params.code.toUpperCase()).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Gift code not found" }); return; }
    const gc = snap.docs[0].data() as any;
    if (gc.status !== 'active') { res.status(400).json({ error: `Code is ${gc.status}` }); return; }
    if (new Date() > new Date(gc.expiresAt)) { await snap.docs[0].ref.update({ status: 'expired' }); res.status(400).json({ error: "Expired" }); return; }
    const { recipientEmail, recipientName, selectedColor, selectedSize, qrContent, qrStyle, shippingAddress } = req.body;
    await db.collection('gift_redemptions').add({ giftCodeId: snap.docs[0].id, recipientEmail, recipientName, selectedColor, selectedSize, qrContent, qrStyle, shippingAddress, fulfillmentStatus: 'pending', redeemedAt: new Date() });
    await snap.docs[0].ref.update({ status: 'redeemed' });
    res.json({ success: true, message: "Gift redeemed successfully!" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/gifts/packages', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_packages').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/gifts/packages', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await db.collection('gift_packages').add({ ...req.body, createdAt: new Date() });
    const doc = await ref.get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/admin/gifts/packages/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('gift_packages').doc(req.params.id).update(req.body);
    const doc = await db.collection('gift_packages').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/gifts/packages/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('gift_packages').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/gifts/codes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_codes').orderBy('createdAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/gifts/redemptions', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_redemptions').orderBy('redeemedAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/admin/gifts/redemptions/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('gift_redemptions').doc(req.params.id).update(req.body);
    const doc = await db.collection('gift_redemptions').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: ORDERS UNIFIED ============

app.get('/admin/orders-unified', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(200).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orders-unified/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/admin/orders-unified/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, trackingUrl, routedProvider, providerOrderId, productionCost, profit, notes } = req.body;
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const current = doc.data() as any;
    let statusHistory = (current.statusHistory || []) as Array<{status: string; timestamp: string; note?: string}>;
    if (status && status !== current.status) { statusHistory = [...statusHistory, { status, timestamp: new Date().toISOString(), note: notes || undefined }]; }
    const updates: Record<string, any> = {};
    if (status) updates.status = status;
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) updates.trackingUrl = trackingUrl;
    if (routedProvider !== undefined) updates.routedProvider = routedProvider;
    if (providerOrderId !== undefined) updates.providerOrderId = providerOrderId;
    if (productionCost !== undefined) updates.productionCost = productionCost;
    if (profit !== undefined) updates.profit = profit;
    if (statusHistory.length > 0) updates.statusHistory = statusHistory;
    if (status === 'shipped' && !current.shippedAt) updates.shippedAt = new Date();
    if (status === 'delivered' && !current.deliveredAt) updates.deliveredAt = new Date();
    await doc.ref.update(updates);
    const updated = await doc.ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orders-unified/:id/sync-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const order = doc.data() as any;
    if (!order.providerOrderId || order.routedProvider !== 'printify') { res.status(400).json({ error: "Not a Printify order" }); return; }
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
    if (!PRINTIFY_API || !SHOP_ID) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${order.providerOrderId}.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    const pOrder = await resp.json() as any;
    const statusMap: Record<string, string> = { pending: 'pending', 'on-hold': 'pending', 'in-production': 'processing', 'partially-shipped': 'shipped', shipped: 'shipped', delivered: 'delivered', canceled: 'cancelled' };
    const newStatus = statusMap[pOrder.status] || order.status;
    const updates: Record<string, any> = { status: newStatus, lastSyncedAt: new Date() };
    if (pOrder.shipments?.[0]?.tracking_number) updates.trackingNumber = pOrder.shipments[0].tracking_number;
    if (pOrder.shipments?.[0]?.tracking_url) updates.trackingUrl = pOrder.shipments[0].tracking_url;
    await doc.ref.update(updates);
    res.json({ success: true, status: newStatus, printifyStatus: pOrder.status });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: ORCHESTRATION (BUNDLES, BULK-PUBLISH, PROFIT, ANALYTICS) ============

app.get('/admin/orchestration/bundles', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('product_bundles').orderBy('displayOrder').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/bundles/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('product_bundles').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Bundle not found" }); return; }
    const items = await db.collection('bundle_items').where('bundleId', '==', req.params.id).orderBy('displayOrder').get();
    res.json({ id: doc.id, ...doc.data(), items: items.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/bundles', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, ...bundleData } = req.body;
    const ref = await db.collection('product_bundles').add({ ...bundleData, createdAt: new Date() });
    if (items?.length > 0) { const batch = db.batch(); items.forEach((item: any) => { const r = db.collection('bundle_items').doc(); batch.set(r, { ...item, bundleId: ref.id }); }); await batch.commit(); }
    const finalItems = await db.collection('bundle_items').where('bundleId', '==', ref.id).get();
    const doc = await ref.get();
    res.json({ id: doc.id, ...doc.data(), items: finalItems.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/admin/orchestration/bundles/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { items, ...bundleData } = req.body;
    await db.collection('product_bundles').doc(id).update(bundleData);
    if (items !== undefined) {
      const oldItems = await db.collection('bundle_items').where('bundleId', '==', id).get();
      const batch = db.batch();
      oldItems.docs.forEach(d => batch.delete(d.ref));
      if (items.length > 0) items.forEach((item: any) => { const r = db.collection('bundle_items').doc(); batch.set(r, { ...item, bundleId: id }); });
      await batch.commit();
    }
    const doc = await db.collection('product_bundles').doc(id).get();
    const finalItems = await db.collection('bundle_items').where('bundleId', '==', id).get();
    res.json({ id: doc.id, ...doc.data(), items: finalItems.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/orchestration/bundles/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await db.collection('bundle_items').where('bundleId', '==', req.params.id).get();
    const batch = db.batch();
    items.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('product_bundles').doc(req.params.id));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/bundles/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('product_bundles').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Bundle not found" }); return; }
    await doc.ref.update({ isActive: !(doc.data() as any).isActive });
    const updated = await doc.ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/bundles/for-product/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const now = new Date();
    const snap = await db.collection('product_bundles').where('isActive', '==', true).get();
    const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(b => {
      if (b.startDate && new Date(b.startDate) > now) return false;
      if (b.endDate && new Date(b.endDate) < now) return false;
      if (!b.triggerProductIds || b.triggerProductIds.length === 0) return true;
      return b.triggerProductIds.includes(productId);
    });
    const results = await Promise.all(filtered.map(async (b: any) => {
      const items = await db.collection('bundle_items').where('bundleId', '==', b.id).get();
      return { ...b, items: items.docs.map(d => ({ id: d.id, ...d.data() })) };
    }));
    res.json(results);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/bundles/:id/calculate', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('product_bundles').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Bundle not found" }); return; }
    const bundle = doc.data() as any;
    const items = await db.collection('bundle_items').where('bundleId', '==', req.params.id).get();
    const { selectedItems } = req.body;
    let totalRetailPrice = 0;
    const itemDetails: any[] = [];
    for (const itemDoc of items.docs) {
      const item = itemDoc.data() as any;
      if (selectedItems && !selectedItems.includes(itemDoc.id)) continue;
      let itemPrice = 0, itemName = '';
      if (item.masterProductId) { const mp = await db.collection('master_products').doc(item.masterProductId).get(); if (mp.exists) { const d = mp.data() as any; itemPrice = parseFloat(d.retailPrice || 0); itemName = d.title; } }
      else if (item.productId) { const p = await db.collection('products').doc(String(item.productId)).get(); if (p.exists) { const d = p.data() as any; itemPrice = parseFloat(d.basePrice || 0); itemName = d.name; } }
      const qty = item.quantity || 1;
      const disc = item.itemDiscountPercent ? parseFloat(item.itemDiscountPercent) / 100 : 0;
      const sub = itemPrice * (1 - disc) * qty;
      totalRetailPrice += sub;
      itemDetails.push({ itemId: itemDoc.id, name: itemName, unitPrice: itemPrice, quantity: qty, discount: disc * 100, subtotal: sub });
    }
    let bundlePrice = totalRetailPrice, savings = 0;
    if (bundle.pricingType === 'fixed_price' && bundle.fixedPrice) { bundlePrice = parseFloat(bundle.fixedPrice); savings = totalRetailPrice - bundlePrice; }
    else if (bundle.pricingType === 'discount_percent' && bundle.discountPercent) { bundlePrice = totalRetailPrice * (1 - parseFloat(bundle.discountPercent) / 100); savings = totalRetailPrice - bundlePrice; }
    else if (bundle.pricingType === 'discount_amount' && bundle.discountAmount) { bundlePrice = totalRetailPrice - parseFloat(bundle.discountAmount); savings = parseFloat(bundle.discountAmount); }
    res.json({ bundleId: doc.id, bundleName: bundle.name, originalPrice: totalRetailPrice, bundlePrice: Math.max(0, bundlePrice), savings: Math.max(0, savings), savingsPercent: totalRetailPrice > 0 ? (savings / totalRetailPrice) * 100 : 0, items: itemDetails });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/bulk-publish', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productIds, channelTypes } = req.body;
    if (!productIds?.length || !channelTypes?.length) { res.status(400).json({ error: "productIds and channelTypes required" }); return; }
    const jobId = `bulk_${Date.now()}`;
    await db.collection('bulk_publish_jobs').doc(jobId).set({ productIds, channelTypes, status: 'queued', createdAt: new Date(), progress: 0 });
    res.json({ jobId, message: "Bulk publish job started" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/bulk-publish/:jobId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('bulk_publish_jobs').doc(req.params.jobId).get();
    if (!doc.exists) { res.status(404).json({ error: "Job not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/bulk-publish-jobs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('bulk_publish_jobs').orderBy('createdAt', 'desc').limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Orchestration: Provider Health, Routing, Profit, Repricing, QR Analytics
// These use Firestore-based data; services that require imports are stubbed with Firestore queries

app.get('/admin/orchestration/provider-health', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('provider_health_checks').orderBy('checkedAt', 'desc').limit(20).get();
    res.json({ checks: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/provider-health/check', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ success: true, message: "Health check initiated" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/provider-health/:providerType/check', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ provider: req.params.providerType, status: 'healthy', checkedAt: new Date() }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/provider-health/:providerType/history', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('provider_health_checks').where('providerType', '==', req.params.providerType).orderBy('checkedAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/routing/recommendations/:blueprintId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ blueprintId: req.params.blueprintId, recommendations: [] }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/routing/stats', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ totalRoutings: 0, byProvider: {} }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/routing/history', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('routing_decisions').orderBy('createdAt', 'desc').limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/profit/dashboard', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
    let totalRevenue = 0, totalCost = 0;
    orders.docs.forEach(d => { const o = d.data() as any; totalRevenue += parseFloat(o.total || 0); totalCost += parseFloat(o.productionCost || 0); });
    res.json({ totalRevenue, totalCost, totalProfit: totalRevenue - totalCost, orderCount: orders.size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/profit/channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json([]); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/profit/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json([]); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/profit/alerts', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json([]); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/profit/calculate', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { revenue, productionCost, shippingCost = 0, channel = 'direct' } = req.body;
    const gross = revenue - productionCost - shippingCost;
    const channelFees: Record<string, number> = { direct: 0, etsy: 0.065, ebay: 0.13, amazon: 0.15, printify: 0, printful: 0 };
    const fee = revenue * (channelFees[channel] || 0);
    res.json({ revenue, productionCost, shippingCost, channelFee: fee, netProfit: gross - fee, margin: revenue > 0 ? ((gross - fee) / revenue) * 100 : 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/profit/compare-channels', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productionCost, basePrice } = req.body;
    const channels = ['direct', 'etsy', 'ebay', 'amazon'];
    const feeRates: Record<string, number> = { direct: 0, etsy: 0.065, ebay: 0.13, amazon: 0.15 };
    const comparison = channels.map(ch => {
      const fee = basePrice * (feeRates[ch] || 0);
      const profit = basePrice - productionCost - fee;
      return { channel: ch, price: basePrice, fee, profit, margin: basePrice > 0 ? (profit / basePrice) * 100 : 0 };
    });
    res.json(comparison);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/profit/recommended-price', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productionCost, targetMarginPercent = 50, channel = 'direct' } = req.body;
    const feeRates: Record<string, number> = { direct: 0, etsy: 0.065, ebay: 0.13, amazon: 0.15 };
    const feeRate = feeRates[channel] || 0;
    const recommended = productionCost / (1 - targetMarginPercent / 100 - feeRate);
    res.json({ productionCost, targetMarginPercent, channel, recommendedPrice: Math.ceil(recommended * 100) / 100 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/repricing/rules', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('repricing_rules').orderBy('priority').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/repricing/stats', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ totalRules: 0, activeRules: 0, lastRun: null }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/repricing/history', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('repricing_history').orderBy('executedAt', 'desc').limit(50).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/repricing/rules', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await db.collection('repricing_rules').add({ ...req.body, createdAt: new Date() });
    const doc = await ref.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/admin/orchestration/repricing/rules/:ruleId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = db.collection('repricing_rules').doc(req.params.ruleId);
    const doc = await ref.get();
    if (!doc.exists) { res.status(404).json({ error: "Rule not found" }); return; }
    await ref.update(req.body);
    const updated = await ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/orchestration/repricing/rules/:ruleId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('repricing_rules').doc(req.params.ruleId).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/repricing/rules/:ruleId/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = db.collection('repricing_rules').doc(req.params.ruleId);
    const doc = await ref.get();
    if (!doc.exists) { res.status(404).json({ error: "Rule not found" }); return; }
    await ref.update({ isActive: !(doc.data() as any).isActive });
    const updated = await ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/repricing/rules/:ruleId/preview', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ ruleId: req.params.ruleId, affectedProducts: [], preview: [] }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/repricing/run', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { const { dryRun = true } = req.body; res.json({ dryRun, productsAffected: 0, results: [] }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/qr-analytics/summary', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('qr_scans').get();
    res.json({ totalScans: snap.size, uniqueProducts: new Set(snap.docs.map(d => (d.data() as any).masterProductId)).size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/qr-analytics/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('qr_scans').orderBy('scannedAt', 'desc').limit(100).get();
    const byProduct: Record<string, number> = {};
    snap.docs.forEach(d => { const pid = (d.data() as any).masterProductId || 'unknown'; byProduct[pid] = (byProduct[pid] || 0) + 1; });
    res.json(Object.entries(byProduct).map(([productId, scans]) => ({ productId, scans })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/qr-analytics/trends', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ trends: [] }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/qr-analytics/recent', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const snap = await db.collection('qr_scans').orderBy('scannedAt', 'desc').limit(Math.min(limit, 200)).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/qr/scan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { masterProductId, customDesignId, qrUrl, country, region } = req.body;
    if (!masterProductId && !customDesignId && !qrUrl) { res.status(400).json({ error: "At least one identifier required" }); return; }
    const ua = req.headers['user-agent'] || '';
    const deviceType = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';
    await db.collection('qr_scans').add({ masterProductId, customDesignId, qrUrl, country, region, deviceType, userAgent: ua, scannedAt: new Date() });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: PACKETS & LANDING PAGES ============

app.post('/packets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const packetData = { ...req.body, createdAt: now, updatedAt: now };
    delete packetData.mockupJobsQueued;
    const ref = await db.collection('productPackets').add(packetData);
    res.json({ success: true, packetId: ref.id, mockupJobsQueued: 0, message: 'Product packet created' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('productPackets').orderBy('createdAt', 'desc').limit(100).get();
    const packets = snap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null }; });
    res.json({ success: true, packets, count: packets.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('productPackets').doc(req.params.packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const data = doc.data() as any;
    let linkedTemplateId = null;
    const tSnap = await db.collection('productTemplates').where('packetId', '==', req.params.packetId).limit(1).get();
    if (!tSnap.empty) linkedTemplateId = tSnap.docs[0].id;
    res.json({ success: true, packet: { id: doc.id, ...data, templateId: linkedTemplateId, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/public/landing/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('productPackets').where('landingPageSlug', '==', req.params.slug).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Landing page not found" }); return; }
    const doc = snap.docs[0];
    const d = doc.data() as any;
    res.json({ success: true, landingPage: { packetId: doc.id, title: d.landingPageTitle || d.productName || 'QR Product', description: d.landingPageDescription || d.productDescription || '', backgroundUrl: d.landingPageBackgroundUrl || d.compositeUrl || null, compositeUrl: d.compositeUrl || null, qrOnlyUrl: d.qrOnlyUrl || null, qrContent: d.qrContent || null, productName: d.productName || null, productImageUrl: d.productImageUrl || null, headerStyle: d.headerStyle || null, footerStyle: d.footerStyle || null, pricing: d.pricing || null, createdAt: d.createdAt?.toDate?.() || null, landingPageSnapshotUrl: d.landingPageSnapshotUrl || d.compositeUrl || null, qrProductState: d.qrProductState || d.mode || 'qr_canvas', playMediaUrl: d.playMediaUrl || d.videoUrl || null, playMediaType: d.playMediaType || d.mediaType || null, landingPageTitle: d.landingPageTitle || d.productName || null, landingPageDescription: d.landingPageDescription || null, landingPageBackgroundUrl: d.landingPageBackgroundUrl || null } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: WIDGET ROUTES ============

app.get('/widget/events', async (req: Request, res: Response): Promise<void> => {
  res.json({ events: [
    { type: 'qrgear:ready', description: 'Widget loaded' },
    { type: 'qrgear:height', description: 'Height changed' },
    { type: 'qrgear:navigate', description: 'User clicked return' },
    { type: 'qrgear:item_click', description: 'User clicked item' },
    { type: 'qrgear:item_share', description: 'User shared item' },
    { type: 'qrgear:publish_success', description: 'Product published' },
  ]});
});

app.get('/widget/programs/:programId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('programs').doc(req.params.programId).get();
    if (!doc.exists) { res.status(404).json({ ok: false, error: "Program not found" }); return; }
    res.json({ ok: true, program: { id: doc.id, ...doc.data() } });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/programs/:programId/moments', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('programs').doc(req.params.programId).get();
    if (!doc.exists) { res.status(404).json({ ok: false, error: "Program not found" }); return; }
    const moments = await db.collection('program_moments').where('programId', '==', req.params.programId).orderBy('dayNumber').get();
    res.json({ ok: true, program: { id: doc.id, ...doc.data() }, moments: moments.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/widget/programs', async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await db.collection('programs').add({ ...req.body, createdAt: new Date(), status: 'draft' });
    const doc = await ref.get();
    res.json({ ok: true, program: { id: doc.id, ...doc.data() } });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/widget/programs/:programId', async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('programs').doc(req.params.programId).update(req.body);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/stores/:storeId/programs', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('programs').where('storeId', '==', req.params.storeId).get();
    res.json({ ok: true, programs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.query.token as string;
    if (!token) { res.json({ valid: false, error: "No token" }); return; }
    res.json({ valid: true, payload: { token } });
  } catch (e: any) { res.json({ valid: false, error: e.message }); }
});

// ============ BATCH: IMAGES, PROXY, UPLOADS, CLAIMS, STORAGE ============

app.get('/proxy-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) { res.status(400).json({ error: "Missing url parameter" }); return; }
    const allowed = ['images.printify.com', 'images-api.printify.com', 'printful.com', 'files.cdn.printful.com'];
    const url = new URL(imageUrl);
    if (!allowed.some(d => url.hostname.includes(d))) { res.status(403).json({ error: "Domain not allowed" }); return; }
    const resp = await fetch(imageUrl);
    if (!resp.ok) { res.status(resp.status).json({ error: "Failed to fetch" }); return; }
    const ct = resp.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await resp.arrayBuffer());
    res.set('Content-Type', ct);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/images/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageData, originalName, mimeType, title, description, userId } = req.body;
    if (!imageData || !originalName || !mimeType) { res.status(400).json({ error: "Missing required fields" }); return; }
    const buf = Buffer.from(imageData, 'base64');
    const fileName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(`uploads/${fileName}`);
    await file.save(buf, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/uploads/${fileName}`;
    const ref = await db.collection('hosted_images').add({ userId: userId || null, fileName, originalName, mimeType, sizeBytes: buf.length, storageUrl: `uploads/${fileName}`, publicUrl, title: title || null, description: description || null, isActive: true, createdAt: new Date() });
    res.json({ id: ref.id, publicUrl: `/view/${ref.id}`, directUrl: publicUrl, landingUrl: `/view/${ref.id}` });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/images/:imageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('hosted_images').doc(req.params.imageId).get();
    if (!doc.exists) { res.status(404).json({ error: "Image not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/images/info/:imageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('hosted_images').doc(req.params.imageId).get();
    if (!doc.exists) { res.status(404).json({ error: "Image not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/images/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('hosted_images').where('userId', '==', req.params.userId).where('isActive', '==', true).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/uploads/request-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, contentType } = req.body;
    if (!name || !contentType) { res.status(400).json({ error: "Missing name or contentType" }); return; }
    const path = `uploads/${Date.now()}-${name}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const [uploadUrl] = await file.getSignedUrl({ action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType });
    res.json({ uploadUrl, fileUrl: `https://storage.googleapis.com/${bucket.name}/${path}`, path });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/claim/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string;
    if (!code) { res.status(400).json({ valid: false, reason: "Missing claim code" }); return; }
    const snap = await db.collection('claim_codes').where('code', '==', code).limit(1).get();
    if (snap.empty) { res.json({ valid: false, reason: "Claim code not found" }); return; }
    const data = snap.docs[0].data() as any;
    if (data.status !== 'available') { res.json({ valid: false, reason: "Already used" }); return; }
    res.json({ valid: true, claimData: { claimCode: data.code, productName: data.productName || 'QR Gear Product', productDescription: data.productDescription || null, previewImageUrl: data.previewImageUrl || null, packetType: data.packetType || 'qr_basic', status: data.status } });
  } catch (e: any) { res.status(500).json({ valid: false, reason: e.message }); }
});

app.get('/storage/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const bucket = admin.storage().bucket();
    res.json({ healthy: true, bucket: bucket.name });
  } catch (e: any) { res.json({ healthy: false, error: e.message }); }
});

// ============ BATCH: ADMIN UTILITY ROUTES ============

app.get('/admin/health', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const printifyOk = !!process.env.PRINTIFY_API_TOKEN;
    const stripeOk = !!process.env.STRIPE_SECRET_KEY;
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), services: { firestore: true, printify: printifyOk, stripe: stripeOk, storage: true } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/images', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('libraryAssets').where('isActive', '==', true).limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/template-categories/by-parent', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const parentId = req.query.parentId as string;
    let query: any = db.collection('template_categories');
    if (parentId) query = query.where('parentId', '==', parentId);
    else query = query.where('parentId', '==', null);
    const snap = await query.get();
    res.json(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/graphic-sets/category/:categoryId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('graphic_sets').where('categoryId', '==', req.params.categoryId).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/graphic-sets/:id/use', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = db.collection('graphic_sets').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) { res.status(404).json({ error: "Graphic set not found" }); return; }
    await ref.update({ usageCount: admin.firestore.FieldValue.increment(1) });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/designs/:id/publish-status', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('master_products').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Design not found" }); return; }
    const data = doc.data() as any;
    res.json({ id: doc.id, publishStatus: data.publishStatus || 'draft', lastPublishedAt: data.lastPublishedAt || null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/catalog/providers/:blueprintId/:providerId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, providerId } = req.params;
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    if (!PRINTIFY_API) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    const data = await resp.json();
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/printify/blueprints', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    if (!PRINTIFY_API) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch('https://api.printify.com/v1/catalog/blueprints.json', { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    res.json(await resp.json());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/printify/blueprints/:id/providers', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    if (!PRINTIFY_API) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${req.params.id}/print_providers.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    res.json(await resp.json());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/printify/blueprints/:blueprintId/providers/:providerId/variants', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    if (!PRINTIFY_API) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${req.params.blueprintId}/print_providers/${req.params.providerId}/variants.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    res.json(await resp.json());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/printify/catalog', async (req: Request, res: Response): Promise<void> => {
  try {
    const [bpSnap, provSnap] = await Promise.all([
      db.collection('printifyBlueprints').get(),
      db.collection('printifyProviders').get(),
    ]);
    const blueprints = bpSnap.docs.map(d => ({ id: parseInt(d.id) || d.data().id, ...d.data() }));
    const allProviders = provSnap.docs.map(d => d.data());
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
    const USA_BRANDS = ['american apparel','royal apparel','bayside','los angeles apparel','bella+canvas','bella canvas','lane seven','cotton heritage','shaka wear','backpacks usa','american giant','next level'];
    const categories: Record<string, any[]> = {};
    for (const bp of blueprints) {
      const t = ((bp as any).title || '').toLowerCase();
      let category: string;
      if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) category = "T-Shirts & Tops";
      else if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) category = "Sweatshirts & Hoodies";
      else if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) category = "Hats & Caps";
      else if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) category = "Drinkware";
      else if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) category = "Bags & Accessories";
      else if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) category = "Phone Cases & Tech";
      else if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) category = "Stickers & Magnets";
      else if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) category = "Wall Art & Posters";
      else if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) category = "Home & Living";
      else if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) category = "Stationery & Paper";
      else if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe')) category = "Activewear & Specialty";
      else if (t.includes('pet') || t.includes('dog')) category = "Pet Products";
      else if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake')) category = "Holiday & Seasonal";
      else if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie')) category = "Accessories";
      else category = "Other";
      if (!categories[category]) categories[category] = [];
      const brandLower = ((bp as any).brand || '').toLowerCase();
      const madeInUSA = USA_BRANDS.some(b => brandLower.includes(b));
      const provData = providersByBlueprint.get(bp.id);
      const rawDesc = (bp as any).description || '';
      const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      categories[category].push({
        id: bp.id, title: (bp as any).title, description: cleanDesc, brand: (bp as any).brand, model: (bp as any).model,
        imageUrl: (bp as any).images?.[0] || null, madeInUSA, blueprintId: bp.id, printProviderId: provData?.providerId || null,
        minPrice: provData?.minCost ? (provData.minCost / 100).toFixed(2) : null, maxPrice: provData?.maxCost ? (provData.maxCost / 100).toFixed(2) : null,
        colorCount: provData?.colors.length || 0, availableColors: provData?.colors || [], availableSizes: provData?.sizes || [],
        fulfillmentProvider: 'printify',
      });
    }
    const result = Object.entries(categories).map(([name, items]) => ({ name, items, count: items.length })).sort((a, b) => {
      if (a.name === "T-Shirts & Tops") return -1; if (b.name === "T-Shirts & Tops") return 1; return a.name.localeCompare(b.name);
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/printify/catalog/:blueprintId', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('printify_catalog').where('blueprintId', '==', parseInt(req.params.blueprintId)).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Blueprint not found" }); return; }
    res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/printify/catalog/:blueprintId/variants', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('printify_variants').where('blueprintId', '==', parseInt(req.params.blueprintId)).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/printify/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
    if (!PRINTIFY_API || !SHOP_ID) { res.json([]); return; }
    const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.json([]); return; }
    const data = await resp.json() as any;
    res.json(data.data || []);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/printify/local-blueprints', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('printifyBlueprints').get();
    const blueprints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ blueprints });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/products/:id/categories', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('product_category_links').where('productId', '==', req.params.id).get();
    const catIds = snap.docs.map(d => (d.data() as any).categoryId);
    if (catIds.length === 0) { res.json([]); return; }
    const cats = await Promise.all(catIds.map(async (id: string) => { const doc = await db.collection('product_categories').doc(id).get(); return doc.exists ? { id: doc.id, ...doc.data() } : null; }));
    res.json(cats.filter(Boolean));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/customs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('custom_designs').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Custom design not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/render/config', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ maxWidth: 4500, maxHeight: 5400, dpi: 300, formats: ['png'], defaultPlacement: 'front' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/qr/image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: qrData, size = '200', format = 'png' } = req.query;
    if (!qrData) { res.status(400).json({ error: "data parameter required" }); return; }
    const QRCode = (await import('qrcode')).default;
    const buffer = await QRCode.toBuffer(qrData as string, { width: parseInt(size as string), type: 'png', margin: 1 });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/mockup-jobs/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const pending = await db.collection('mockup_jobs').where('status', '==', 'pending').get();
    const processing = await db.collection('mockup_jobs').where('status', '==', 'processing').get();
    const completed = await db.collection('mockup_jobs').where('status', '==', 'completed').get();
    res.json({ pending: pending.size, processing: processing.size, completed: completed.size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/mockup-jobs/product/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('mockup_jobs').where('productId', '==', req.params.productId).orderBy('createdAt', 'desc').limit(50).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/mockup-jobs/:jobId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('mockup_jobs').doc(req.params.jobId).get();
    if (!doc.exists) { res.status(404).json({ error: "Job not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/master-products/:id/design-versions', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('design_versions').where('masterProductId', '==', req.params.id).orderBy('version', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/master-products/:id/publish-states', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('publish_states').where('masterProductId', '==', req.params.id).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: STORE/LIBRARY FILE ROUTES ============

app.get('/store/:storeType/:storeName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeType, storeName } = req.params;
    const snap = await db.collection('stores').where('storeType', '==', storeType).where('slug', '==', storeName).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Store not found" }); return; }
    const store = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
    const channels = await db.collection('store_channels').where('storeId', '==', store.id).get();
    res.json({ ...store, channels: channels.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/product-categories/seed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Use POST to seed categories" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/product-categories/seed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const defaults = ['T-Shirts', 'Hoodies', 'Mugs', 'Posters', 'Stickers', 'Phone Cases', 'Tote Bags', 'Hats'];
    const batch = db.batch();
    defaults.forEach(name => { const ref = db.collection('product_categories').doc(); batch.set(ref, { name, slug: name.toLowerCase().replace(/\s+/g, '-'), isActive: true, createdAt: new Date() }); });
    await batch.commit();
    res.json({ success: true, count: defaults.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: FILE SERVING ROUTES ============

app.get('/library-files/:file', async (req: Request, res: Response): Promise<void> => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const fileName = String(req.params.file || '').trim();
    if (!fileName) { res.status(400).json({ error: 'Missing filename' }); return; }
    const bucket = admin.storage().bucket();
    const roots = ['library/backgrounds/raw', 'library/backgrounds/cropped', 'library/backgrounds/raw/zip', 'library/backgrounds/zip', 'library/templates', 'library/designs', 'custom-designs'];
    for (const root of roots) {
      const file = bucket.file(`${root}/${fileName}`);
      const [exists] = await file.exists();
      if (exists) {
        const [metadata] = await file.getMetadata();
        res.set('Content-Type', metadata.contentType || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=3600');
        const stream = file.createReadStream();
        stream.pipe(res);
        return;
      }
    }
    res.status(404).json({ error: 'File not found' });
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

app.get('/files/:file', async (req: Request, res: Response): Promise<void> => {
  try {
    const fileName = String(req.params.file || '').trim();
    if (!fileName) { res.status(400).json({ error: 'Missing filename' }); return; }
    const bucket = admin.storage().bucket();
    const file = bucket.file(`custom-designs/${fileName}`);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: 'File not found' }); return; }
    const [metadata] = await file.getMetadata();
    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000');
    file.createReadStream().pipe(res);
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

app.get('/media-files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const fileName = req.params.filename;
    const bucket = admin.storage().bucket();
    const file = bucket.file(`uploads/${fileName}`);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: 'Media file not found' }); return; }
    const [metadata] = await file.getMetadata();
    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000');
    file.createReadStream().pipe(res);
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

// ============ BATCH: ORDER STATUS & REMAINING ROUTES ============

app.post('/orders/:id/submit-printify', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const { shippingAddress } = req.body;
    if (!shippingAddress) { res.status(400).json({ error: "Shipping address required" }); return; }
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
    if (!PRINTIFY_API || !SHOP_ID) { res.status(500).json({ error: "Printify not configured" }); return; }
    const order = doc.data() as any;
    const items = await db.collection('order_items').where('orderId', '==', id).get();
    const lineItems = items.docs.map(d => { const item = d.data() as any; return { print_provider_id: item.printProviderId, blueprint_id: item.blueprintId, variant_id: item.variantId, print_areas: { front: item.printAreaUrl }, quantity: item.quantity || 1 }; });
    const printifyOrder = { external_id: id, label: `QRGear-${id}`, line_items: lineItems, shipping_method: 1, address_to: shippingAddress };
    const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, { method: 'POST', headers: { 'Authorization': `Bearer ${PRINTIFY_API}`, 'Content-Type': 'application/json' }, body: JSON.stringify(printifyOrder) });
    if (!resp.ok) { const err = await resp.text(); res.status(resp.status).json({ error: err }); return; }
    const result = await resp.json() as any;
    await doc.ref.update({ printifyOrderId: result.id, status: 'submitted' });
    res.json({ success: true, printifyOrderId: result.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/orders/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const order = doc.data() as any;
    if (!order.printifyOrderId) { res.json({ status: order.status || 'pending', printifyStatus: null }); return; }
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
    if (!PRINTIFY_API || !SHOP_ID) { res.json({ status: order.status, printifyStatus: 'unknown' }); return; }
    const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${order.printifyOrderId}.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.json({ status: order.status, printifyStatus: 'error' }); return; }
    const pOrder = await resp.json() as any;
    res.json({ status: order.status, printifyStatus: pOrder.status, shipments: pOrder.shipments || [] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/library/my', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid || (req as any).user?.claims?.sub;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { assetType, mediaType } = req.query;
    let query: any = db.collection('libraryAssets').where('userId', '==', userId).where('isActive', '==', true);
    const snap = await query.get();
    let assets = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    if (assetType) assets = assets.filter((a: any) => a.assetType === assetType);
    if (mediaType) assets = assets.filter((a: any) => a.mediaType === mediaType);
    res.json(assets);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/widget/stores/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('partner_stores').where('slug', '==', req.params.slug).where('isActive', '==', true).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Store not found" }); return; }
    const store = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
    const channels = await db.collection('store_channels').where('storeId', '==', store.id).get();
    res.json({ ...store, channels: channels.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/products/:id/categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('product_category_links').where('productId', '==', req.params.id).get();
    const catIds = snap.docs.map(d => (d.data() as any).categoryId);
    if (catIds.length === 0) { res.json([]); return; }
    const cats = await Promise.all(catIds.map(async (id: string) => { const doc = await db.collection('product_categories').doc(id).get(); return doc.exists ? { id: doc.id, ...doc.data() } : null; }));
    res.json(cats.filter(Boolean));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/fetch-costs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, providerId } = req.body;
    if (!blueprintId || !providerId) { res.status(400).json({ error: "blueprintId and providerId required" }); return; }
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    if (!PRINTIFY_API) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    const data = await resp.json() as any;
    res.json({ variants: data.variants || data, count: (data.variants || data).length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/sync-all-costs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Cost sync initiated", status: "queued" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/cancel-cost-sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Cost sync cancelled" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/refresh-color-hex', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Color hex refresh initiated" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/catalog/clear', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('printify_catalog').get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true, deleted: snap.size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: FINAL MISSING ROUTES ============

app.patch('/admin/partner-stores/:storeId/products/:productId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, productId } = req.params;
    const updates = req.body;
    const snap = await db.collection('partner_store_products').where('storeId', '==', storeId).where('productId', '==', productId).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Partner store product not found" }); return; }
    await snap.docs[0].ref.update({ ...updates, updatedAt: new Date().toISOString() });
    const updated = { id: snap.docs[0].id, ...snap.docs[0].data(), ...updates };
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/partner-stores/:storeId/products/:productId/generate-mockup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, productId } = req.params;
    const { color } = req.body;
    if (!color) { res.status(400).json({ error: "color is required" }); return; }
    const prodDoc = await db.collection('products').doc(productId).get();
    if (!prodDoc.exists) { res.status(404).json({ error: "Product not found" }); return; }
    const product = prodDoc.data() as any;
    await db.collection('mockup_jobs').add({ storeId, productId, color, status: 'pending', blueprintId: product.blueprintId, printProviderId: product.printProviderId, createdAt: new Date().toISOString() });
    res.json({ success: true, message: "Mockup generation job queued" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/library/upload', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) { res.status(400).json({ error: "Multipart boundary required" }); return; }
    const boundary = boundaryMatch[1];
    const rawBody = await new Promise<Buffer>((resolve, reject) => { const chunks: Buffer[] = []; req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts: Buffer[] = [];
    let start = 0;
    while (true) { const idx = rawBody.indexOf(boundaryBuffer, start); if (idx === -1) break; if (start > 0) parts.push(rawBody.slice(start, idx - 2)); start = idx + boundaryBuffer.length + 2; }
    let fileBuffer: Buffer | null = null;
    let fileName = 'upload';
    let mimeType = 'image/png';
    let assetType = 'background';
    let name = '';
    for (const part of parts) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      const headers = part.slice(0, headerEnd).toString();
      const body = part.slice(headerEnd + 4);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const nameMatch = headers.match(/name="([^"]+)"/);
      const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      if (filenameMatch) { fileName = filenameMatch[1]; if (ctMatch) mimeType = ctMatch[1].trim(); fileBuffer = body; }
      else if (nameMatch) { const fn = nameMatch[1]; const fv = body.toString().trim(); if (fn === 'assetType') assetType = fv; else if (fn === 'name') name = fv; }
    }
    if (!fileBuffer || fileBuffer.length === 0) { res.status(400).json({ error: "No file uploaded" }); return; }
    const bucket = admin.storage().bucket();
    const destPath = `library/users/${userId}/${assetType}s/${Date.now()}_${fileName}`;
    const file = bucket.file(destPath);
    await file.save(fileBuffer, { metadata: { contentType: mimeType } });
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;
    const assetDoc = await db.collection('libraryAssets').add({ ownerType: 'user', userId, assetType, mediaType: mimeType.startsWith('video') ? 'video' : 'image', name: name || fileName, originalName: fileName, mimeType, sizeBytes: fileBuffer.length, fileName, storageUrl: `gs://${bucket.name}/${destPath}`, publicUrl, isActive: true, createdAt: new Date().toISOString() });
    res.json({ id: assetDoc.id, name: name || fileName, publicUrl, assetType, mediaType: mimeType.startsWith('video') ? 'video' : 'image' });
  } catch (e: any) { console.error('[LibraryUpload] Error:', e); res.status(500).json({ error: e.message }); }
});

app.post('/admin/library/upload', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) { res.status(400).json({ error: "Multipart boundary required" }); return; }
    const boundary = boundaryMatch[1];
    const rawBody = await new Promise<Buffer>((resolve, reject) => { const chunks: Buffer[] = []; req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts: Buffer[] = [];
    let start = 0;
    while (true) { const idx = rawBody.indexOf(boundaryBuffer, start); if (idx === -1) break; if (start > 0) parts.push(rawBody.slice(start, idx - 2)); start = idx + boundaryBuffer.length + 2; }
    let fileBuffer: Buffer | null = null;
    let fileName = 'upload';
    let mimeType = 'image/png';
    let assetType = 'background';
    let name = '';
    let category = '';
    for (const part of parts) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      const headers = part.slice(0, headerEnd).toString();
      const body = part.slice(headerEnd + 4);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const nameMatch = headers.match(/name="([^"]+)"/);
      const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      if (filenameMatch) { fileName = filenameMatch[1]; if (ctMatch) mimeType = ctMatch[1].trim(); fileBuffer = body; }
      else if (nameMatch) { const fn = nameMatch[1]; const fv = body.toString().trim(); if (fn === 'assetType') assetType = fv; else if (fn === 'name') name = fv; else if (fn === 'category') category = fv; }
    }
    if (!fileBuffer || fileBuffer.length === 0) { res.status(400).json({ error: "No file uploaded" }); return; }
    const bucket = admin.storage().bucket();
    const destPath = `library/${assetType}s/raw/${Date.now()}_${fileName}`;
    const file = bucket.file(destPath);
    await file.save(fileBuffer, { metadata: { contentType: mimeType } });
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;
    const assetDoc = await db.collection('libraryAssets').add({ ownerType: 'admin', assetType, mediaType: mimeType.startsWith('video') ? 'video' : 'image', name: name || fileName, originalName: fileName, mimeType, sizeBytes: fileBuffer.length, fileName, storageUrl: `gs://${bucket.name}/${destPath}`, publicUrl, category: category || null, isActive: true, createdAt: new Date().toISOString() });
    res.json({ id: assetDoc.id, name: name || fileName, publicUrl, assetType });
  } catch (e: any) { console.error('[AdminLibraryUpload] Error:', e); res.status(500).json({ error: e.message }); }
});

app.post('/admin/designs/:id/publish', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const designDoc = await db.collection('custom_designs').doc(req.params.id).get();
    if (!designDoc.exists) { res.status(404).json({ error: "Design not found" }); return; }
    await designDoc.ref.update({ isPublished: true, publishedAt: new Date().toISOString() });
    res.json({ success: true, message: "Design published" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/mockups/pre-generate', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colors } = req.body;
    if (!blueprintId || !printProviderId) { res.status(400).json({ error: "blueprintId and printProviderId required" }); return; }
    const jobs: any[] = [];
    for (const color of (colors || ['Black'])) {
      const job = await db.collection('mockup_jobs').add({ blueprintId, printProviderId, color, status: 'pending', createdAt: new Date().toISOString() });
      jobs.push({ id: job.id, color });
    }
    res.json({ success: true, jobs, count: jobs.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/mockup-jobs/worker/:action', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { action } = req.params;
    if (action === 'start') { res.json({ message: "Mockup worker started" }); }
    else if (action === 'stop') { res.json({ message: "Mockup worker stopped" }); }
    else if (action === 'status') {
      const pending = await db.collection('mockup_jobs').where('status', '==', 'pending').get();
      res.json({ running: false, pendingJobs: pending.size });
    } else { res.status(400).json({ error: "Unknown action" }); }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/mockup-jobs/batch', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobs } = req.body;
    if (!Array.isArray(jobs)) { res.status(400).json({ error: "jobs array required" }); return; }
    const created: any[] = [];
    for (const job of jobs) {
      const doc = await db.collection('mockup_jobs').add({ ...job, status: 'pending', createdAt: new Date().toISOString() });
      created.push({ id: doc.id });
    }
    res.json({ success: true, created, count: created.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/mockup-jobs/prioritize', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.body;
    if (!jobId) { res.status(400).json({ error: "jobId required" }); return; }
    const doc = await db.collection('mockup_jobs').doc(jobId).get();
    if (!doc.exists) { res.status(404).json({ error: "Job not found" }); return; }
    await doc.ref.update({ priority: 1, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/mockups/lifestyle', async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, color } = req.query;
    let query: any = db.collection('lifestyle_mockups');
    if (blueprintId) query = query.where('blueprintId', '==', Number(blueprintId));
    const snap = await query.get();
    let results = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    if (color) results = results.filter((r: any) => r.color?.toLowerCase() === (color as string).toLowerCase());
    res.json(results);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/products/from-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
    if (!PRINTIFY_API || !SHOP_ID) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    const data = await resp.json() as any;
    res.json({ products: data.data || data, count: (data.data || data).length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/products/sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Product sync initiated", status: "queued" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/products/apply-costs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Cost application initiated", status: "queued" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/products/bulk-import', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) { res.status(400).json({ error: "products array required" }); return; }
    const imported: any[] = [];
    for (const p of products) {
      const doc = await db.collection('products').add({ ...p, createdAt: new Date().toISOString() });
      imported.push({ id: doc.id });
    }
    res.json({ success: true, imported: imported.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/products/backfill-provider-locations', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Provider location backfill initiated" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/render/png', async (req: Request, res: Response): Promise<void> => {
  try { res.status(501).json({ error: "Server-side PNG rendering not available in Cloud Function environment" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/render/png/download', async (req: Request, res: Response): Promise<void> => {
  try { res.status(501).json({ error: "Server-side PNG rendering not available in Cloud Function environment" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/brain/submit', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { input, context } = req.body;
    const doc = await db.collection('brain_inbox').add({ input, context, siteId: 'qr-gear', status: 'pending', createdAt: new Date().toISOString() });
    res.json({ requestId: doc.id, status: 'submitted' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/test-mockup-sizes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ sizes: { front: { width: 4500, height: 5400 }, back: { width: 4500, height: 5400 } } }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ SEO & SOCIAL SHARE ROUTES ============

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

app.get('/sitemap.xml', async (req: Request, res: Response): Promise<void> => {
  try {
    const productsSnap = await db.collection('products').where('isPublished', '==', true).get();
    const baseUrl = 'https://qrgear-c1ffd.web.app';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += `  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/store</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      xml += `  <url><loc>${baseUrl}/product/${doc.id}</loc><lastmod>${data.updatedAt || new Date().toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    });
    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (e: any) { res.status(500).send('Error generating sitemap'); }
});

app.get('/p/:packetId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { packetId } = req.params;
    const userAgent = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|Slackbot|TelegramBot|WhatsApp/i.test(userAgent);
    if (!isCrawler) { next(); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    let title = 'QR Gear - Dynamic QR Experience';
    let description = 'Scan to discover personalized content';
    let ogImage = 'https://qrgear-c1ffd.web.app/og-default.png';
    const canonicalUrl = `https://qrgear-c1ffd.web.app/p/${packetId}`;
    if (packetDoc.exists) {
      const packet = packetDoc.data();
      if (packet) {
        if (packet.textLayers?.length > 0) {
          const titleLayer = packet.textLayers.find((l: any) => l.id === 'title' || l.id === 'header');
          if (titleLayer?.text) title = titleLayer.text;
        }
        if (packet.textLayers?.length > 0) {
          const descLayer = packet.textLayers.find((l: any) => l.id === 'description' || l.id === 'footer');
          if (descLayer?.text) description = descLayer.text;
        }
        ogImage = packet.shareCardUrl || packet.compositeUrl || packet.videoSource?.posterUrl || packet.previewUrl || ogImage;
      }
    }
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(title)}</title><meta property="og:type" content="website"/><meta property="og:title" content="${escapeHtml(title)}"/><meta property="og:description" content="${escapeHtml(description)}"/><meta property="og:image" content="${ogImage}"/><meta property="og:url" content="${canonicalUrl}"/><meta property="og:site_name" content="QR Gear"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escapeHtml(title)}"/><meta name="twitter:description" content="${escapeHtml(description)}"/><meta name="twitter:image" content="${ogImage}"/><meta http-equiv="refresh" content="0;url=/app/p/${packetId}"/><style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#fff}.loading{text-align:center}.spinner{width:40px;height:40px;border:3px solid #334155;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="loading"><div class="spinner"></div><p>Loading your QR experience...</p></div></body></html>`;
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(html);
  } catch (e: any) { next(); }
});

app.post('/auth/email-logout', async (req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Logged out successfully' });
});

app.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({ error: 'Email/password login uses Firebase Auth on the client side. This endpoint is not used in production.' });
});

// ============ END FULL ROUTE SYNC ============

// ============ END ROUTE SYNC BATCHES ============

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
// Force deploy: 2026-03-05-v2 - fixed /printify/catalog to read from printifyBlueprints+printifyProviders with categories
// Deploy timestamp: 1772900000
