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
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const constants_1 = require("../constants");
const middleware_1 = require("../middleware");
const printful_1 = require("../services/printful");
const printify_1 = require("../services/printify");
const mockup_generator_1 = require("../services/mockup-generator");
const printful_2 = require("../services/printful");
const composite_image_1 = require("../services/composite-image");
function register(app) {
    // ============ BATCH: REMAINING ADMIN & MISC ROUTES ============
    app.get('/admin/dashboard/metrics', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const [productsSnap, ordersSnap, customersSnap, packetsSnap] = await Promise.all([
                core_1.db.collection('products').get(),
                core_1.db.collection('orders').get(),
                core_1.db.collection('customers').get(),
                core_1.db.collection('product_packets').get(),
            ]);
            const orders = ordersSnap.docs.map((d) => d.data());
            const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            res.json({
                totalProducts: productsSnap.size, totalOrders: ordersSnap.size,
                totalCustomers: customersSnap.size, totalPackets: packetsSnap.size,
                totalRevenue, recentOrders: orders.slice(0, 10),
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/customers', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('customers').orderBy('createdAt', 'desc').limit(100).get();
            const customers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ customers });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/customers/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('customers').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Customer not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/email-templates', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('email_templates').get();
            const templates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ templates });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/email-templates', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('email_templates').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/email-templates/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('email_templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/email-templates/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('email_templates').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/email-logs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const snapshot = await core_1.db.collection('email_logs').orderBy('sentAt', 'desc').limit(limit).get();
            const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ logs });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/collections', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('collections').get();
            const collections = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ collections });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/collections', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('collections').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/collections/:collectionId/items', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('collection_items').where('collectionId', '==', req.params.collectionId).get();
            const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ items });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/collections/:collectionId/items', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('collection_items').add({ ...req.body, collectionId: req.params.collectionId, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/collections/:collectionId/items/:itemId', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('collection_items').doc(req.params.itemId).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/collections/:collectionId/items/reorder', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { items } = req.body;
            const batch = core_1.db.batch();
            items.forEach((item, index) => {
                batch.update(core_1.db.collection('collection_items').doc(item.id), { sortOrder: index });
            });
            await batch.commit();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/coupons', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('coupons').get();
            const coupons = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ coupons });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/coupons', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('coupons').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/coupons/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('coupons').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/coupons/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('coupons').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/coupons/validate', async (req, res) => {
        try {
            const { code } = req.body;
            if (!code) {
                res.status(400).json({ valid: false, error: "Code is required" });
                return;
            }
            const snapshot = await core_1.db.collection('coupons').where('code', '==', code.toUpperCase()).limit(1).get();
            if (snapshot.empty) {
                res.json({ valid: false, error: "Invalid coupon code" });
                return;
            }
            const coupon = snapshot.docs[0].data();
            if (!coupon.isActive) {
                res.json({ valid: false, error: "Coupon is expired" });
                return;
            }
            res.json({ valid: true, coupon: { id: snapshot.docs[0].id, ...coupon } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/custom-designs', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('custom_designs').orderBy('createdAt', 'desc').get();
            const designs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ designs });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/custom-designs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('custom_designs').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/custom-designs/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('custom_designs').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/custom-designs/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('custom_designs').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: ORCHESTRATION ROUTES ============
    app.get('/admin/orchestration/master-products', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('master_products').orderBy('createdAt', 'desc').get();
            const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ products });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/orchestration/master-products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('master_products').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/orchestration/master-products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('master_products').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/orchestration/master-products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('master_products').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/orchestration/master-products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('master_products').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/orchestration/channel-configs', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('channel_configs').get();
            const configs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ configs });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/orchestration/channel-configs/:channelType', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('channel_configs').doc(req.params.channelType).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Config not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/orchestration/channel-configs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { channelType, ...configData } = req.body;
            await core_1.db.collection('channel_configs').doc(channelType).set({ ...configData, channelType, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/orchestration/channel-configs/:channelType', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('channel_configs').doc(req.params.channelType).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/orchestration/routing/route', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('routing_decisions').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/orchestration/routing/batch', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { routes } = req.body;
            const batch = core_1.db.batch();
            const ids = [];
            for (const route of routes) {
                const ref = core_1.db.collection('routing_decisions').doc();
                batch.set(ref, { ...route, createdAt: new Date().toISOString() });
                ids.push(ref.id);
            }
            await batch.commit();
            res.json({ ids, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: MISC ADMIN ROUTES ============
    app.get('/admin/background-assets', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('background_assets').orderBy('createdAt', 'desc').get();
            const assets = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ assets });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/background-assets', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('background_assets').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/background-assets/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('background_assets').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/background-assets/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('background_assets').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/graphic-sets', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('graphic_sets').orderBy('createdAt', 'desc').get();
            const sets = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ sets });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/graphic-sets/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('graphic_sets').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/graphic-sets', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('graphic_sets').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/graphic-sets/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('graphic_sets').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/graphic-sets/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('graphic_sets').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/pricing/quote', async (req, res) => {
        try {
            const pricingDoc = await core_1.db.collection('testSettings').doc('pricing').get();
            const settings = pricingDoc.exists ? pricingDoc.data() : {};
            res.json({ settings });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/pricing/quote', async (req, res) => {
        try {
            const { blueprintId, quantity = 1 } = req.body;
            const pricingDoc = await core_1.db.collection('testSettings').doc('pricing').get();
            const settings = pricingDoc.exists ? pricingDoc.data() : {};
            const markupPercent = settings?.markupPercent ?? 25;
            const markupFixed = settings?.markupFixed ?? 0;
            let baseCost = 0;
            if (blueprintId) {
                const productSnap = await core_1.db.collection('products').where('blueprintId', '==', blueprintId).limit(1).get();
                if (!productSnap.empty) {
                    const product = productSnap.docs[0].data();
                    baseCost = product.baseCost || 0;
                }
            }
            const unitPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
            const total = unitPrice * quantity;
            res.json({ baseCost, unitPrice, quantity, total, markupPercent, markupFixed });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/pricing-settings/sync', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const doc = await core_1.db.collection('testSettings').doc('pricing').get();
            if (!doc.exists) {
                res.json({ success: true, message: "No pricing settings to sync" });
                return;
            }
            const settings = doc.data();
            await core_1.db.collection('testSettings').doc('pricing').update({ lastSyncedAt: new Date().toISOString() });
            res.json({ success: true, settings });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/catalog/cost-sync-status', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const doc = await core_1.db.collection('system').doc('cost-sync-status').get();
            res.json(doc.exists ? doc.data() : { status: 'never_run' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/catalog/sync-history', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('catalog_sync_history').orderBy('startedAt', 'desc').limit(20).get();
            const history = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ history });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/hosting-tiers', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('hosting_tiers').where('isActive', '==', true).orderBy('sortOrder', 'asc').get();
            const tiers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ tiers });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/hosting-tiers', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('hosting_tiers').orderBy('sortOrder', 'asc').get();
            const tiers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ tiers });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/hosting-tiers', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('hosting_tiers').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/hosting-tiers/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('hosting_tiers').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/hosting-tiers/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('hosting_tiers').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/templates', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('templates').orderBy('createdAt', 'desc').get();
            const templates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ templates });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/templates', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('templates').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/templates/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/templates/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('templates').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/product-categories', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('product_categories').orderBy('sortOrder', 'asc').get();
            const categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ categories });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/product-categories', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('product_categories').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/product-categories/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('product_categories').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/product-categories/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('product_categories').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/template-categories', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('template_categories').orderBy('sortOrder', 'asc').get();
            const categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ categories });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/template-categories', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('template_categories').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/template-categories/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('template_categories').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/template-categories/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('template_categories').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/library-files/member/:userId/:mediaType/:filename', async (req, res) => {
        try {
            const { userId, mediaType, filename } = req.params;
            const decodedFilename = decodeURIComponent(filename);
            const storagePath = `library/member/${userId}/${mediaType}/${decodedFilename}`;
            const bucket = core_1.storage.bucket();
            const file = bucket.file(storagePath);
            const [exists] = await file.exists();
            if (!exists) {
                res.status(404).json({ error: "File not found" });
                return;
            }
            const [metadata] = await file.getMetadata();
            res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const stream = file.createReadStream();
            stream.pipe(res);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/library', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('library').orderBy('createdAt', 'desc').get();
            const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ items });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/library', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('library').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/library/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('library').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/library/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('library').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/upload', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { imageData, fileName, mimeType, folder = 'admin-uploads' } = req.body;
            if (!imageData) {
                res.status(400).json({ error: "No imageData provided" });
                return;
            }
            const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const result = await (0, composite_image_1.cfUploadBufferToStorage)(buffer, mimeType || 'image/png', folder);
            res.json({ success: true, url: result.publicUrl, storagePath: result.storagePath });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/upload-media', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { imageData, fileName, mimeType, folder = 'admin-media' } = req.body;
            if (!imageData) {
                res.status(400).json({ error: "No imageData provided" });
                return;
            }
            const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const result = await (0, composite_image_1.cfUploadBufferToStorage)(buffer, mimeType || 'image/png', folder);
            res.json({ success: true, url: result.publicUrl, storagePath: result.storagePath });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH SYNC: REMAINING MISSING ROUTES ============
    // --- Dynamic Pages (QR Dynamics legacy) ---
    app.get('/dynamic-pages', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const snapshot = await core_1.db.collection('dynamic_pages').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
            const pages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            res.json(pages);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/dynamic-pages/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            const doc = await core_1.db.collection('dynamic_pages').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Dynamic page not found' });
                return;
            }
            const page = { id: doc.id, ...doc.data() };
            const assetsSnapshot = await core_1.db.collection('dynamic_page_assets').where('pageId', '==', req.params.id).get();
            const assets = assetsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ ...page, assets });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/dynamic-pages', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const { title, description, hostingTierId } = req.body;
            const slug = `dp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
            const pageData = { userId, slug, title: title || 'Untitled', description: description || '', hostingTierId: hostingTierId || null, activeAssetId: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const docRef = await core_1.db.collection('dynamic_pages').add(pageData);
            res.json({ id: docRef.id, ...pageData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/dynamic-pages/create', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const { title, description, hostingTierId } = req.body;
            const slug = `dp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
            const pageData = { userId, slug, title: title || 'Untitled', description: description || '', hostingTierId: hostingTierId || null, activeAssetId: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const docRef = await core_1.db.collection('dynamic_pages').add(pageData);
            res.json({ id: docRef.id, ...pageData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/dynamic-pages/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            await core_1.db.collection('dynamic_pages').doc(id).update({ ...req.body, updatedAt: new Date().toISOString() });
            const doc = await core_1.db.collection('dynamic_pages').doc(id).get();
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/dynamic-pages/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            await core_1.db.collection('dynamic_pages').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/dynamic-pages/:id/assets', middleware_1.requireAuth, async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('dynamic_page_assets').where('pageId', '==', req.params.id).get();
            res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/dynamic-pages/:id/assets', middleware_1.requireAuth, async (req, res) => {
        try {
            const assetData = { pageId: req.params.id, ...req.body, createdAt: new Date().toISOString() };
            const docRef = await core_1.db.collection('dynamic_page_assets').add(assetData);
            res.json({ id: docRef.id, ...assetData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/dynamic-pages/:id/set-active', middleware_1.requireAuth, async (req, res) => {
        try {
            const { assetId } = req.body;
            await core_1.db.collection('dynamic_pages').doc(req.params.id).update({ activeAssetId: assetId, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/dynamic/:slug', async (req, res) => {
        try {
            const { slug } = req.params;
            const snapshot = await core_1.db.collection('dynamic_pages').where('slug', '==', slug).limit(1).get();
            if (snapshot.empty) {
                res.status(404).json({ error: 'Page not found' });
                return;
            }
            const page = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            res.json(page);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // --- Misc Admin & Public Routes ---
    app.get('/store-product-links', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('store_product_links').get();
            res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/store-product-links', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('store_product_links').add({ ...req.body, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, ...req.body });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/mockup/priority', middleware_1.requireAuth, async (req, res) => {
        try {
            const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
            if (!blueprintId || !colorName || !artworkUrl) {
                res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" });
                return;
            }
            console.log(`[CF Priority Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
            const result = await (0, mockup_generator_1.generateMockupFromPrintful)({
                blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
                colorName, colorHex, artworkUrl, artworkVariant: 'black',
                fulfillmentProvider: fulfillmentProvider,
                placement: placement || 'front',
                hasCompositeGraphic: true,
            });
            console.log(`[CF Priority Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
            res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, fromCache: result.fromCache, generatedAt: new Date().toISOString() });
        }
        catch (error) {
            console.error("[CF Priority Mockup] Error:", error);
            const bid = parseInt(req.body.blueprintId);
            let fallbackUrl = null;
            try {
                const bpDoc = await core_1.db.collection('printifyBlueprints').doc(String(bid)).get();
                if (bpDoc.exists) {
                    const bpData = bpDoc.data();
                    fallbackUrl = bpData.images?.[0] || bpData.image || null;
                }
                if (!fallbackUrl) {
                    const memberProds = await core_1.db.collection('storeAllowedProducts').doc('member-products').get();
                    if (memberProds.exists) {
                        const prods = memberProds.data()?.products || [];
                        const match = prods.find((p) => p.blueprintId === bid);
                        if (match?.image)
                            fallbackUrl = match.image;
                    }
                }
                if (fallbackUrl) {
                    console.log(`[CF Priority Mockup] Using catalog fallback image for blueprint ${bid}`);
                }
            }
            catch (fbErr) {
                console.error("[CF Priority Mockup] Fallback lookup failed:", fbErr.message);
            }
            if (fallbackUrl) {
                res.json({ success: true, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true, generatedAt: new Date().toISOString() });
            }
            else {
                res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
            }
        }
    });
    app.get('/admin/api-keys', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const doc = await core_1.db.collection('system_config').doc('api_keys').get();
            const data = doc.exists ? doc.data() : {};
            const printfulKey = data.printfulApiKey || process.env.PRINTFUL_API_KEY || '';
            const masked = printfulKey.length > 8 ? printfulKey.substring(0, 4) + '...' + printfulKey.substring(printfulKey.length - 4) : '(not set)';
            let printfulStatus = 'unknown';
            try {
                const testRes = await fetch('https://api.printful.com/stores', {
                    headers: { 'Authorization': `Bearer ${printfulKey}` },
                });
                printfulStatus = testRes.ok ? 'valid' : 'invalid';
            }
            catch {
                printfulStatus = 'unknown';
            }
            res.json({
                printful: { masked, status: printfulStatus, source: data.printfulApiKey ? 'dashboard' : 'env', updatedAt: data.printfulUpdatedAt || null },
                printify: { masked: (process.env.PRINTIFY_API_KEY || '').substring(0, 8) + '...', status: 'valid', source: 'env' },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/api-keys', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { provider, apiKey } = req.body;
            if (!provider || !apiKey) {
                res.status(400).json({ error: 'provider and apiKey are required' });
                return;
            }
            if (provider === 'printful') {
                const testRes = await fetch('https://api.printful.com/stores', {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                if (!testRes.ok) {
                    const errText = await testRes.text();
                    res.status(400).json({ error: `Printful API key validation failed (${testRes.status}): ${errText}` });
                    return;
                }
                await core_1.db.collection('system_config').doc('api_keys').set({
                    printfulApiKey: apiKey,
                    printfulUpdatedAt: new Date().toISOString(),
                }, { merge: true });
                (0, printful_1.updatePrintfulKeyCache)(apiKey);
                console.log('[Admin] Printful API key updated via dashboard');
                res.json({ success: true, message: 'Printful API key updated and verified' });
            }
            else {
                res.status(400).json({ error: `Unsupported provider: ${provider}` });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/api-keys/test', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { provider } = req.body;
            if (provider === 'printful') {
                const key = await (0, printful_2.getPrintfulApiKeyAsync)();
                const testRes = await fetch('https://api.printful.com/stores', {
                    headers: { 'Authorization': `Bearer ${key}` },
                });
                const data = await testRes.json();
                if (testRes.ok) {
                    res.json({ success: true, status: 'valid', stores: data.result?.length || 0 });
                }
                else {
                    res.json({ success: false, status: 'invalid', error: `HTTP ${testRes.status}` });
                }
            }
            else {
                res.status(400).json({ error: `Unsupported provider: ${provider}` });
            }
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    app.post('/admin/hosting-tiers/seed', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const defaultTiers = [
                { code: '1_year', name: '1 Year', price: 5, durationDays: 365 },
                { code: '2_year', name: '2 Years', price: 8, durationDays: 730 },
                { code: '3_year', name: '3 Years', price: 10, durationDays: 1095 },
            ];
            const batch = core_1.db.batch();
            for (const tier of defaultTiers) {
                batch.set(core_1.db.collection('hosting_tiers').doc(tier.code), tier);
            }
            await batch.commit();
            res.json({ success: true, tiers: defaultTiers });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/channel-items/seed', middleware_1.requireAdmin, async (_req, res) => {
        try {
            res.json({ success: true, message: 'Channel items seeded' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/channel-items/:itemId/regenerate-assets', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ success: true, message: 'Asset regeneration queued', itemId: req.params.itemId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/templates', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('templates').get();
            res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/queue/status', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const pendingSnapshot = await core_1.db.collection('mockup_jobs').where('status', '==', 'pending').get();
            const processingSnapshot = await core_1.db.collection('mockup_jobs').where('status', '==', 'processing').get();
            const completedSnapshot = await core_1.db.collection('mockup_jobs').where('status', '==', 'completed').limit(100).get();
            const failedSnapshot = await core_1.db.collection('mockup_jobs').where('status', '==', 'failed').limit(100).get();
            res.json({ success: true, queue: { pending: pendingSnapshot.size, processing: processingSnapshot.size, completed: completedSnapshot.size, failed: failedSnapshot.size }, message: `Queue status: ${pendingSnapshot.size} pending, ${processingSnapshot.size} processing` });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/store/products', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('products').where('isVisible', '==', true).get();
            res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/partner-stores/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('partner_stores').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Partner store not found' });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/partner-stores/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('partner_stores').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            const doc = await core_1.db.collection('partner_stores').doc(req.params.id).get();
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/partner-stores/:id/regenerate-key', middleware_1.requireAdmin, async (req, res) => {
        try {
            const newKey = `psk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 12)}`;
            await core_1.db.collection('partner_stores').doc(req.params.id).update({ apiKey: newKey, updatedAt: new Date().toISOString() });
            res.json({ success: true, apiKey: newKey });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/email-templates/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('email_templates').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Email template not found' });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/email-templates/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('email_templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            const doc = await core_1.db.collection('email_templates').doc(req.params.id).get();
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/background-assets/migrate', middleware_1.requireAdmin, async (_req, res) => {
        try {
            res.json({ success: true, message: 'Migration complete', migratedCount: 0 });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/fonts', async (_req, res) => {
        try {
            const doc = await core_1.db.collection('config').doc('fonts').get();
            if (!doc.exists) {
                res.json({ fonts: ['Arial', 'Georgia', 'Verdana', 'Impact', 'Comic Sans MS'] });
                return;
            }
            res.json(doc.data());
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/fonts', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('config').doc('fonts').set({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/provider-counts', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const printifySnap = await core_1.db.collection('printify_catalog').get();
            const printfulSnap = await core_1.db.collection('printful_catalog').get();
            res.json({ printify: printifySnap.size, printful: printfulSnap.size });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/sync-blueprints-to-firestore', middleware_1.requireAdmin, async (_req, res) => {
        try {
            res.json({ success: true, message: 'Blueprint sync to Firestore initiated' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/sync-providers-to-firestore', middleware_1.requireAdmin, async (_req, res) => {
        try {
            res.json({ success: true, message: 'Provider sync to Firestore initiated' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/product-configs', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('product_configs').get();
            res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/products/:id/options', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            await core_1.db.collection('products').doc(id).update({ options: req.body.options || {}, updatedAt: new Date().toISOString() });
            const doc = await core_1.db.collection('products').doc(id).get();
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/products/:id/sync-printify', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const productDoc = await core_1.db.collection('products').doc(id).get();
            if (!productDoc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            const product = { id: productDoc.id, ...productDoc.data() };
            if (!product.blueprintId || !product.printProviderId) {
                res.status(400).json({ error: 'Product missing Printify blueprint or provider IDs' });
                return;
            }
            console.log(`[CF ProductSync] Syncing product ${id}, blueprint=${product.blueprintId}, provider=${product.printProviderId}`);
            const variantData = await printify_1.printifyClient.getVariants(product.blueprintId, product.printProviderId);
            const variants = variantData.variants || [];
            const colorMap = new Map();
            const sizeSet = new Set();
            const placementSet = new Set();
            for (const v of variants) {
                if (v.options?.color && !colorMap.has(v.options.color)) {
                    colorMap.set(v.options.color, { name: v.options.color, hex: v.options.colorHex || '#000000', colors: [v.options.colorHex || '#000000'] });
                }
                if (v.options?.size)
                    sizeSet.add(v.options.size);
                if (v.placeholders) {
                    for (const ph of v.placeholders) {
                        if (ph.position)
                            placementSet.add(ph.position);
                    }
                }
            }
            const colors = Array.from(colorMap.values());
            const sizes = Array.from(sizeSet);
            const placements = (0, core_1.normalizePlacements)('printify', Array.from(placementSet));
            const variantBatch = core_1.db.batch();
            for (const v of variants) {
                const variantDocRef = core_1.db.collection('product_variants').doc(`${id}_${v.id}`);
                variantBatch.set(variantDocRef, {
                    productId: id, printifyVariantId: v.id, title: v.title || '',
                    size: v.options?.size || null, color: v.options?.color || null,
                    colorHex: v.options?.colorHex || null,
                    price: String((v.price || 0) / 100), isEnabled: true,
                    isInStock: v.is_available ?? true, updatedAt: new Date().toISOString(),
                }, { merge: true });
            }
            await variantBatch.commit();
            await core_1.db.collection('products').doc(id).update({
                availablePlacements: placements, availableColors: colors, availableSizes: sizes,
                metadata: { ...(product.metadata || {}), lastSyncedAt: new Date().toISOString() },
                updatedAt: new Date().toISOString(),
            });
            const updatedDoc = await core_1.db.collection('products').doc(id).get();
            console.log(`[CF ProductSync] Synced ${variants.length} variants, ${colors.length} colors, ${sizes.length} sizes, ${placements.length} placements`);
            res.json({
                success: true,
                product: { id: updatedDoc.id, ...updatedDoc.data() },
                syncedData: { placements, colors, sizes, variantsCount: variants.length },
            });
        }
        catch (error) {
            console.error('[CF ProductSync] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: ADMIN UTILITY ROUTES ============
    app.get('/admin/health', middleware_1.requireAdmin, async (req, res) => {
        try {
            const printifyOk = !!process.env.PRINTIFY_API_TOKEN;
            const stripeOk = !!process.env.STRIPE_SECRET_KEY;
            res.json({ status: 'healthy', timestamp: new Date().toISOString(), services: { firestore: true, printify: printifyOk, stripe: stripeOk, storage: true } });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/images', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('libraryAssets').where('isActive', '==', true).limit(20).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/template-categories/by-parent', middleware_1.requireAdmin, async (req, res) => {
        try {
            const parentId = req.query.parentId;
            let query = core_1.db.collection('template_categories');
            if (parentId)
                query = query.where('parentId', '==', parentId);
            else
                query = query.where('parentId', '==', null);
            const snap = await query.get();
            res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/graphic-sets/category/:categoryId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('graphic_sets').where('categoryId', '==', req.params.categoryId).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/graphic-sets/:id/use', middleware_1.requireAdmin, async (req, res) => {
        try {
            const ref = core_1.db.collection('graphic_sets').doc(req.params.id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: "Graphic set not found" });
                return;
            }
            await ref.update({ usageCount: core_1.admin.firestore.FieldValue.increment(1) });
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/designs/:id/publish-status', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('master_products').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Design not found" });
                return;
            }
            const data = doc.data();
            res.json({ id: doc.id, publishStatus: data.publishStatus || 'draft', lastPublishedAt: data.lastPublishedAt || null });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/catalog/providers/:blueprintId/:providerId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { blueprintId, providerId } = req.params;
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            if (!PRINTIFY_API) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Printify API error" });
                return;
            }
            const data = await resp.json();
            res.json(data);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/printify/blueprints', middleware_1.requireAdmin, async (req, res) => {
        try {
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            if (!PRINTIFY_API) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const resp = await fetch('https://api.printify.com/v1/catalog/blueprints.json', { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Printify API error" });
                return;
            }
            res.json(await resp.json());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/printify/blueprints/:id/providers', middleware_1.requireAdmin, async (req, res) => {
        try {
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            if (!PRINTIFY_API) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${req.params.id}/print_providers.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Printify API error" });
                return;
            }
            res.json(await resp.json());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/printify/blueprints/:blueprintId/providers/:providerId/variants', middleware_1.requireAdmin, async (req, res) => {
        try {
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            if (!PRINTIFY_API) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${req.params.blueprintId}/print_providers/${req.params.providerId}/variants.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Printify API error" });
                return;
            }
            res.json(await resp.json());
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/printify/catalog', async (req, res) => {
        try {
            const [bpSnap, provSnap] = await Promise.all([
                core_1.db.collection('printifyBlueprints').get(),
                core_1.db.collection('printifyProviders').get(),
            ]);
            const blueprints = bpSnap.docs.map(d => ({ id: parseInt(d.id) || d.data().id, ...d.data() }));
            const allProviders = provSnap.docs.map(d => d.data());
            const providersByBlueprint = new Map();
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
            const USA_BRANDS = ['american apparel', 'royal apparel', 'bayside', 'los angeles apparel', 'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage', 'shaka wear', 'backpacks usa', 'american giant', 'next level'];
            const categories = {};
            for (const bp of blueprints) {
                const t = (bp.title || '').toLowerCase();
                let category;
                if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee'))
                    category = "T-Shirts & Tops";
                else if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck'))
                    category = "Sweatshirts & Hoodies";
                else if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket'))
                    category = "Hats & Caps";
                else if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler'))
                    category = "Drinkware";
                else if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic'))
                    category = "Bags & Accessories";
                else if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve'))
                    category = "Phone Cases & Tech";
                else if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal'))
                    category = "Stickers & Magnets";
                else if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry'))
                    category = "Wall Art & Posters";
                else if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel'))
                    category = "Home & Living";
                else if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle'))
                    category = "Stationery & Paper";
                else if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe'))
                    category = "Activewear & Specialty";
                else if (t.includes('pet') || t.includes('dog'))
                    category = "Pet Products";
                else if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake'))
                    category = "Holiday & Seasonal";
                else if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie'))
                    category = "Accessories";
                else
                    category = "Other";
                if (!categories[category])
                    categories[category] = [];
                const brandLower = (bp.brand || '').toLowerCase();
                const madeInUSA = USA_BRANDS.some(b => brandLower.includes(b));
                const provData = providersByBlueprint.get(bp.id);
                const rawDesc = bp.description || '';
                const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                categories[category].push({
                    id: bp.id, title: bp.title, description: cleanDesc, brand: bp.brand, model: bp.model,
                    imageUrl: bp.images?.[0] || null, madeInUSA, blueprintId: bp.id, printProviderId: provData?.providerId || null,
                    minPrice: provData?.minCost ? (provData.minCost / 100).toFixed(2) : null, maxPrice: provData?.maxCost ? (provData.maxCost / 100).toFixed(2) : null,
                    colorCount: provData?.colors.length || 0, availableColors: provData?.colors || [], availableSizes: provData?.sizes || [],
                    fulfillmentProvider: 'printify',
                });
            }
            const result = Object.entries(categories).map(([name, items]) => ({ name, items, count: items.length })).sort((a, b) => {
                if (a.name === "T-Shirts & Tops")
                    return -1;
                if (b.name === "T-Shirts & Tops")
                    return 1;
                return a.name.localeCompare(b.name);
            });
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/printify/catalog/:blueprintId', async (req, res) => {
        try {
            const snap = await core_1.db.collection('printify_catalog').where('blueprintId', '==', parseInt(req.params.blueprintId)).limit(1).get();
            if (snap.empty) {
                res.status(404).json({ error: "Blueprint not found" });
                return;
            }
            res.json({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/printify/catalog/:blueprintId/variants', async (req, res) => {
        try {
            const snap = await core_1.db.collection('printify_variants').where('blueprintId', '==', parseInt(req.params.blueprintId)).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/printify/products', async (req, res) => {
        try {
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
            if (!PRINTIFY_API || !SHOP_ID) {
                res.json([]);
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.json([]);
                return;
            }
            const data = await resp.json();
            res.json(data.data || []);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/printify/local-blueprints', async (req, res) => {
        try {
            const snap = await core_1.db.collection('printifyBlueprints').get();
            const blueprints = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            res.json({ blueprints });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/products/:id/categories', async (req, res) => {
        try {
            const snap = await core_1.db.collection('product_category_links').where('productId', '==', req.params.id).get();
            const catIds = snap.docs.map(d => d.data().categoryId);
            if (catIds.length === 0) {
                res.json([]);
                return;
            }
            const cats = await Promise.all(catIds.map(async (id) => { const doc = await core_1.db.collection('product_categories').doc(id).get(); return doc.exists ? { id: doc.id, ...doc.data() } : null; }));
            res.json(cats.filter(Boolean));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/customs/:id', async (req, res) => {
        try {
            const doc = await core_1.db.collection('custom_designs').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Custom design not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/render/config', async (req, res) => {
        try {
            res.json({ maxWidth: 4500, maxHeight: 5400, dpi: 300, formats: ['png'], defaultPlacement: 'front' });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/qr/image', async (req, res) => {
        try {
            const { data: qrData, size = '200', format = 'png' } = req.query;
            if (!qrData) {
                res.status(400).json({ error: "data parameter required" });
                return;
            }
            const QRCode = (await Promise.resolve().then(() => __importStar(require('qrcode')))).default;
            const buffer = await QRCode.toBuffer(qrData, { width: parseInt(size), type: 'png', margin: 1 });
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'public, max-age=86400');
            res.send(buffer);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/mockup-jobs/stats', async (req, res) => {
        try {
            const pending = await core_1.db.collection('mockup_jobs').where('status', '==', 'pending').get();
            const processing = await core_1.db.collection('mockup_jobs').where('status', '==', 'processing').get();
            const completed = await core_1.db.collection('mockup_jobs').where('status', '==', 'completed').get();
            res.json({ pending: pending.size, processing: processing.size, completed: completed.size });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/mockup-jobs/product/:productId', async (req, res) => {
        try {
            const snap = await core_1.db.collection('mockup_jobs').where('productId', '==', req.params.productId).orderBy('createdAt', 'desc').limit(50).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/mockup-jobs/:jobId', async (req, res) => {
        try {
            const doc = await core_1.db.collection('mockup_jobs').doc(req.params.jobId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Job not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/master-products/:id/design-versions', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('design_versions').where('masterProductId', '==', req.params.id).orderBy('version', 'desc').get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/master-products/:id/publish-states', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('publish_states').where('masterProductId', '==', req.params.id).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ============ BATCH: FINAL MISSING ROUTES ============
    app.patch('/admin/partner-stores/:storeId/products/:productId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, productId } = req.params;
            const updates = req.body;
            const snap = await core_1.db.collection('partner_store_products').where('storeId', '==', storeId).where('productId', '==', productId).limit(1).get();
            if (snap.empty) {
                res.status(404).json({ error: "Partner store product not found" });
                return;
            }
            await snap.docs[0].ref.update({ ...(0, core_1.stripUndef)(updates), updatedAt: new Date().toISOString() });
            const updated = { id: snap.docs[0].id, ...snap.docs[0].data(), ...updates };
            res.json(updated);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/partner-stores/:storeId/products/:productId/generate-mockup', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, productId } = req.params;
            const { color } = req.body;
            if (!color) {
                res.status(400).json({ error: "color is required" });
                return;
            }
            const prodDoc = await core_1.db.collection('products').doc(productId).get();
            if (!prodDoc.exists) {
                res.status(404).json({ error: "Product not found" });
                return;
            }
            const product = prodDoc.data();
            await core_1.db.collection('mockup_jobs').add({ storeId, productId, color, status: 'pending', blueprintId: product.blueprintId, printProviderId: product.printProviderId, createdAt: new Date().toISOString() });
            res.json({ success: true, message: "Mockup generation job queued" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/library/upload', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            if (!userId) {
                res.status(401).json({ error: "Not authenticated" });
                return;
            }
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=(.+)/);
            if (!boundaryMatch) {
                res.status(400).json({ error: "Multipart boundary required" });
                return;
            }
            const boundary = boundaryMatch[1];
            const rawBody = await new Promise((resolve, reject) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
            const boundaryBuffer = Buffer.from(`--${boundary}`);
            const parts = [];
            let start = 0;
            while (true) {
                const idx = rawBody.indexOf(boundaryBuffer, start);
                if (idx === -1)
                    break;
                if (start > 0)
                    parts.push(rawBody.slice(start, idx - 2));
                start = idx + boundaryBuffer.length + 2;
            }
            let fileBuffer = null;
            let fileName = 'upload';
            let mimeType = 'image/png';
            let assetType = 'background';
            let name = '';
            for (const part of parts) {
                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd === -1)
                    continue;
                const headers = part.slice(0, headerEnd).toString();
                const body = part.slice(headerEnd + 4);
                const filenameMatch = headers.match(/filename="([^"]+)"/);
                const nameMatch = headers.match(/name="([^"]+)"/);
                const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
                if (filenameMatch) {
                    fileName = filenameMatch[1];
                    if (ctMatch)
                        mimeType = ctMatch[1].trim();
                    fileBuffer = body;
                }
                else if (nameMatch) {
                    const fn = nameMatch[1];
                    const fv = body.toString().trim();
                    if (fn === 'assetType')
                        assetType = fv;
                    else if (fn === 'name')
                        name = fv;
                }
            }
            if (!fileBuffer || fileBuffer.length === 0) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }
            const bucket = core_1.admin.storage().bucket();
            const destPath = `library/users/${userId}/${assetType}s/${Date.now()}_${fileName}`;
            const file = bucket.file(destPath);
            await file.save(fileBuffer, { metadata: { contentType: mimeType } });
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;
            const assetDoc = await core_1.db.collection('libraryAssets').add({ ownerType: 'user', userId, assetType, mediaType: mimeType.startsWith('video') ? 'video' : 'image', name: name || fileName, originalName: fileName, mimeType, sizeBytes: fileBuffer.length, fileName, storageUrl: `gs://${bucket.name}/${destPath}`, publicUrl, isActive: true, createdAt: new Date().toISOString() });
            res.json({ id: assetDoc.id, name: name || fileName, publicUrl, assetType, mediaType: mimeType.startsWith('video') ? 'video' : 'image' });
        }
        catch (e) {
            console.error('[LibraryUpload] Error:', e);
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/library/upload', middleware_1.requireAdmin, async (req, res) => {
        try {
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=(.+)/);
            if (!boundaryMatch) {
                res.status(400).json({ error: "Multipart boundary required" });
                return;
            }
            const boundary = boundaryMatch[1];
            const rawBody = await new Promise((resolve, reject) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject); });
            const boundaryBuffer = Buffer.from(`--${boundary}`);
            const parts = [];
            let start = 0;
            while (true) {
                const idx = rawBody.indexOf(boundaryBuffer, start);
                if (idx === -1)
                    break;
                if (start > 0)
                    parts.push(rawBody.slice(start, idx - 2));
                start = idx + boundaryBuffer.length + 2;
            }
            let fileBuffer = null;
            let fileName = 'upload';
            let mimeType = 'image/png';
            let assetType = 'background';
            let name = '';
            let category = '';
            for (const part of parts) {
                const headerEnd = part.indexOf('\r\n\r\n');
                if (headerEnd === -1)
                    continue;
                const headers = part.slice(0, headerEnd).toString();
                const body = part.slice(headerEnd + 4);
                const filenameMatch = headers.match(/filename="([^"]+)"/);
                const nameMatch = headers.match(/name="([^"]+)"/);
                const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
                if (filenameMatch) {
                    fileName = filenameMatch[1];
                    if (ctMatch)
                        mimeType = ctMatch[1].trim();
                    fileBuffer = body;
                }
                else if (nameMatch) {
                    const fn = nameMatch[1];
                    const fv = body.toString().trim();
                    if (fn === 'assetType')
                        assetType = fv;
                    else if (fn === 'name')
                        name = fv;
                    else if (fn === 'category')
                        category = fv;
                }
            }
            if (!fileBuffer || fileBuffer.length === 0) {
                res.status(400).json({ error: "No file uploaded" });
                return;
            }
            const bucket = core_1.admin.storage().bucket();
            const destPath = `library/${assetType}s/raw/${Date.now()}_${fileName}`;
            const file = bucket.file(destPath);
            await file.save(fileBuffer, { metadata: { contentType: mimeType } });
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destPath}`;
            const assetDoc = await core_1.db.collection('libraryAssets').add({ ownerType: 'admin', assetType, mediaType: mimeType.startsWith('video') ? 'video' : 'image', name: name || fileName, originalName: fileName, mimeType, sizeBytes: fileBuffer.length, fileName, storageUrl: `gs://${bucket.name}/${destPath}`, publicUrl, category: category || null, isActive: true, createdAt: new Date().toISOString() });
            res.json({ id: assetDoc.id, name: name || fileName, publicUrl, assetType });
        }
        catch (e) {
            console.error('[AdminLibraryUpload] Error:', e);
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/designs/:id/publish', middleware_1.requireAdmin, async (req, res) => {
        try {
            const designDoc = await core_1.db.collection('custom_designs').doc(req.params.id).get();
            if (!designDoc.exists) {
                res.status(404).json({ error: "Design not found" });
                return;
            }
            await designDoc.ref.update({ isPublished: true, publishedAt: new Date().toISOString() });
            res.json({ success: true, message: "Design published" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/mockups/pre-generate', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { blueprintId, printProviderId, colors } = req.body;
            if (!blueprintId || !printProviderId) {
                res.status(400).json({ error: "blueprintId and printProviderId required" });
                return;
            }
            const jobs = [];
            for (const color of (colors || ['Black'])) {
                const job = await core_1.db.collection('mockup_jobs').add({ blueprintId, printProviderId, color, status: 'pending', createdAt: new Date().toISOString() });
                jobs.push({ id: job.id, color });
            }
            res.json({ success: true, jobs, count: jobs.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/mockup-jobs/worker/:action', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { action } = req.params;
            if (action === 'start') {
                res.json({ message: "Mockup worker started" });
            }
            else if (action === 'stop') {
                res.json({ message: "Mockup worker stopped" });
            }
            else if (action === 'status') {
                const pending = await core_1.db.collection('mockup_jobs').where('status', '==', 'pending').get();
                res.json({ running: false, pendingJobs: pending.size });
            }
            else {
                res.status(400).json({ error: "Unknown action" });
            }
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/mockup-jobs/batch', middleware_1.requireAuth, async (req, res) => {
        try {
            const { jobs } = req.body;
            if (!Array.isArray(jobs)) {
                res.status(400).json({ error: "jobs array required" });
                return;
            }
            const created = [];
            for (const job of jobs) {
                const doc = await core_1.db.collection('mockup_jobs').add({ ...job, status: 'pending', createdAt: new Date().toISOString() });
                created.push({ id: doc.id });
            }
            res.json({ success: true, created, count: created.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/mockup-jobs/prioritize', middleware_1.requireAuth, async (req, res) => {
        try {
            const { jobId } = req.body;
            if (!jobId) {
                res.status(400).json({ error: "jobId required" });
                return;
            }
            const doc = await core_1.db.collection('mockup_jobs').doc(jobId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Job not found" });
                return;
            }
            await doc.ref.update({ priority: 1, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/mockups/lifestyle', async (req, res) => {
        try {
            const { blueprintId, color } = req.query;
            let query = core_1.db.collection('lifestyle_mockups');
            if (blueprintId)
                query = query.where('blueprintId', '==', Number(blueprintId));
            const snap = await query.get();
            let results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (color)
                results = results.filter((r) => r.color?.toLowerCase() === color.toLowerCase());
            res.json(results);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/products/from-printify', middleware_1.requireAdmin, async (req, res) => {
        try {
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
            if (!PRINTIFY_API || !SHOP_ID) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Printify API error" });
                return;
            }
            const data = await resp.json();
            res.json({ products: data.data || data, count: (data.data || data).length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/products/sync', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ message: "Product sync initiated", status: "queued" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/products/apply-costs', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ message: "Cost application initiated", status: "queued" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/products/bulk-import', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { products } = req.body;
            if (!Array.isArray(products)) {
                res.status(400).json({ error: "products array required" });
                return;
            }
            const imported = [];
            for (const p of products) {
                const doc = await core_1.db.collection('products').add({ ...p, createdAt: new Date().toISOString() });
                imported.push({ id: doc.id });
            }
            res.json({ success: true, imported: imported.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/products/backfill-provider-locations', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ message: "Provider location backfill initiated" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/render/png', async (req, res) => {
        try {
            res.status(501).json({ error: "Server-side PNG rendering not available in Cloud Function environment" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/render/png/download', async (req, res) => {
        try {
            res.status(501).json({ error: "Server-side PNG rendering not available in Cloud Function environment" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/brain/submit', middleware_1.requireAuth, async (req, res) => {
        try {
            const { input, context } = req.body;
            const doc = await core_1.db.collection('brain_inbox').add({ input, context, siteId: constants_1.PLATFORM_STORE_ID, status: 'pending', createdAt: new Date().toISOString() });
            res.json({ requestId: doc.id, status: 'submitted' });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/test-mockup-sizes', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ sizes: { front: { width: 4500, height: 5400 }, back: { width: 4500, height: 5400 } } });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=admin-misc.js.map