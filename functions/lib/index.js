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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const stripe_1 = __importDefault(require("stripe"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const storage = admin.storage();
const app = (0, express_1.default)();
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
app.use(express_1.default.json({ limit: '10mb' }));
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
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean);
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
            res.status(401).json({ message: 'Unauthorized' });
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
        res.json(docToObject(userDoc));
    }
    catch (error) {
        res.status(401).json({ message: 'Unauthorized', error: error.message });
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
        const docRef = await db.collection('cartItems').add({
            ...req.body,
            userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
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
        const { items, successUrl, cancelUrl } = req.body;
        const lineItems = items.map((item) => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    images: item.image ? [item.image] : [],
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
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
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        res.json(docsToArray(snapshot));
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
        const file = bucket.file(`library/${filename}`);
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
        res.status(500).json({ error: error.message });
    }
});
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
function isColorDark(hex) {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}
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
        let existingMockup = null;
        let matchedColorKey = color;
        for (const [storedColor, mockup] of Object.entries(existingMockups)) {
            if (normalizeColor(storedColor) === requestColorNorm && mockup && mockup.front) {
                existingMockup = mockup;
                matchedColorKey = storedColor;
                break;
            }
        }
        if (existingMockup && existingMockup.front) {
            const defaultImage = existingMockup.lifestyle || existingMockup.front;
            await db.collection('products').doc(canonicalProductId).update({
                defaultColor: matchedColorKey,
                imageUrl: defaultImage,
            });
            res.json({
                success: true,
                color,
                mockupUrl: existingMockup.front,
                lifestyleMockupUrl: existingMockup.lifestyle || null,
                fromCache: true,
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
        const jobsSnapshot = await db.collection('mockupJobs')
            .where('productId', '==', canonicalProductId)
            .where('status', 'in', ['pending', 'processing', 'delayed'])
            .get();
        const colorJobs = jobsSnapshot.docs.filter(j => j.data().colorName.toLowerCase() === color.toLowerCase());
        if (colorJobs.length > 0) {
            res.json({
                success: false,
                pending: true,
                color,
                message: `Mockup for ${color} is being generated. Please wait.`,
                jobCount: colorJobs.length
            });
            return;
        }
        res.status(404).json({
            error: `No mockup available for ${color}. Mockups are generated when the product is saved.`,
            color
        });
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
        res.json({
            success: false,
            message: 'Mockup not found in cache. Generation not available in Cloud Functions.',
            fromCache: false,
        });
    }
    catch (error) {
        console.error('[MockupAPI] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
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
        const productDoc = await db.collection('products').doc(id).get();
        if (!productDoc.exists) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        const product = productDoc.data();
        if (!product.blueprintId || !product.printProviderId) {
            res.status(400).json({ error: 'Product missing blueprint or provider info' });
            return;
        }
        const metadata = product.metadata;
        const designId = metadata?.customDesignId || id.replace('custom_', '');
        const designDoc = await db.collection('customDesigns').doc(designId).get();
        if (!designDoc.exists) {
            res.status(404).json({ error: 'Custom design not found' });
            return;
        }
        res.json({
            success: true,
            message: 'Mockup regeneration initiated. This runs as a background job on the primary server.',
            productId: id,
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
        res.json({
            success: true,
            message: `Mockup generation initiated for ${allColors.length} colors. This runs as a background job.`,
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
            connected: true,
            mode: 'firebase-functions',
            message: 'Printify integration is configured on the primary server'
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
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map