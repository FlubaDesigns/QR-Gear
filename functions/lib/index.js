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
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map