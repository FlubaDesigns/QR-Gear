"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
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
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            let revenueToday = 0, revenueWeek = 0, revenueMonth = 0;
            let pendingCount = 0, productionCount = 0, shippedCount = 0;
            for (const o of orders) {
                const amount = o.totalAmount || 0;
                const created = o.createdAt || '';
                if (created >= todayStart)
                    revenueToday += amount;
                if (created >= weekAgo)
                    revenueWeek += amount;
                if (created >= monthAgo)
                    revenueMonth += amount;
                if (o.status === 'pending')
                    pendingCount++;
                if (o.status === 'routed' || o.status === 'in_production')
                    productionCount++;
                if (o.status === 'shipped')
                    shippedCount++;
            }
            const newCustomersThisWeek = customersSnap.docs.filter((d) => {
                const c = d.data();
                return (c.createdAt || '') >= weekAgo;
            }).length;
            res.json({
                revenue: { today: revenueToday, week: revenueWeek, month: revenueMonth, trend: 0 },
                orders: { total: ordersSnap.size, pending: pendingCount, inProduction: productionCount, shipped: shippedCount, trend: 0 },
                customers: { total: customersSnap.size, newThisWeek: newCustomersThisWeek, returning: 0 },
                products: { active: productsSnap.size, lowStock: 0, syncErrors: 0 },
                health: { printify: 'healthy', stripe: 'healthy', lastCheck: now.toISOString() },
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/customers', middleware_1.requireAdmin, async (_req, res) => {
        try {
            let snapshot;
            try {
                snapshot = await core_1.db.collection('customers').orderBy('createdAt', 'desc').limit(100).get();
            }
            catch {
                snapshot = await core_1.db.collection('customers').limit(100).get();
            }
            const ordersSnap = await core_1.db.collection('orders').get();
            const ordersByCustomer = {};
            for (const od of ordersSnap.docs) {
                const o = od.data();
                const cid = o.customerId || o.userId || '';
                if (!cid)
                    continue;
                if (!ordersByCustomer[cid])
                    ordersByCustomer[cid] = { count: 0, total: 0, lastDate: null };
                ordersByCustomer[cid].count++;
                ordersByCustomer[cid].total += (o.totalAmount || 0);
                const d = o.createdAt || null;
                if (d && (!ordersByCustomer[cid].lastDate || d > ordersByCustomer[cid].lastDate)) {
                    ordersByCustomer[cid].lastDate = d;
                }
            }
            const customers = snapshot.docs.map((d) => {
                const data = d.data();
                const stats = ordersByCustomer[d.id] || { count: 0, total: 0, lastDate: null };
                return {
                    id: d.id,
                    email: data.email || null,
                    firstName: data.firstName || data.displayName?.split(' ')[0] || null,
                    lastName: data.lastName || data.displayName?.split(' ').slice(1).join(' ') || null,
                    profileImageUrl: data.profileImageUrl || data.photoURL || null,
                    createdAt: data.createdAt || null,
                    orderCount: stats.count,
                    totalSpent: stats.total,
                    lastOrderDate: stats.lastDate,
                };
            });
            res.json(customers);
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
            const data = doc.data();
            const ordersSnap = await core_1.db.collection('orders')
                .where('customerId', '==', req.params.id).orderBy('createdAt', 'desc').limit(20).get()
                .catch(() => core_1.db.collection('orders').where('customerId', '==', req.params.id).limit(20).get());
            const recentOrders = ordersSnap.docs.map((od) => ({ id: od.id, ...od.data() }));
            const totalSpent = recentOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
            const customer = {
                id: doc.id,
                email: data.email || null,
                firstName: data.firstName || data.displayName?.split(' ')[0] || null,
                lastName: data.lastName || data.displayName?.split(' ').slice(1).join(' ') || null,
                profileImageUrl: data.profileImageUrl || data.photoURL || null,
                createdAt: data.createdAt || null,
                orderCount: recentOrders.length,
                totalSpent,
                lastOrderDate: recentOrders[0]?.createdAt || null,
            };
            res.json({ customer, recentOrders });
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
            const snapshot = await core_1.db.collection('master_catalog').orderBy('createdAt', 'desc').get();
            const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json(products);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/orchestration/master-products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('master_catalog').doc(req.params.id).get();
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
            const docRef = await core_1.db.collection('master_catalog').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ id: docRef.id, success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/orchestration/master-products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('master_catalog').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/orchestration/master-products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('master_catalog').doc(req.params.id).delete();
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
            res.json(configs);
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
}
//# sourceMappingURL=am-crud.js.map