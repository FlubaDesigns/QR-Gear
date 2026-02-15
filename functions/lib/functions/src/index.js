"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
// Build timestamp: 2026-01-27T06:30:00Z - Added PRINTFUL_STORE_ID to mockup generator API calls
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
const resend_1 = require("resend");
// NexusMail imports
const nexusmail_1 = require("./nexusmail");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const storage = admin.storage();
// ============ EMAIL SERVICE (QR Gear - Separate from KC) ============
function getResendApiKey() {
    return process.env.QR_RESEND_API_KEY || '';
}
function getResendClient() {
    const apiKey = getResendApiKey();
    if (!apiKey || apiKey.length < 10) {
        return null;
    }
    return new resend_1.Resend(apiKey);
}
const QR_GEAR_FROM_EMAIL = 'QR Gear <noreply@qrgear.com>';
/**
 * @deprecated LEGACY - Use nexusOrderConfirmation() instead for queue-first, idempotent email delivery.
 * This function bypasses NexusMail's TriggerEngine, outbox, and retry logic.
 * Only kept for emergency fallback - DO NOT USE IN NEW CODE.
 */
async function sendOrderConfirmationEmail_DEPRECATED(data) {
    console.warn('[DEPRECATED] sendOrderConfirmationEmail called - use nexusOrderConfirmation() instead');
    try {
        const resend = getResendClient();
        if (!resend) {
            console.warn('[Email] Resend not configured - skipping order confirmation email');
            return { success: false, error: 'Email service not configured' };
        }
        const itemsHtml = data.items.map(item => `<tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.productName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${item.price}</td>
      </tr>`).join('');
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
    }
    catch (error) {
        console.error('[Email] Error sending order confirmation:', error);
        return { success: false, error: error.message };
    }
}
/**
 * @deprecated LEGACY - Use nexusShippingNotification() instead for queue-first, idempotent email delivery.
 * This function bypasses NexusMail's TriggerEngine, outbox, and retry logic.
 * Only kept for emergency fallback - DO NOT USE IN NEW CODE.
 */
