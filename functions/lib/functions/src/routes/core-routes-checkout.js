"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCoreCheckoutRoutes = registerCoreCheckoutRoutes;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const pricing_1 = require("../services/pricing");
const stripe_1 = __importDefault(require("stripe"));
function registerCoreCheckoutRoutes(app) {
    app.post('/checkout', middleware_1.requireAuth, async (req, res) => {
        try {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(500).json({ error: 'Stripe not configured' });
                return;
            }
            const stripe = new stripe_1.default(stripeKey);
            const userId = req.user.uid;
            const { successUrl, cancelUrl } = req.body;
            const cartSnapshot = await core_1.db.collection('cartItems').where('userId', '==', userId).get();
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
                    price = await (0, pricing_1.calculateAuthoritativePrice)(pricingInput);
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
                    referrerId: req.body.referrerId || '',
                },
            });
            res.json({ sessionId: session.id, url: session.url });
        }
        catch (error) {
            console.error('Checkout error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/checkout/embedded', middleware_1.requireAuth, async (req, res) => {
        try {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(500).json({ error: 'Stripe not configured' });
                return;
            }
            const stripe = new stripe_1.default(stripeKey);
            const userId = req.user.uid;
            const { returnUrl } = req.body;
            const cartSnapshot = await core_1.db.collection('cartItems').where('userId', '==', userId).get();
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
                    price = await (0, pricing_1.calculateAuthoritativePrice)(pricingInput);
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
    app.get('/checkout/session-status', middleware_1.requireAuth, async (req, res) => {
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
    app.get('/checkout/verify/:sessionId', middleware_1.requireAuth, async (req, res) => {
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
            const snapshot = await core_1.db.collection('qrDesigns')
                .where('isPublic', '==', true)
                .limit(50)
                .get();
            const items = (0, core_1.docsToArray)(snapshot);
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
            const bucket = core_1.storage.bucket();
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
    app.get('/library-files/:storeType/:mediaType/:fname', async (req, res) => {
        try {
            const { storeType, mediaType, fname } = req.params;
            if (storeType === 'member') {
                res.status(400).json({ error: 'Use /library-files/member/:userId/:mediaType/:filename' });
                return;
            }
            const storagePath = `library/${storeType}/${mediaType}/${fname}`;
            const bucket = core_1.admin.storage().bucket();
            const file = bucket.file(storagePath);
            const [exists] = await file.exists();
            if (!exists) {
                res.status(404).json({ error: 'File not found' });
                return;
            }
            const [metadata] = await file.getMetadata();
            res.set('Content-Type', metadata.contentType || 'application/octet-stream');
            res.set('Cache-Control', 'public, max-age=3600');
            file.createReadStream().pipe(res);
        }
        catch (e) {
            if (!res.headersSent)
                res.status(500).json({ error: e.message });
        }
    });
    app.get('/library-files/:filename', async (req, res) => {
        try {
            const { filename } = req.params;
            const bucket = core_1.storage.bucket();
            // Search across all storage paths
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
            const snapshot = await core_1.db.collection('library_assets').where('isActive', '==', true).limit(20).get();
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
    app.get('/admin/settings', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const doc = await core_1.db.collection('settings').doc('admin').get();
            res.json(doc.exists ? doc.data() : {});
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/settings', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('settings').doc('admin').set(req.body, { merge: true });
            const doc = await core_1.db.collection('settings').doc('admin').get();
            res.json(doc.data());
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/products', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('products').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const productId = req.body.id || `product_${Date.now()}`;
            await core_1.db.collection('products').doc(productId).set({
                ...req.body,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp()
            });
            const doc = await core_1.db.collection('products').doc(productId).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('products').doc(req.params.id).update({
                ...req.body,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp()
            });
            const doc = await core_1.db.collection('products').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/products/:id/toggle', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('products').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            const current = doc.data().isEnabled || false;
            await core_1.db.collection('products').doc(req.params.id).update({
                isEnabled: !current,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp()
            });
            const updated = await core_1.db.collection('products').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(updated));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('products').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/orders', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('orders').orderBy('createdAt', 'desc').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/orders/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('orders').doc(req.params.id).update({
                ...req.body,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp()
            });
            const doc = await core_1.db.collection('orders').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/users', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('users').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/categories', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('productCategories').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/browsing-history', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const snapshot = await core_1.db.collection('browsingHistory')
                .where('userId', '==', userId)
                .orderBy('viewedAt', 'desc')
                .limit(20)
                .get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/browsing-history', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const docRef = await core_1.db.collection('browsingHistory').add({
                ...req.body,
                userId,
                viewedAt: core_1.admin.firestore.FieldValue.serverTimestamp()
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/coupons/:code', async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('coupons')
                .where('code', '==', req.params.code.toUpperCase())
                .where('isActive', '==', true)
                .limit(1)
                .get();
            if (snapshot.empty) {
                res.status(404).json({ error: 'Coupon not found or expired' });
                return;
            }
            const coupon = (0, core_1.docToObject)(snapshot.docs[0]);
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
}
//# sourceMappingURL=core-routes-checkout.js.map