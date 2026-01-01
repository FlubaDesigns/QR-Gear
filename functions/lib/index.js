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
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const app = (0, express_1.default)();
// CORS middleware (inline to avoid extra dependency)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// Storage interface for Firestore
class FirestoreStorage {
    // Products
    async getProducts() {
        const snapshot = await db.collection('products').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    async getProduct(id) {
        const doc = await db.collection('products').doc(id).get();
        if (!doc.exists)
            return null;
        return { ...doc.data(), id: doc.id };
    }
    async getEnabledProducts() {
        const snapshot = await db.collection('products').where('isEnabled', '==', true).get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    async getFeaturedProducts() {
        const snapshot = await db.collection('products')
            .where('isEnabled', '==', true)
            .where('isFeatured', '==', true)
            .get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    // Custom Designs
    async getCustomDesign(id) {
        const doc = await db.collection('customDesigns').doc(id).get();
        if (!doc.exists)
            return null;
        return { ...doc.data(), id: doc.id };
    }
    async getCustomDesigns() {
        const snapshot = await db.collection('customDesigns').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    // Users
    async getUser(id) {
        const doc = await db.collection('users').doc(id).get();
        if (!doc.exists)
            return null;
        return { ...doc.data(), id: doc.id };
    }
    async getUserByEmail(email) {
        const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
        if (snapshot.empty)
            return null;
        const doc = snapshot.docs[0];
        return { ...doc.data(), id: doc.id };
    }
    // Cart
    async getCartItems(userId) {
        const snapshot = await db.collection('cartItems').where('userId', '==', userId).get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    async addToCart(item) {
        const docRef = await db.collection('cartItems').add({
            ...item,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await docRef.get();
        return { ...doc.data(), id: doc.id };
    }
    async removeFromCart(id) {
        await db.collection('cartItems').doc(id).delete();
    }
    async clearCart(userId) {
        const snapshot = await db.collection('cartItems').where('userId', '==', userId).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    // Orders
    async getOrders() {
        const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    async getOrder(id) {
        const doc = await db.collection('orders').doc(id).get();
        if (!doc.exists)
            return null;
        return { ...doc.data(), id: doc.id };
    }
    async getUserOrders(userId) {
        const snapshot = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    async createOrder(order) {
        const docRef = await db.collection('orders').add({
            ...order,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const doc = await docRef.get();
        return { ...doc.data(), id: doc.id };
    }
    // Admin Settings
    async getAdminSettings() {
        const doc = await db.collection('settings').doc('admin').get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    // QR Templates
    async getQrTemplates() {
        const snapshot = await db.collection('qrTemplates').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    async getQrTemplate(id) {
        const doc = await db.collection('qrTemplates').doc(id).get();
        if (!doc.exists)
            return null;
        return { ...doc.data(), id: doc.id };
    }
    // Hosting Tiers
    async getHostingTiers() {
        const snapshot = await db.collection('hostingTiers').orderBy('sortOrder', 'asc').get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    }
    // Partner Stores
    async getPartnerStore(id) {
        const doc = await db.collection('partnerStores').doc(id).get();
        if (!doc.exists)
            return null;
        return { ...doc.data(), id: doc.id };
    }
    async getPartnerStoreBySlug(slug) {
        const snapshot = await db.collection('partnerStores').where('slug', '==', slug).limit(1).get();
        if (snapshot.empty)
            return null;
        const doc = snapshot.docs[0];
        return { ...doc.data(), id: doc.id };
    }
}
const storage = new FirestoreStorage();
// API Routes
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'firebase', timestamp: new Date().toISOString() });
});
// Products
app.get('/api/products', async (req, res) => {
    try {
        const featured = req.query.featured === 'true';
        const products = featured
            ? await storage.getFeaturedProducts()
            : await storage.getEnabledProducts();
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await storage.getProduct(req.params.id);
        if (!product) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Custom Designs
app.get('/api/designs/:id', async (req, res) => {
    try {
        const design = await storage.getCustomDesign(req.params.id);
        if (!design) {
            res.status(404).json({ error: 'Design not found' });
            return;
        }
        res.json(design);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Auth endpoint (simplified - uses Firebase Auth on client)
app.get('/api/auth/user', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const user = await storage.getUser(decodedToken.uid);
        if (!user) {
            // Create user if doesn't exist
            const newUser = {
                id: decodedToken.uid,
                email: decodedToken.email,
                displayName: decodedToken.name || decodedToken.email?.split('@')[0],
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(decodedToken.uid).set(newUser);
            res.json(newUser);
            return;
        }
        res.json(user);
    }
    catch (error) {
        res.status(401).json({ message: 'Unauthorized', error: error.message });
    }
});
// Cart
app.get('/api/cart', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const items = await storage.getCartItems(decodedToken.uid);
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/cart', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const item = await storage.addToCart({ ...req.body, userId: decodedToken.uid });
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.delete('/api/cart/:id', async (_req, res) => {
    try {
        await storage.removeFromCart(_req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Orders
app.get('/api/orders', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const orders = await storage.getUserOrders(decodedToken.uid);
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// QR Templates
app.get('/api/qr-templates', async (_req, res) => {
    try {
        const templates = await storage.getQrTemplates();
        res.json(templates);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Hosting Tiers
app.get('/api/hosting-tiers', async (_req, res) => {
    try {
        const tiers = await storage.getHostingTiers();
        res.json(tiers);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Partner Stores
app.get('/api/stores/:slug', async (req, res) => {
    try {
        const store = await storage.getPartnerStoreBySlug(req.params.slug);
        if (!store) {
            res.status(404).json({ error: 'Store not found' });
            return;
        }
        res.json(store);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Admin Settings (public portions)
app.get('/api/settings', async (_req, res) => {
    try {
        const settings = await storage.getAdminSettings();
        res.json(settings || {});
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Export the Express app as a Cloud Function
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map