async function sendShippingNotificationEmail_DEPRECATED(data) {
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
    }
    catch (error) {
        console.error('[Email] Error sending shipping notification:', error);
        return { success: false, error: error.message };
    }
}
const app = (0, express_1.default)();
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
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Check if origin is allowed
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    }
    else if (!origin) {
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
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: false }));
// Normalize paths - handle both direct function calls and Firebase Hosting rewrites
// Direct: /products (no /api prefix)
// Hosting rewrite: /api/products (has /api prefix)
app.use((req, _res, next) => {
    if (req.path.startsWith('/api/')) {
        req.url = req.url.replace('/api', '');
    }
    next();
});
async function verifyAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    try {
        const token = authHeader.split('Bearer ')[1];
        return await admin.auth().verifyIdToken(token);
    }
    catch {
        return null;
    }
}
async function requireAuth(req, res, next) {
    const user = await verifyAuth(req);
    if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    req.user = user;
    next();
}
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || 'xHUmudG0t5OkCQhqyhB4nXhCUfs1').split(',').filter(Boolean);
async function requireAdmin(req, res, next) {
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
    req.user = user;
    next();
}
async function calculateAuthoritativePrice(customization) {
    try {
        const { productId, productLine = 'text', hasTextAbove, hasTextBelow, templateId, hostingTierCode = '1_year' } = customization;
        const productDoc = await db.collection('products').doc(productId).get();
        if (!productDoc.exists) {
            console.warn(`[Pricing] Product not found: ${productId}`);
            return null;
        }
        const product = productDoc.data();
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
    }
    catch (error) {
        console.error('[Pricing] Error calculating price:', error);
        return null;
    }
}
async function getAuthoritativePrice(productId) {
    return calculateAuthoritativePrice({ productId });
}
function docToObject(doc) {
    if (!doc.exists)
        return null;
    const data = doc.data();
    Object.keys(data).forEach(key => {
        if (data[key] instanceof admin.firestore.Timestamp) {
            data[key] = data[key].toDate();
        }
    });
    return { ...data, id: doc.id };
}
function docsToArray(snapshot) {
    return snapshot.docs.map(doc => docToObject(doc));
}
// ============ SIGNED URL HELPER ============
async function generateSignedUrl(storagePath, expiresInMinutes = 15) {
    if (!storagePath)
        return null;
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
    }
    catch (error) {
        console.error(`[SignedURL] Error generating signed URL for ${storagePath}:`, error.message);
        return null;
    }
}
async function addSignedUrlsToAssets(assets) {
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
function getPrintfulApiKey() {
    return process.env.PRINTFUL_API_KEY || '2O4DwAZeuDDrzW1sJqQDbT7wHCBe6ECFgo4zoam8';
}
// Get Printful Store ID - fallback for Cloud Functions environment
function getPrintfulStoreId() {
    return process.env.PRINTFUL_STORE_ID || '17456917';
}
class PrintfulClient {
    get headers() {
        return {
            'Authorization': `Bearer ${getPrintfulApiKey()}`,
            'Content-Type': 'application/json',
        };
    }
    get isConfigured() {
        const key = getPrintfulApiKey();
        return !!key && key.length > 10;
    }
    async request(method, endpoint, body) {
        const url = `${PRINTFUL_API_BASE}${endpoint}`;
        const options = { method, headers: this.headers };
        if (body)
            options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Printful API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data.result;
    }
    async getProduct(productId) {
        return this.request('GET', `/products/${productId}`);
    }
    async getPrintfiles(productId) {
        const storeId = getPrintfulStoreId();
        const storeParam = storeId ? `?store_id=${storeId}` : '';
        return this.request('GET', `/mockup-generator/printfiles/${productId}${storeParam}`);
    }
    async getVariantsByColor(productId, colorName) {
        const productData = await this.getProduct(productId);
        console.log(`[Printful] Product ${productId} has ${productData?.variants?.length || 0} variants`);
        if (!productData?.variants || productData.variants.length === 0) {
            console.log(`[Printful] No variants found for product ${productId}`);
            return [];
        }
        const lowerColor = colorName.toLowerCase().replace(/^solid\s+/i, '').trim();
        console.log(`[Printful] Searching for color: "${lowerColor}" in product ${productId}`);
        // First try exact and partial matches
        let matches = productData.variants.filter(v => v.color.toLowerCase() === lowerColor ||
            v.color.toLowerCase().includes(lowerColor) ||
            lowerColor.includes(v.color.toLowerCase()) ||
            v.name.toLowerCase().includes(lowerColor));
        console.log(`[Printful] Found ${matches.length} exact matches for color "${colorName}"`);
        // If no matches and we have variants, fall back to first variant
        if (matches.length === 0 && productData.variants.length > 0) {
            console.log(`[Printful] No exact color match for "${colorName}" in product ${productId}, using first variant: ${productData.variants[0].color}`);
            matches = [productData.variants[0]];
        }
        return matches;
    }
    async createMockupTask(productId, variantIds, files, format = 'jpg', optionGroups) {
        const body = { variant_ids: variantIds, format, files };
        if (optionGroups?.length)
            body.option_groups = optionGroups;
        const storeId = getPrintfulStoreId();
        const storeParam = storeId ? `?store_id=${storeId}` : '';
        console.log('[Printful] Creating mockup task for product', productId, 'store_id:', storeId, 'variant_ids:', variantIds);
        console.log('[Printful] Request body:', JSON.stringify(body));
        return this.request('POST', `/mockup-generator/create-task/${productId}${storeParam}`, body);
    }
    async getMockupTaskResult(taskKey) {
        const storeId = getPrintfulStoreId();
        const storeParam = storeId ? `&store_id=${storeId}` : '';
        return this.request('GET', `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}${storeParam}`);
    }
    async waitForMockupTask(taskKey, maxWaitMs = 60000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            const result = await this.getMockupTaskResult(taskKey);
            if (result.status === 'completed')
                return result;
            if (result.status === 'failed')
                throw new Error(`Printful mockup failed: ${result.error}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error(`Printful mockup task timed out after ${maxWaitMs}ms`);
    }
}
const printfulClient = new PrintfulClient();
// ============ PRINTIFY CLIENT (Order Fulfillment) ============
const PRINTIFY_API_BASE = 'https://api.printify.com/v1';
// Get Printify API key - fallback for Cloud Functions environment
function getPrintifyApiKey() {
    return process.env.PRINTIFY_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6ImFiM2JkYjFlZTk2ZmFkYWI0ZTg5NzBlYjM3YjZlYjI0ZWUwZDM5YTkwMDk0ZjE1ZGIwNzZjZWRhY2Y5ZjU1MjQ5M2RhNzMyYzI1ZTNiNGNkIiwiaWF0IjoxNzY3ODExMzQ5LjA2MjgzOSwibmJmIjoxNzY3ODExMzQ5LjA2Mjg0MSwiZXhwIjoxNzk5MzQ3MzQ5LjA1NjU0LCJzdWIiOiIyMTA3MDg5MiIsInNjb3BlcyI6WyJzaG9wcy5tYW5hZ2UiLCJzaG9wcy5yZWFkIiwiY2F0YWxvZy5yZWFkIiwib3JkZXJzLnJlYWQiLCJvcmRlcnMud3JpdGUiLCJwcm9kdWN0cy5yZWFkIiwicHJvZHVjdHMud3JpdGUiLCJ3ZWJob29rcy5yZWFkIiwid2ViaG9va3Mud3JpdGUiLCJ1cGxvYWRzLnJlYWQiLCJ1cGxvYWRzLndyaXRlIiwicHJpbnRfcHJvdmlkZXJzLnJlYWQiLCJ1c2VyLmluZm8iXX0.GR2_7kqoGmuJTw_0bGOfsFuanPEOpwy7M4iGgQ7x25a7Bh4-5vJ8E5xX46CLV3IRs8j24roKrB9p47cmfX1FSv-oIyv-Zlzc5WjIQDq-Y3US8fCedLqNgP3-mokMCaRi9LVdMtH8c9PQ_WkHsHCK6W21iVpebz5NEYkf0Pf4aUekwZBoQvrF1VloYdF6EqEp92AJZ-rO_o3h--_kV_lifjoS5eAzD5lkwJjYp5Q9j6Io-WwM1B32GOhPiNJv-Dp7FJb05nsoSiXBW9i8UuejYhSvcuI487_gbz4tKvyjreFNAUtP9JhuAYvrwDrTwV01qicKl18qP_bbaQSMqfagBMqNE9cl7-eOhX48yCp9CEKoSrhUSsdSvKChYuLinQ89g7RBbrra-q7RzjcE7bpv_7Mn7HUHO8rX6Wg8ZxWI4rxEixCUqt1YEBJ9kfFMUL4IZUM-qcu-vXdZ8GPqfymD27GV7XzFYmrWkm7fKGjFvkbuOL5u9ZeVdzJlJtnk_yztg4AUwSHtZCiAMueWLNRmUrMVQWuYiQptfXdexujBK9aaBlOcdAAX8PEIaicqHSyLlROsuiK_ZRPRRLwGwU45Coe-e_GgaKBpq8lPTHvU0j9F_L45Y9HY4gXHQvTkNM5wcPfoMAvcz2rwPGzZyvi3ejuaEP4lSCfUi-Wiozkfdiw';
}
// Get Printify Shop ID - fallback for Cloud Functions environment
function getPrintifyShopId() {
    return (process.env.PRINTIFY_SHOP_ID || '19642701').trim();
}
class PrintifyClient {
    get headers() {
        return {
            'Authorization': `Bearer ${getPrintifyApiKey()}`,
            'Content-Type': 'application/json',
        };
    }
    get isConfigured() {
        const key = getPrintifyApiKey();
        const shopId = getPrintifyShopId();
        return !!key && key.length > 10 && !!shopId;
    }
    async request(method, endpoint, body) {
        const url = `${PRINTIFY_API_BASE}${endpoint}`;
        const options = { method, headers: this.headers };
        if (body)
            options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Printify API error: ${response.status} - ${errorText}`);
        }
        return response.json();
    }
    async createOrder(orderRequest) {
        const shopId = getPrintifyShopId();
        return this.request('POST', `/shops/${shopId}/orders.json`, orderRequest);
    }
    async submitOrderToProduction(orderId) {
        const shopId = getPrintifyShopId();
        await this.request('POST', `/shops/${shopId}/orders/${orderId}/send_to_production.json`, {});
    }
    async getOrder(orderId) {
        const shopId = getPrintifyShopId();
        return this.request('GET', `/shops/${shopId}/orders/${orderId}.json`);
    }
    async getOrders() {
        const shopId = getPrintifyShopId();
        const result = await this.request('GET', `/shops/${shopId}/orders.json`);
        return result.data || [];
    }
}
const printifyClient = new PrintifyClient();
async function submitOrderToPrintify(orderId, shippingAddress) {
    try {
        if (!printifyClient.isConfigured) {
            return { success: false, error: 'Printify API not configured (missing API key or shop ID)' };
        }
        // Get the order
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            return { success: false, error: 'Order not found' };
        }
        const order = orderDoc.data();
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
        const lineItems = [];
        for (const doc of orderItemsSnapshot.docs) {
            const item = doc.data();
            const customization = item.customization;
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
        const addressTo = {
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
        const printifyOrderRequest = {
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
    }
    catch (error) {
        console.error(`Failed to submit order ${orderId} to Printify:`, error);
        return { success: false, error: error.message };
    }
}
async function checkPrintifyOrderStatus(printifyOrderId) {
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
    }
    catch (error) {
        console.error(`Failed to check Printify order status for ${printifyOrderId}:`, error);
        return null;
    }
}
// ============ COLOR LUMINANCE HELPERS ============
function isValidHexColor(hexColor) {
    if (!hexColor)
        return false;
    const hex = hexColor.replace("#", "");
    return /^[0-9A-Fa-f]{6}$/.test(hex);
}
function isColorDark(hexColor) {
    if (!isValidHexColor(hexColor))
        return false;
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return luminance < 0.5;
}
// ============ FIREBASE STORAGE UPLOAD ============
async function downloadAndStoreImage(imageUrl, storagePath) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok)
            throw new Error(`Failed to download: ${response.status}`);
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
    }
    catch (error) {
        console.error('[Storage] Upload failed:', error.message);
        return null;
    }
}
// Default Printify blueprint to Printful product mappings (fallback)
const DEFAULT_BLUEPRINT_MAPPINGS = {
    // T-Shirts
    5: 71, // Bella Canvas 3001 Unisex Jersey Tee -> Printful Bella Canvas 3001
    6: 71, // Gildan 5000 -> Printful Bella Canvas 3001
    12: 71, // Gildan 64000 -> Printful Bella Canvas 3001
    145: 380, // Heavyweight tee -> Printful Gildan 5000
    474: 71, // Cotton Crew -> Printful Bella Canvas 3001
    577: 71, // Bella Canvas 3001C -> Printful Bella Canvas 3001
    578: 71, // Alternative to Bella Canvas
    // Hoodies & Sweatshirts
    45: 380, // Sweatshirt/Crewneck -> Printful Gildan 18000
    77: 380, // Gildan 18500 Hoodie -> Printful Gildan 18500
    80: 380, // Unisex Hoodie -> Printful Gildan 18500
    81: 380, // Pullover Hoodie -> Printful Gildan 18500
    91: 380, // Heavyweight Hoodie -> Printful Gildan 18500
    // Long Sleeve
    26: 71, // Long Sleeve Tee -> Printful equivalent
    39: 71, // Long Sleeve -> Printful equivalent
    // Tank Tops
    14: 71, // Tank Top -> Printful equivalent
    15: 71, // Women's Tank -> Printful equivalent
    // Mugs
    66: 19, // White Mug 11oz -> Printful White Mug 11oz
    // Hats/Caps  
    88: 206, // Dad Hat -> Printful Dad Hat
    // Posters/Canvas
    33: 1, // Poster -> Printful Poster
    36: 1, // Art Print -> Printful Poster
    // Bags
    49: 84, // Tote Bag -> Printful Tote Bag
    // Phone Cases
    48: 226, // iPhone Case -> Printful iPhone Case
};
// Look up Printful product ID from Firestore mapping or fallback
async function getPrintfulProductId(blueprintId) {
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
async function generateMockupFromPrintful(request) {
    const { blueprintId, colorName, colorHex, artworkUrl, artworkVariant = 'black', fulfillmentProvider = 'printify' } = request;
    // Check Firestore cache first
    const cacheKey = `${blueprintId}_${colorName.replace(/\s+/g, '_')}_${artworkVariant}`;
    const cacheDoc = await db.collection('mockupCache').doc(cacheKey).get();
    if (cacheDoc.exists) {
        const cached = cacheDoc.data();
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
    let printfulProductId;
    if (fulfillmentProvider === 'printful') {
        // Native Printful product - use ID directly
        printfulProductId = blueprintId;
        console.log(`[Mockup] Printful native product: ${printfulProductId}`);
    }
    else {
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
    const frontPrintfile = printfileData?.printfiles?.find((p) => p.placement === 'front' || p.placement === 'default');
    // Build file entry with position (required by Printful Mockup Generator)
    // Position is ALWAYS required - use printfile specs if available, otherwise sensible defaults
    const placement = frontPrintfile?.placement || 'front';
    const areaWidth = frontPrintfile?.width || 1800;
    const areaHeight = frontPrintfile?.height || 2400;
    const fileEntry = {
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
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Add delay between retries (longer delays for each retry)
            if (attempt > 1) {
                const delayMs = attempt * 15000; // 15s, 30s, 45s
                console.log(`[Printful] Retry ${attempt}/${maxRetries} - waiting ${delayMs / 1000}s before retry`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            // Create mockup task - don't pass option_groups as it filters out variants
            const task = await printfulClient.createMockupTask(printfulProductId, [variantId], [fileEntry], 'jpg');
            // Wait for completion with longer timeout
            const result = await printfulClient.waitForMockupTask(task.task_key, 120000);
            if (!result.mockups || result.mockups.length === 0) {
                throw new Error('No mockups returned from Printful');
            }
            // Success - continue with the rest of the function
            return await processMockupResult(result, blueprintId, colorName, artworkVariant, cacheKey);
        }
        catch (err) {
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
async function processMockupResult(result, blueprintId, colorName, artworkVariant, cacheKey) {
    // Find flat and lifestyle mockups
    let flatMockup = result.mockups.find((m) => !m.placement.includes('lifestyle'));
    let lifestyleMockup = result.mockups.find((m) => m.placement.includes('lifestyle'));
    if (!flatMockup)
        flatMockup = result.mockups[0];
    // Download and store in Firebase Storage
    const timestamp = Date.now();
    const storagePath = `mockups/${blueprintId}/${colorName.replace(/\s+/g, '_')}_${artworkVariant}_${timestamp}.jpg`;
    const permanentUrl = await downloadAndStoreImage(flatMockup.mockup_url, storagePath);
    let lifestyleUrl = null;
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
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        mode: 'firebase-functions',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
app.get('/products', async (req, res) => {
    try {
        const featured = req.query.featured === 'true';
        let query = db.collection('products').where('isEnabled', '==', true);
        if (featured) {
            query = query.where('isFeatured', '==', true);
        }
        const snapshot = await query.get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});
app.get('/products/:id', async (req, res) => {
    try {
        const doc = await db.collection('products').doc(req.params.id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/designs/:id', async (req, res) => {
    try {
        const doc = await db.collection('customDesigns').doc(req.params.id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Design not found' });
            return;
        }
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/auth/user', async (req, res) => {
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
    }
    catch (error) {
        // Return null on error instead of 401
        console.error('[/auth/user] Error:', error.message);
        res.json(null);
    }
});
app.get('/cart', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const snapshot = await db.collection('cartItems').where('userId', '==', userId).get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/cart', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { customization, quantity } = req.body;
        const productId = customization?.productId;
        if (!productId) {
            res.status(400).json({ error: 'Product ID is required' });
            return;
        }
        const pricingInput = {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/cart/:id', requireAuth, async (req, res) => {
    try {
        const { quantity } = req.body;
        await db.collection('cartItems').doc(req.params.id).update({ quantity });
        const doc = await db.collection('cartItems').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/cart/:id', requireAuth, async (req, res) => {
    try {
        await db.collection('cartItems').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const snapshot = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/orders/:id', requireAuth, async (req, res) => {
    try {
        const doc = await db.collection('orders').doc(req.params.id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/orders', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const docRef = await db.collection('orders').add({
            ...req.body,
            userId,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/qr-templates', async (_req, res) => {
    try {
        const snapshot = await db.collection('qrTemplates').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/qr-templates/:id', async (req, res) => {
    try {
        const doc = await db.collection('qrTemplates').doc(req.params.id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'QR Template not found' });
            return;
        }
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/hosting-tiers', async (_req, res) => {
    try {
        const snapshot = await db.collection('hostingTiers').orderBy('sortOrder', 'asc').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/stores/:slug', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/settings', async (_req, res) => {
    try {
        const doc = await db.collection('settings').doc('admin').get();
        res.json(doc.exists ? doc.data() : {});
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/stripe/publishable-key', async (_req, res) => {
    const key = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
        res.status(500).json({ error: 'Stripe not configured' });
        return;
    }
    res.json({ publishableKey: key });
});
app.post('/checkout', requireAuth, async (req, res) => {
    try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            res.status(500).json({ error: 'Stripe not configured' });
            return;
        }
        const stripe = new stripe_1.default(stripeKey);
        const userId = req.user.uid;
        const { successUrl, cancelUrl } = req.body;
        const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
        if (cartSnapshot.empty) {
            res.status(400).json({ error: 'Cart is empty' });
            return;
        }
        const cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const lineItemsPromises = cartItems.map(async (item) => {
            const customization = item.customization || {};
            const productId = customization.productId;
            const productName = customization.productName || 'Custom QR Product';
            const productImage = customization.productImage;
            let price = null;
            if (productId) {
                const pricingInput = {
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
    }
    catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/checkout/embedded', requireAuth, async (req, res) => {
    try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            res.status(500).json({ error: 'Stripe not configured' });
            return;
        }
        const stripe = new stripe_1.default(stripeKey);
        const userId = req.user.uid;
        const { returnUrl } = req.body;
        const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
        if (cartSnapshot.empty) {
            res.status(400).json({ error: 'Cart is empty' });
            return;
        }
        const cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const lineItemsPromises = cartItems.map(async (item) => {
            const customization = item.customization || {};
            const productId = customization.productId;
            const productName = customization.productName || 'Custom QR Product';
            const productImage = customization.productImage;
            let price = null;
            if (productId) {
                const pricingInput = {
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
        const cartItemIds = cartItems.map((item) => item.id);
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
    }
    catch (error) {
        console.error('Embedded checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.get('/checkout/session-status', requireAuth, async (req, res) => {
    try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            res.status(500).json({ error: 'Stripe not configured' });
            return;
        }
        const sessionId = req.query.session_id;
        if (!sessionId) {
            res.status(400).json({ error: 'session_id is required' });
            return;
        }
        const stripe = new stripe_1.default(stripeKey);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        res.json({
            status: session.status,
            paymentStatus: session.payment_status,
            customerEmail: session.customer_details?.email,
            amountTotal: session.amount_total ? session.amount_total / 100 : 0,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/checkout/verify/:sessionId', requireAuth, async (req, res) => {
    try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            res.status(500).json({ error: 'Stripe not configured' });
            return;
        }
        const stripe = new stripe_1.default(stripeKey);
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
        res.json({
            status: session.payment_status,
            customerEmail: session.customer_details?.email,
            amountTotal: session.amount_total ? session.amount_total / 100 : 0,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/gallery', async (req, res) => {
    try {
        const snapshot = await db.collection('qrDesigns')
            .where('isPublic', '==', true)
            .limit(50)
            .get();
        const items = docsToArray(snapshot);
        items.sort((a, b) => {
            const dateA = a.createdAt?._seconds || 0;
            const dateB = b.createdAt?._seconds || 0;
            return dateB - dateA;
        });
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/files/:filename', async (req, res) => {
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
    }
    catch (error) {
        console.error('File serving error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.get('/library-files/:filename', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUBLIC test endpoint - no auth
app.get('/test-images', async (_req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUBLIC test endpoint - real product config data (no auth)
// PUBLIC test endpoint - update product options (no auth)
// PUBLIC test endpoint - sync product from Printify (no auth - simplified)
app.get('/admin/settings', requireAdmin, async (_req, res) => {
    try {
        const doc = await db.collection('settings').doc('admin').get();
        res.json(doc.exists ? doc.data() : {});
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/settings', requireAdmin, async (req, res) => {
    try {
        await db.collection('settings').doc('admin').set(req.body, { merge: true });
        const doc = await db.collection('settings').doc('admin').get();
        res.json(doc.data());
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/admin/products', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('products').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/products', requireAdmin, async (req, res) => {
    try {
        const productId = req.body.id || `product_${Date.now()}`;
        await db.collection('products').doc(productId).set({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await db.collection('products').doc(productId).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('products').doc(req.params.id).update({
            ...req.body,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await db.collection('products').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/admin/products/:id/toggle', requireAdmin, async (req, res) => {
    try {
        const doc = await db.collection('products').doc(req.params.id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        const current = doc.data().isEnabled || false;
        await db.collection('products').doc(req.params.id).update({
            isEnabled: !current,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const updated = await db.collection('products').doc(req.params.id).get();
        res.json(docToObject(updated));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/products/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('products').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/admin/orders', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('orders').doc(req.params.id).update({
            ...req.body,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await db.collection('orders').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/admin/users', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/categories', async (_req, res) => {
    try {
        const snapshot = await db.collection('productCategories').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/browsing-history', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const snapshot = await db.collection('browsingHistory')
            .where('userId', '==', userId)
            .orderBy('viewedAt', 'desc')
            .limit(20)
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/browsing-history', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const docRef = await db.collection('browsingHistory').add({
            ...req.body,
            userId,
            viewedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/coupons/:code', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ WIDGET API ============
const jwt = __importStar(require("jsonwebtoken"));
// Secrets must be configured via Firebase Functions config or environment variables
// These will NOT work without proper configuration
const WIDGET_JWT_SECRET = process.env.WIDGET_JWT_SECRET;
const WIDGET_API_KEY = process.env.WIDGET_API_KEY;
const KC_API_KEY = process.env['KC-API-KEY'];
function signWidgetToken(payload) {
    if (!WIDGET_JWT_SECRET) {
        throw new Error('WIDGET_JWT_SECRET not configured');
    }
    return jwt.sign(payload, WIDGET_JWT_SECRET, { expiresIn: '1h' });
}
function verifyWidgetToken(token) {
    try {
        if (!WIDGET_JWT_SECRET) {
            return null;
        }
        return jwt.verify(token, WIDGET_JWT_SECRET);
    }
    catch {
        return null;
    }
}
app.get('/widget/session', async (req, res) => {
    try {
        const token = req.query.token;
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
    }
    catch (error) {
        console.error('Widget session error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/widget/token', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
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
    }
    catch (error) {
        console.error('Widget token error:', error);
        res.status(500).json({ error: error.message });
    }
});
// KC Widget Items endpoint - used by Kingdom Connects widget embed
app.get('/widget/items', async (req, res) => {
    try {
        // Check KC_API_KEY authentication
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        const providedKey = apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader);
        if (!KC_API_KEY || providedKey !== KC_API_KEY) {
            res.status(401).json({ error: 'Invalid or missing API key' });
            return;
        }
        const channelId = req.query.channelId;
        const storeId = req.query.storeId || 'kingdom_connects';
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
    }
    catch (error) {
        console.error('Widget items error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ============ PARTNER API ============
app.get('/partner/products', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
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
        const products = await Promise.all(productsSnapshot.docs.map(async (spDoc) => {
            const sp = spDoc.data();
            const productDoc = await db.collection('products').doc(sp.productId).get();
            if (!productDoc.exists)
                return null;
            const product = productDoc.data();
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
        }));
        res.json({
            store: { id: store.id, name: storeData.name, slug: storeData.slug },
            products: products.filter(Boolean),
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ STOREFRONT MOCKUP GENERATION ============
app.post('/storefront/generate-mockup', async (req, res) => {
    try {
        const { productId, color, qrSize, qrSizePercent } = req.body;
        if (!productId || !color) {
            res.status(400).json({ error: 'productId and color are required' });
            return;
        }
        let resolvedQrSize = 'medium';
        if (qrSize && ['small', 'medium', 'large'].includes(qrSize)) {
            resolvedQrSize = qrSize;
        }
        else if (qrSizePercent) {
            if (qrSizePercent <= 30)
                resolvedQrSize = 'small';
            else if (qrSizePercent <= 50)
                resolvedQrSize = 'medium';
            else
                resolvedQrSize = 'large';
        }
        const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
        const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
        const productDoc = await db.collection('products').doc(canonicalProductId).get();
        if (!productDoc.exists) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        const product = productDoc.data();
        const existingMockups = product.mockupsByColor || {};
        const normalizeColor = (c) => c.toLowerCase().trim();
        const requestColorNorm = normalizeColor(color);
        // Build keys for lookup: color_size_placement (full), color_size, color (legacy)
        const placement = 'front-chest';
        const fullKey = `${color}_${resolvedQrSize}_${placement}`;
        const colorSizeKey = `${color}_${resolvedQrSize}`;
        const fullKeyNorm = `${requestColorNorm}_${resolvedQrSize}_${placement}`;
        const colorSizeKeyNorm = `${requestColorNorm}_${resolvedQrSize}`;
        console.log(`[StorefrontMockup] Looking for mockup: full="${fullKey}", size="${colorSizeKey}", color="${color}"`);
        // Priority 1: Exact match for color + size + placement
        let existingMockup = null;
        let matchedColorKey = fullKey;
        let usedFallback = false;
        for (const [storedKey, mockup] of Object.entries(existingMockups)) {
            const storedKeyNorm = storedKey.toLowerCase().trim();
            if (storedKeyNorm === fullKeyNorm && mockup && mockup.front) {
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
                if (storedKeyNorm === colorSizeKeyNorm && mockup && mockup.front) {
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
                if (matchesColor && mockup && mockup.front) {
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
        const design = designDoc.data();
        let designPlacements = {};
        try {
            if (typeof design.placementImages === 'string') {
                designPlacements = JSON.parse(design.placementImages);
            }
            else if (design.placementImages && typeof design.placementImages === 'object') {
                designPlacements = design.placementImages;
            }
        }
        catch (e) {
            console.error('[StorefrontMockup] Failed to parse placementImages:', e);
        }
        let colorHex = null;
        if (product.availableColors && Array.isArray(product.availableColors)) {
            const colorInfo = product.availableColors.find((c) => c.name?.toLowerCase() === color.toLowerCase());
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
        let artworkUrl;
        let artworkVariant = 'black';
        if (needsWhiteQR && whiteArtwork) {
            artworkUrl = whiteArtwork;
            artworkVariant = 'white';
        }
        else if (blackArtwork) {
            artworkUrl = blackArtwork;
            artworkVariant = 'black';
        }
        else {
            artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0];
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
        }
        catch (genError) {
            console.error(`[StorefrontMockup] Printful generation failed:`, genError.message);
            res.status(500).json({
                error: `Failed to generate mockup for ${color}: ${genError.message}`,
                color
            });
        }
    }
    catch (error) {
        console.error('[StorefrontMockup] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ============ MOCKUP API ============
app.get('/placements', async (req, res) => {
    try {
        const snapshot = await db.collection('canonicalPlacements').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/mockups/get-or-generate', async (req, res) => {
    try {
        const { blueprintId, printProviderId, colorName, colorHex, canonicalPlacementId = 'FRONT_CHEST', artworkUrl, artworkVariant = 'black' } = req.body;
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
                artworkVariant: artworkVariant,
            });
            res.json({
                success: true,
                mockupUrl: mockupResult.mockupUrl,
                lifestyleUrl: mockupResult.lifestyleMockupUrl,
                fromCache: mockupResult.fromCache,
            });
        }
        catch (genError) {
            res.status(500).json({
                success: false,
                error: genError.message,
                fromCache: false,
            });
        }
    }
    catch (error) {
        console.error('[MockupAPI] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Test endpoint: Generate priority mockup for digital proof
app.get('/mockups/cached/:blueprintId/:printProviderId', async (req, res) => {
    try {
        const { blueprintId, printProviderId } = req.params;
        const snapshot = await db.collection('mockupCache')
            .where('blueprintId', '==', parseInt(blueprintId))
            .where('printProviderId', '==', parseInt(printProviderId))
            .get();
        const mockups = {};
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ DESIGNS CRUD ============
app.get('/designs', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const snapshot = await db.collection('customDesigns')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/designs', requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const docRef = await db.collection('customDesigns').add({
            ...req.body,
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/designs/:id', requireAuth, async (req, res) => {
    try {
        await db.collection('customDesigns').doc(req.params.id).update({
            ...req.body,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await db.collection('customDesigns').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/designs/:id', requireAuth, async (req, res) => {
    try {
        await db.collection('customDesigns').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ PRODUCT CATEGORIES ============
app.get('/product-categories', async (_req, res) => {
    try {
        const snapshot = await db.collection('productCategories')
            .orderBy('sortOrder')
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/product-categories/:id/products', async (req, res) => {
    try {
        const mappingSnapshot = await db.collection('productCategoryMappings')
            .where('categoryId', '==', req.params.id)
            .get();
        const productIds = mappingSnapshot.docs.map(d => d.data().productId);
        if (productIds.length === 0) {
            res.json([]);
            return;
        }
        const products = await Promise.all(productIds.map(async (id) => {
            const doc = await db.collection('products').doc(id).get();
            return doc.exists ? docToObject(doc) : null;
        }));
        res.json(products.filter(Boolean));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN PRODUCT CATEGORIES ============
app.post('/admin/product-categories', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('productCategories').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/product-categories/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('productCategories').doc(req.params.id).update(req.body);
        const doc = await db.collection('productCategories').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/product-categories/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('productCategories').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ AUTH ENDPOINTS ============
app.post('/auth/register', async (req, res) => {
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
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});
// ============ ADMIN PRICING RULES ============
app.get('/admin/pricing-rules', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('pricingRules').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/pricing-rules', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('pricingRules').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/pricing-rules/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('pricingRules').doc(req.params.id).update(req.body);
        const doc = await db.collection('pricingRules').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/pricing-rules/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('pricingRules').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN STORES (stores + storeChannels collections) ============
app.get('/admin/stores', requireAdmin, async (req, res) => {
    try {
        const roleType = req.query.roleType;
        let query = db.collection('stores');
        if (roleType)
            query = query.where('roleType', '==', roleType);
        const snapshot = await query.get();
        const stores = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        stores.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        res.json(stores);
    }
    catch (error) {
        console.error('[Stores] GET error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/stores', requireAdmin, async (req, res) => {
    try {
        const { name, roleType } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Store name is required' });
            return;
        }
        if (!roleType || !['internal', 'external', 'member'].includes(roleType)) {
            res.status(400).json({ error: 'Valid roleType is required' });
            return;
        }
        const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const storeData = { name: name.trim(), roleType, isActive: true, channelCount: 0, createdAt: new Date().toISOString() };
        await db.collection('stores').doc(storeId).set(storeData);
        res.json({ id: storeId, ...storeData });
    }
    catch (error) {
        console.error('[Stores] POST error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/stores/:storeId', requireAdmin, async (req, res) => {
    try {
        const { storeId } = req.params;
        const channelsSnapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
        const batch = db.batch();
        channelsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
        batch.delete(db.collection('stores').doc(storeId));
        await batch.commit();
        res.json({ success: true, deletedChannels: channelsSnapshot.size });
    }
    catch (error) {
        console.error('[Stores] DELETE error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.get('/admin/stores/by-id/:storeId', requireAdmin, async (req, res) => {
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
    }
    catch (error) {
        console.error('[Stores] GET by-id error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.get('/admin/stores/:storeId/channels', requireAdmin, async (req, res) => {
    try {
        const { storeId } = req.params;
        const snapshot = await db.collection('storeChannels').where('storeId', '==', storeId).get();
        const channels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        channels.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        res.json(channels);
    }
    catch (error) {
        console.error('[Channels] GET error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/stores/:storeId/channels', requireAdmin, async (req, res) => {
    try {
        const { storeId } = req.params;
        const { name } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Channel name is required' });
            return;
        }
        const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const channelData = { name: name.trim(), storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
        await db.collection('storeChannels').doc(channelId).set(channelData);
        res.json({ id: channelId, ...channelData });
    }
    catch (error) {
        console.error('[Channels] POST error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/stores/:storeId/channels/:channelId', requireAdmin, async (req, res) => {
    try {
        const { channelId } = req.params;
        await db.collection('storeChannels').doc(channelId).delete();
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Channels] DELETE error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN PARTNER STORES ============
app.get('/admin/partner-stores', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('partnerStores').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/partner-stores', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('partnerStores').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/partner-stores/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('partnerStores').doc(req.params.id).update(req.body);
        const doc = await db.collection('partnerStores').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/partner-stores/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('partnerStores').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/admin/partner-stores/:id/products', requireAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('partnerStoreProducts')
            .where('storeId', '==', req.params.id)
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/partner-stores/:id/products', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('partnerStoreProducts').add({
            ...req.body,
            storeId: req.params.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ QR GENERATION ============
app.post('/qr/generate', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ STORES (PUBLIC) ============
app.get('/stores', async (_req, res) => {
    try {
        const snapshot = await db.collection('partnerStores')
            .where('isActive', '==', true)
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ FILE UPLOAD (Firebase Storage) ============
app.post('/upload', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN MOCKUP REGENERATION ============
app.post('/admin/products/:id/regenerate-mockups', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { color } = req.body;
        const productDoc = await db.collection('products').doc(id).get();
        if (!productDoc.exists) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        const product = productDoc.data();
        if (!product.blueprintId) {
            res.status(400).json({ error: 'Product missing blueprint info' });
            return;
        }
        if (!printfulClient.isConfigured) {
            res.status(500).json({ error: 'Printful API key not configured' });
            return;
        }
        const metadata = product.metadata;
        const designId = metadata?.customDesignId || id.replace('custom_', '');
        const designDoc = await db.collection('customDesigns').doc(designId).get();
        if (!designDoc.exists) {
            res.status(404).json({ error: 'Custom design not found' });
            return;
        }
        const design = designDoc.data();
        let designPlacements = {};
        if (typeof design.placementImages === 'object') {
            designPlacements = design.placementImages;
        }
        const blackArtwork = designPlacements['front-chest'] || designPlacements['front'];
        const whiteArtwork = designPlacements['front-chest-white'];
        // Get colors to regenerate
        const allColors = product.availableColors || [];
        const colorsToProcess = color ? allColors.filter(c => c.name === color) : allColors;
        if (colorsToProcess.length === 0) {
            res.status(400).json({ error: 'No colors to process' });
            return;
        }
        const results = [];
        const mockupsByColor = product.mockupsByColor || {};
        for (const colorInfo of colorsToProcess) {
            try {
                const needsWhiteQR = isColorDark(colorInfo.hex);
                const artworkUrl = (needsWhiteQR && whiteArtwork) ? whiteArtwork : blackArtwork;
                const artworkVariant = (needsWhiteQR && whiteArtwork) ? 'white' : 'black';
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
            }
            catch (err) {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/products/:id/generate-all-mockups', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const productDoc = await db.collection('products').doc(id).get();
        if (!productDoc.exists) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        const product = productDoc.data();
        const allColors = product.availableColors || [];
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
            colors: allColors.map((c) => c.name),
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN PRODUCT VARIANTS ============
app.get('/admin/products/:id/variants', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const snapshot = await db.collection('productVariants')
            .where('productId', '==', id)
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.patch('/admin/variants/:id/toggle', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await db.collection('productVariants').doc(id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Variant not found' });
            return;
        }
        const current = doc.data();
        await db.collection('productVariants').doc(id).update({
            isEnabled: !current.isEnabled,
        });
        const updated = await db.collection('productVariants').doc(id).get();
        res.json(docToObject(updated));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN CATALOG ============
app.get('/admin/catalog/blueprints', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('printifyBlueprints').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/admin/catalog/blueprints/:id', requireAdmin, async (req, res) => {
    try {
        const doc = await db.collection('printifyBlueprints').doc(req.params.id).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Blueprint not found' });
            return;
        }
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ CUSTOM DESIGNS (ADMIN) ============
app.get('/admin/designs', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('customDesigns')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/designs', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('customDesigns').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/designs/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('customDesigns').doc(req.params.id).update({
            ...req.body,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await db.collection('customDesigns').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/designs/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('customDesigns').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ QR TEMPLATES ============
app.post('/admin/qr-templates', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('qrTemplates').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/qr-templates/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('qrTemplates').doc(req.params.id).update(req.body);
        const doc = await db.collection('qrTemplates').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/qr-templates/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('qrTemplates').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ HOSTING TIERS (ADMIN) ============
app.post('/admin/hosting-tiers', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('hostingTiers').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/hosting-tiers/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('hostingTiers').doc(req.params.id).update(req.body);
        const doc = await db.collection('hostingTiers').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/hosting-tiers/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('hostingTiers').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ GALLERY (ADMIN) ============
app.post('/admin/gallery', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('galleryItems').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/gallery/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('galleryItems').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
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
const KNOWN_MOCKUP_BLUEPRINT_IDS = new Set([
    // T-SHIRTS (US-MADE)
    6, 12, // Bella+Canvas 3001
    5, // Next Level 3600
    48, // Bella+Canvas 3005 V-Neck
    184, // Bella+Canvas 3413 Tri-Blend
    420, // Bella+Canvas 3001Y Youth
    580, // Bella+Canvas 3001T Toddler
    472, // Bella+Canvas 6400 Women's
    145, // Gildan 64000
    // TANK TOPS (US-MADE)
    39, 91, // Bella+Canvas 3480 Unisex Tank
    47, // Bella+Canvas 8803 Women's Muscle Tank
    18, // Next Level 1533 Women's Racerback
    141, // Next Level 6733 Women's Tri-Blend Racerback
    // LONG SLEEVES (US-MADE)
    41, 301, // Bella+Canvas 3501
    45, // Next Level 3601
    66, // Gildan 2400
    // HOODIES & SWEATSHIRTS (US-MADE)
    175, 394, // Bella+Canvas 3719 Pullover Hoodie
    439, // Lane Seven LS14001 Hoodie
    445, // Lane Seven LS14003 Zip Hoodie
    446, // Lane Seven LS14004 Crewneck
    77, // Gildan 18500 Heavy Blend Hoodie
    76, // Gildan 18000 Crewneck Sweatshirt
    // HATS
    384, // Yupoong 6245CM Dad Hat
    297, // Yupoong 6089M Snapback
    // MUGS
    68, // 11oz White Mug
    69, // 15oz White Mug
    // BAGS
    456, // Liberty Bags 8502 Canvas Tote
    // ACCESSORIES
    502, 503, // Stickers
]);
// Test endpoint: Printify catalog (no auth required) - v2 with price fields from providers
// Helper to normalize Printful product types into proper categories
function normalizePrintfulCategory(type, title) {
    const text = `${type} ${title}`.toLowerCase();
    // Check for specific product types (order matters - more specific first)
    if (text.includes('hoodie') || text.includes('hood'))
        return 'Hoodies';
    if (text.includes('sweatshirt') || text.includes('crewneck') || text.includes('crew neck'))
        return 'Sweatshirts';
    if (text.includes('sweatpants') || text.includes('jogger'))
        return 'Sweatpants';
    if (text.includes('tank top') || text.includes('tank'))
        return 'Tank Tops';
    if (text.includes('long sleeve') || text.includes('longsleeve'))
        return 'Long Sleeve Shirts';
    if (text.includes('t-shirt') || text.includes('tee') || text.includes('tshirt'))
        return 'T-Shirts';
    if (text.includes('polo'))
        return 'Polos';
    if (text.includes('jacket') || text.includes('windbreaker'))
        return 'Jackets';
    if (text.includes('hat') || text.includes('cap') || text.includes('beanie') || text.includes('trucker'))
        return 'Hats';
    if (text.includes('bag') || text.includes('tote') || text.includes('backpack') || text.includes('duffel'))
        return 'Bags';
    if (text.includes('mug') || text.includes('tumbler') || text.includes('bottle'))
        return 'Drinkware';
    if (text.includes('poster') || text.includes('print') || text.includes('canvas') || text.includes('wall art'))
        return 'Wall Art';
    if (text.includes('sticker'))
        return 'Stickers';
    if (text.includes('phone case') || text.includes('iphone') || text.includes('samsung'))
        return 'Phone Cases';
    if (text.includes('mouse pad') || text.includes('mousepad'))
        return 'Mouse Pads';
    if (text.includes('pillow') || text.includes('cushion'))
        return 'Pillows';
    if (text.includes('blanket') || text.includes('throw'))
        return 'Blankets';
    if (text.includes('towel'))
        return 'Towels';
    if (text.includes('apron'))
        return 'Aprons';
    if (text.includes('shorts'))
        return 'Shorts';
    if (text.includes('dress'))
        return 'Dresses';
    if (text.includes('legging'))
        return 'Leggings';
    if (text.includes('socks'))
        return 'Socks';
    if (text.includes('jersey'))
        return 'Jerseys';
    if (text.includes('calendar'))
        return 'Calendars';
    if (text.includes('notebook') || text.includes('journal'))
        return 'Notebooks';
    if (text.includes('flag') || text.includes('banner'))
        return 'Flags & Banners';
    if (text.includes('patch'))
        return 'Patches';
    if (text.includes('embroidered') || text.includes('embroidery'))
        return 'Embroidered Items';
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
app.get('/admin/background-assets', requireAdmin, async (req, res) => {
    try {
        const typeFilter = req.query.type || 'source';
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
            .sort((a, b) => {
            const getTime = (val) => {
                if (!val)
                    return 0;
                if (typeof val === 'string')
                    return new Date(val).getTime() || 0;
                if (val.toDate)
                    return val.toDate().getTime();
                if (val._seconds)
                    return val._seconds * 1000;
                if (val instanceof Date)
                    return val.getTime();
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
    }
    catch (error) {
        console.error('[BackgroundAssets] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/background-assets', requireAdmin, async (req, res) => {
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
        let folderPath;
        if (assetType === 'cropped') {
            folderPath = 'library/backgrounds/cropped';
        }
        else if (fromZip) {
            folderPath = 'library/backgrounds/raw/zip';
        }
        else {
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
        const doc = await docRef.get();
        console.log(`[BackgroundAssets] Upload complete: ${doc.id}`);
        res.json(docToObject(doc));
    }
    catch (error) {
        console.error("[BackgroundAssets] Upload error:", error.message, error.stack);
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/background-assets/:id', requireAdmin, async (req, res) => {
    try {
        // Soft delete (set isActive to false)
        await db.collection('library_assets').doc(req.params.id).update({
            isActive: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Sync storage folder with database - creates DB records for existing files
app.post('/admin/background-assets/sync', requireAdmin, async (req, res) => {
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
        const existingPaths = new Set(existingSnapshot.docs
            .map(d => d.data())
            .filter(data => data.isActive === true && data.assetType === 'source')
            .map(data => data.storageUrl));
        // Find files that don't have database records
        const newFiles = storageFiles.filter(f => !existingPaths.has(`gs://${bucket.name}/${f.fullPath}`));
        console.log(`[BackgroundAssets] ${newFiles.length} files need database records`);
        // Create database records for new files
        const createdAssets = [];
        for (const file of newFiles) {
            if (!file.contentType.startsWith('image/'))
                continue;
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
            }
            catch (err) {
                console.error(`[BackgroundAssets] Failed to create record for ${file.name}:`, err);
            }
        }
        res.json({
            scanned: storageFiles.length,
            existing: existingSnapshot.size,
            created: createdAssets.length,
            assets: createdAssets,
        });
    }
    catch (error) {
        console.error("Error syncing background assets:", error);
        res.status(500).json({ error: error.message });
    }
});
// ============ COUPONS (ADMIN) ============
app.get('/admin/coupons', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('coupons').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/coupons', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('coupons').add({
            ...req.body,
            redemptionCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put('/admin/coupons/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('coupons').doc(req.params.id).update(req.body);
        const doc = await db.collection('coupons').doc(req.params.id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/coupons/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('coupons').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ GIFT PACKAGES (ADMIN) ============
app.get('/admin/gift-packages', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('giftPackages').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/gift-packages', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('giftPackages').add({
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/gift-packages/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('giftPackages').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ GIFT CODES (ADMIN) ============
app.get('/admin/gift-codes', requireAdmin, async (_req, res) => {
    try {
        const snapshot = await db.collection('giftCodes').get();
        res.json(docsToArray(snapshot));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/admin/gift-codes', requireAdmin, async (req, res) => {
    try {
        const docRef = await db.collection('giftCodes').add({
            ...req.body,
            isRedeemed: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/admin/gift-codes/:id', requireAdmin, async (req, res) => {
    try {
        await db.collection('giftCodes').doc(req.params.id).delete();
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ PUBLIC GIFT CODE VALIDATION ============
app.get('/gift-codes/:code', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ PRINTIFY STATUS ============
app.get('/printify/status', async (_req, res) => {
    try {
        res.json({
            connected: printifyClient.isConfigured,
            mode: 'firebase-functions',
            message: printifyClient.isConfigured
                ? 'Printify integration is configured and ready'
                : 'Printify API key or Shop ID not configured'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN ORDER FULFILLMENT ============
// Get all orders with fulfillment status
app.get('/admin/orders', requireAdmin, async (_req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get single order with items
app.get('/admin/orders/:id', requireAdmin, async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Submit order to Printify for fulfillment
app.post('/admin/orders/:id/submit-to-printify', requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        // Get the order
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const order = orderDoc.data();
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
        }
        else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Sync order status from Printify
app.post('/admin/orders/:id/sync-printify', requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const order = orderDoc.data();
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
        const statusMap = {
            'pending': 'pending',
            'on-hold': 'pending',
            'payment-not-received': 'pending',
            'in-production': 'in_production',
            'fulfilled': 'shipped',
            'canceled': 'cancelled',
        };
        const updates = {
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
        const updatedOrder = updatedOrderDoc.data();
        const hasTrackingNow = !!updatedOrder.trackingNumber;
        const hasNewTracking = hasTrackingNow && !hadTrackingBefore;
        // Send shipping notification email via NexusMail if tracking was just added
        let emailSent = false;
        if (hasNewTracking && updatedOrder.customerEmail) {
            const shippingAddress = updatedOrder.shippingAddress;
            const customerName = shippingAddress
                ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim()
                : 'Customer';
            const emailResult = await (0, nexusmail_1.sendShippingNotification)(db, orderId, updatedOrder.customerEmail, customerName, updatedOrder.trackingNumber, updatedOrder.carrier || 'Carrier', updatedOrder.trackingUrl);
            emailSent = emailResult.success;
        }
        res.json({
            success: true,
            status: updates.status,
            trackingNumber: updates.trackingNumber,
            shippingEmailSent: emailSent,
            message: 'Order status synced from Printify'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Send shipping notification email manually
app.post('/admin/orders/:id/send-shipping-email', requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const order = orderDoc.data();
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
        const result = await (0, nexusmail_1.sendShippingNotification)(db, orderId, order.customerEmail, customerName, order.trackingNumber, order.carrier || 'Carrier', order.trackingUrl);
        if (result.success) {
            res.json({ success: true, message: 'Shipping notification email sent via NexusMail' });
        }
        else {
            res.status(500).json({ success: false, error: result.reason });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Resend order confirmation email
app.post('/admin/orders/:id/resend-confirmation', requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const order = orderDoc.data();
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
        const result = await (0, nexusmail_1.sendOrderConfirmation)(db, orderId, order.customerEmail, customerName, emailItems, order.totalAmount || '0', shippingAddress ? {
            address1: shippingAddress.address1,
            address2: shippingAddress.address2,
            city: shippingAddress.city,
            region: shippingAddress.region,
            zip: shippingAddress.zip,
            country: shippingAddress.country,
        } : undefined);
        if (result.success) {
            res.json({ success: true, message: 'Order confirmation email resent via NexusMail' });
        }
        else {
            res.status(500).json({ success: false, error: result.reason });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Update order status manually
app.patch('/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status, trackingNumber, carrier, notes } = req.body;
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const updates = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (status)
            updates.status = status;
        if (trackingNumber !== undefined)
            updates.trackingNumber = trackingNumber;
        if (carrier !== undefined)
            updates.carrier = carrier;
        if (notes !== undefined)
            updates.notes = notes;
        await db.collection('orders').doc(orderId).update(updates);
        const updatedDoc = await db.collection('orders').doc(orderId).get();
        res.json(docToObject(updatedDoc));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ NEXUSMAIL ADMIN ENDPOINTS ============
// Get NexusMail status and health
app.get('/admin/nexusmail/status', requireAdmin, async (_req, res) => {
    try {
        const service = (0, nexusmail_1.getNexusMailService)(db);
        const isReady = service.isReady();
        const healthScore = service.getHealthScore();
        const stats = await service.getStats();
        res.json({
            ready: isReady,
            provider: isReady ? 'resend' : 'not_configured',
            health: healthScore,
            outboxStats: stats,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Seed default email templates
app.post('/admin/nexusmail/seed-templates', requireAdmin, async (_req, res) => {
    try {
        const service = (0, nexusmail_1.getNexusMailService)(db);
        const templateStore = service.getTemplateStore();
        const seeded = await (0, nexusmail_1.seedDefaultTemplates)(templateStore);
        res.json({
            success: true,
            message: `Seeded ${seeded} templates`,
            templatesSeeded: seeded,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get outbox records
app.get('/admin/nexusmail/outbox', requireAdmin, async (req, res) => {
    try {
        const service = (0, nexusmail_1.getNexusMailService)(db);
        const outboxRepo = service.getOutboxRepo();
        const limit = parseInt(req.query.limit) || 50;
        const records = await outboxRepo.getRecent(limit);
        res.json({ records });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Process pending outbox items
app.post('/admin/nexusmail/process-outbox', requireAdmin, async (req, res) => {
    try {
        const service = (0, nexusmail_1.getNexusMailService)(db);
        const limit = parseInt(req.body.limit) || 10;
        const sent = await service.processOutbox(limit);
        res.json({
            success: true,
            sent,
            message: `Processed ${sent} emails`,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Retry failed outbox items
app.post('/admin/nexusmail/retry-failed', requireAdmin, async (req, res) => {
    try {
        const service = (0, nexusmail_1.getNexusMailService)(db);
        const limit = parseInt(req.body.limit) || 10;
        const sent = await service.retryFailed(limit);
        res.json({
            success: true,
            sent,
            message: `Retried and sent ${sent} emails`,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============ STRIPE WEBHOOKS ============
app.post('/webhooks/stripe', async (req, res) => {
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
        const stripe = new stripe_1.default(stripeSecretKey, { apiVersion: '2023-10-16' });
        let event;
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        }
        catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            res.status(400).json({ error: `Webhook Error: ${err.message}` });
            return;
        }
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
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
                    let cartItems = [];
                    if (cartItemIds.length > 0) {
                        // Use specific cart item IDs from metadata
                        for (const itemId of cartItemIds) {
                            const itemDoc = await db.collection('cartItems').doc(itemId).get();
                            if (itemDoc.exists) {
                                cartItems.push({ id: itemDoc.id, ...itemDoc.data() });
                            }
                        }
                    }
                    else {
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
                        stripePaymentIntentId: session.payment_intent,
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
                        await (0, nexusmail_1.sendOrderConfirmation)(db, orderRef.id, customerEmail, customerName, emailItems, totalAmount.toFixed(2), shippingAddress ? {
                            address1: shippingAddress.address1,
                            address2: shippingAddress.address2,
                            city: shippingAddress.city,
                            region: shippingAddress.region,
                            zip: shippingAddress.zip,
                            country: shippingAddress.country,
                        } : undefined);
                    }
                    // Clear cart items AFTER email is sent
                    const batch = db.batch();
                    for (const item of cartItems) {
                        batch.delete(db.collection('cartItems').doc(item.id));
                    }
                    await batch.commit();
                    console.log(`Cleared ${cartItems.length} cart items for user ${userId}`);
                }
                catch (orderError) {
                    console.error('Error creating order from checkout:', orderError);
                    // Don't fail the webhook - order can be manually reconciled
                }
                break;
            }
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                console.log('Payment succeeded:', paymentIntent.id);
                break;
            }
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ============ ADMIN LIBRARY ENDPOINTS ============
// Admin: Get all library assets with optional filters
app.get('/admin/library', requireAdmin, async (req, res) => {
    try {
        const { ownerType, assetType, mediaType, category, season, event } = req.query;
        let query = db.collection('library_assets');
        if (ownerType)
            query = query.where('ownerType', '==', ownerType);
        if (assetType)
            query = query.where('assetType', '==', assetType);
        if (mediaType)
            query = query.where('mediaType', '==', mediaType);
        if (category)
            query = query.where('category', '==', category);
        if (season)
            query = query.where('season', '==', season);
        if (event)
            query = query.where('event', '==', event);
        const snapshot = await query.get();
        const assets = docsToArray(snapshot);
        const assetsWithSignedUrls = await addSignedUrlsToAssets(assets);
        res.json(assetsWithSignedUrls);
    }
    catch (error) {
        console.error('[Library] Error fetching assets:', error);
        res.status(500).json({ error: error.message });
    }
});
// Admin: Get admin-owned library assets
app.get('/admin/library/admin', requireAdmin, async (req, res) => {
    try {
        const { assetType, mediaType, category, season, event } = req.query;
        let query = db.collection('library_assets').where('ownerType', '==', 'admin');
        if (assetType)
            query = query.where('assetType', '==', assetType);
        if (mediaType)
            query = query.where('mediaType', '==', mediaType);
        if (category)
            query = query.where('category', '==', category);
        if (season)
            query = query.where('season', '==', season);
        if (event)
            query = query.where('event', '==', event);
        const snapshot = await query.get();
        const assets = docsToArray(snapshot);
        const assetsWithSignedUrls = await addSignedUrlsToAssets(assets);
        res.json(assetsWithSignedUrls);
    }
    catch (error) {
        console.error('[Library] Error fetching admin assets:', error);
        res.status(500).json({ error: error.message });
    }
});
// Admin: Get library templates (custom designs saved to library)
app.get('/admin/library/templates', requireAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('customDesigns')
            .where('savedToLibrary', '==', true)
            .get();
        const templates = docsToArray(snapshot);
        res.json(templates);
    }
    catch (error) {
        console.error('[Library] Error fetching templates:', error);
        res.status(500).json({ error: error.message });
    }
});
// Admin: Create library asset
app.post('/admin/library', requireAdmin, async (req, res) => {
    try {
        const assetData = {
            ...req.body,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const docRef = await db.collection('library_assets').add(assetData);
        const doc = await docRef.get();
        res.json(docToObject(doc));
    }
    catch (error) {
        console.error('[Library] Error creating asset:', error);
        res.status(500).json({ error: error.message });
    }
});
// Admin: Update library asset
app.put('/admin/library/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {
            ...req.body,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db.collection('library_assets').doc(id).update(updateData);
        const doc = await db.collection('library_assets').doc(id).get();
        res.json(docToObject(doc));
    }
    catch (error) {
        console.error('[Library] Error updating asset:', error);
        res.status(500).json({ error: error.message });
    }
});
// Admin: Delete library asset
app.delete('/admin/library/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await db.collection('library_assets').doc(id).delete();
        res.json({ success: true });
    }
    catch (error) {
        console.error('[Library] Error deleting asset:', error);
        res.status(500).json({ error: error.message });
    }
});
// PUBLIC TEST: Save graphics (QR-only and/or composite) to library - NO AUTH REQUIRED
// PUBLIC TEST: Get all templates - NO AUTH REQUIRED
// PUBLIC TEST: Create template linked to packet - NO AUTH REQUIRED
// Background queue processor - processes mockup jobs without blocking the response
async function processQueueInBackground() {
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
            if (!claimed)
                continue;
            // Rate limiting: 10 seconds between Printful calls
            await new Promise(resolve => setTimeout(resolve, 10000));
            // Get template
            const templateDoc = await db.collection('productTemplates').doc(job.templateId).get();
            if (!templateDoc.exists) {
                throw new Error(`Template ${job.templateId} not found`);
            }
            const template = templateDoc.data();
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
        }
        catch (error) {
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
app.post('/admin/graphics/save', requireAdmin, async (req, res) => {
    try {
        const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId } = req.body;
        // URLs are generated after packet creation, so no validation here
        const now = admin.firestore.FieldValue.serverTimestamp();
        let qrAssetId = null;
        let compositeAssetId = null;
        // Create QR-only asset if URL provided
        if (qrOnlyUrl) {
            const qrMetadata = { isQrOnly: true };
            if (storeId)
                qrMetadata.storeId = storeId;
            if (channelId)
                qrMetadata.channelId = channelId;
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
            const compositeMetadata = { isComposite: true };
            if (storeId)
                compositeMetadata.storeId = storeId;
            if (channelId)
                compositeMetadata.channelId = channelId;
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
    }
    catch (error) {
        console.error('[Graphics] Error saving graphics:', error);
        res.status(500).json({ error: error.message });
    }
});
// Admin: Full template save with batch mockup generation
app.post('/admin/templates/full-save', requireAdmin, async (req, res) => {
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
    }
    catch (error) {
        console.error('[Templates] Error in full save:', error);
        res.status(500).json({ error: error.message });
    }
});
function generateNanoId(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
// Validate claim code
app.get('/claim/validate/:claimCode', async (req, res) => {
    try {
        const { claimCode } = req.params;
        const doc = await db.collection('claimCodes').doc(claimCode).get();
        if (!doc.exists) {
            res.json({ valid: false, reason: 'Claim code not found' });
            return;
        }
        const claimData = doc.data();
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
    }
    catch (error) {
        console.error('[Claim] Validation error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Claim an item
app.post('/claim/:claimCode', requireAuth, async (req, res) => {
    try {
        const { claimCode } = req.params;
        const userId = req.user?.uid;
        const userEmail = req.user?.email;
        const doc = await db.collection('claimCodes').doc(claimCode).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Claim code not found' });
            return;
        }
        const claimData = doc.data();
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
    }
    catch (error) {
        console.error('[Claim] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get user's claimed instances
app.get('/claimed-instances', requireAuth, async (req, res) => {
    try {
        const userId = req.user?.uid;
        const snapshot = await db.collection('claimedInstances')
            .where('ownerUserId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        const instances = snapshot.docs.map(doc => doc.data());
        res.json(instances);
    }
    catch (error) {
        console.error('[Claim] Get instances error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get single claimed instance
app.get('/claimed-instances/:instanceId', async (req, res) => {
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
    }
    catch (error) {
        console.error('[Claim] Get instance error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update claimed instance destination
app.patch('/claimed-instances/:instanceId', requireAuth, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const { destinationUrl } = req.body;
        const userId = req.user?.uid;
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
    }
    catch (error) {
        console.error('[Claim] Update error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Admin: Generate claim codes
app.post('/admin/claim-codes', requireAdmin, async (req, res) => {
    try {
        const { templateId, packetType, productName, productDescription, previewImageUrl, count = 1 } = req.body;
        if (!templateId || !packetType || !productName) {
            res.status(400).json({ error: 'templateId, packetType, and productName are required' });
            return;
        }
        const codes = [];
        const batch = db.batch();
        for (let i = 0; i < Math.min(count, 100); i++) {
            const claimCode = generateNanoId(12);
            const claimData = {
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
    }
    catch (error) {
        console.error('[Claim] Generate codes error:', error);
        res.status(500).json({ error: error.message });
    }
});
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Export the API function with increased timeout and memory
exports.api = (0, https_1.onRequest)({
    timeoutSeconds: 540, // 9 minutes max
    memory: '1GiB',
    cors: true,
}, app);
// Force deploy: 2026-02-15-v3 - removed /test/ routes, fixed query
//# sourceMappingURL=index.js.map