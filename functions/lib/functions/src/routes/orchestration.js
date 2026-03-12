"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ BATCH: ORCHESTRATION (BUNDLES, BULK-PUBLISH, PROFIT, ANALYTICS) ============
    app.get('/admin/orchestration/bundles', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('product_bundles').orderBy('displayOrder').get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/bundles/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('product_bundles').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Bundle not found" });
                return;
            }
            const items = await core_1.db.collection('bundle_items').where('bundleId', '==', req.params.id).orderBy('displayOrder').get();
            res.json({ id: doc.id, ...doc.data(), items: items.docs.map(d => ({ id: d.id, ...d.data() })) });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/bundles', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { items, ...bundleData } = req.body;
            const ref = await core_1.db.collection('product_bundles').add({ ...bundleData, createdAt: new Date() });
            if (items?.length > 0) {
                const batch = core_1.db.batch();
                items.forEach((item) => { const r = core_1.db.collection('bundle_items').doc(); batch.set(r, { ...item, bundleId: ref.id }); });
                await batch.commit();
            }
            const finalItems = await core_1.db.collection('bundle_items').where('bundleId', '==', ref.id).get();
            const doc = await ref.get();
            res.json({ id: doc.id, ...doc.data(), items: finalItems.docs.map(d => ({ id: d.id, ...d.data() })) });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.patch('/admin/orchestration/bundles/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { items, ...bundleData } = req.body;
            await core_1.db.collection('product_bundles').doc(id).update(bundleData);
            if (items !== undefined) {
                const oldItems = await core_1.db.collection('bundle_items').where('bundleId', '==', id).get();
                const batch = core_1.db.batch();
                oldItems.docs.forEach(d => batch.delete(d.ref));
                if (items.length > 0)
                    items.forEach((item) => { const r = core_1.db.collection('bundle_items').doc(); batch.set(r, { ...item, bundleId: id }); });
                await batch.commit();
            }
            const doc = await core_1.db.collection('product_bundles').doc(id).get();
            const finalItems = await core_1.db.collection('bundle_items').where('bundleId', '==', id).get();
            res.json({ id: doc.id, ...doc.data(), items: finalItems.docs.map(d => ({ id: d.id, ...d.data() })) });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.delete('/admin/orchestration/bundles/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const items = await core_1.db.collection('bundle_items').where('bundleId', '==', req.params.id).get();
            const batch = core_1.db.batch();
            items.docs.forEach(d => batch.delete(d.ref));
            batch.delete(core_1.db.collection('product_bundles').doc(req.params.id));
            await batch.commit();
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/bundles/:id/toggle', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('product_bundles').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Bundle not found" });
                return;
            }
            await doc.ref.update({ isActive: !doc.data().isActive });
            const updated = await doc.ref.get();
            res.json({ id: updated.id, ...updated.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/bundles/for-product/:productId', async (req, res) => {
        try {
            const { productId } = req.params;
            const now = new Date();
            const snap = await core_1.db.collection('product_bundles').where('isActive', '==', true).get();
            const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => {
                if (b.startDate && new Date(b.startDate) > now)
                    return false;
                if (b.endDate && new Date(b.endDate) < now)
                    return false;
                if (!b.triggerProductIds || b.triggerProductIds.length === 0)
                    return true;
                return b.triggerProductIds.includes(productId);
            });
            const results = await Promise.all(filtered.map(async (b) => {
                const items = await core_1.db.collection('bundle_items').where('bundleId', '==', b.id).get();
                return { ...b, items: items.docs.map(d => ({ id: d.id, ...d.data() })) };
            }));
            res.json(results);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/bundles/:id/calculate', async (req, res) => {
        try {
            const doc = await core_1.db.collection('product_bundles').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Bundle not found" });
                return;
            }
            const bundle = doc.data();
            const items = await core_1.db.collection('bundle_items').where('bundleId', '==', req.params.id).get();
            const { selectedItems } = req.body;
            let totalRetailPrice = 0;
            const itemDetails = [];
            for (const itemDoc of items.docs) {
                const item = itemDoc.data();
                if (selectedItems && !selectedItems.includes(itemDoc.id))
                    continue;
                let itemPrice = 0, itemName = '';
                if (item.masterProductId) {
                    const mp = await core_1.db.collection('master_products').doc(item.masterProductId).get();
                    if (mp.exists) {
                        const d = mp.data();
                        itemPrice = parseFloat(d.retailPrice || 0);
                        itemName = d.title;
                    }
                }
                else if (item.productId) {
                    const p = await core_1.db.collection('products').doc(String(item.productId)).get();
                    if (p.exists) {
                        const d = p.data();
                        itemPrice = parseFloat(d.basePrice || 0);
                        itemName = d.name;
                    }
                }
                const qty = item.quantity || 1;
                const disc = item.itemDiscountPercent ? parseFloat(item.itemDiscountPercent) / 100 : 0;
                const sub = itemPrice * (1 - disc) * qty;
                totalRetailPrice += sub;
                itemDetails.push({ itemId: itemDoc.id, name: itemName, unitPrice: itemPrice, quantity: qty, discount: disc * 100, subtotal: sub });
            }
            let bundlePrice = totalRetailPrice, savings = 0;
            if (bundle.pricingType === 'fixed_price' && bundle.fixedPrice) {
                bundlePrice = parseFloat(bundle.fixedPrice);
                savings = totalRetailPrice - bundlePrice;
            }
            else if (bundle.pricingType === 'discount_percent' && bundle.discountPercent) {
                bundlePrice = totalRetailPrice * (1 - parseFloat(bundle.discountPercent) / 100);
                savings = totalRetailPrice - bundlePrice;
            }
            else if (bundle.pricingType === 'discount_amount' && bundle.discountAmount) {
                bundlePrice = totalRetailPrice - parseFloat(bundle.discountAmount);
                savings = parseFloat(bundle.discountAmount);
            }
            res.json({ bundleId: doc.id, bundleName: bundle.name, originalPrice: totalRetailPrice, bundlePrice: Math.max(0, bundlePrice), savings: Math.max(0, savings), savingsPercent: totalRetailPrice > 0 ? (savings / totalRetailPrice) * 100 : 0, items: itemDetails });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/bulk-publish', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { productIds, channelTypes } = req.body;
            if (!productIds?.length || !channelTypes?.length) {
                res.status(400).json({ error: "productIds and channelTypes required" });
                return;
            }
            const jobId = `bulk_${Date.now()}`;
            await core_1.db.collection('bulk_publish_jobs').doc(jobId).set({ productIds, channelTypes, status: 'queued', createdAt: new Date(), progress: 0 });
            res.json({ jobId, message: "Bulk publish job started" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/bulk-publish/:jobId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('bulk_publish_jobs').doc(req.params.jobId).get();
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
    app.get('/admin/orchestration/bulk-publish-jobs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('bulk_publish_jobs').orderBy('createdAt', 'desc').limit(20).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // Orchestration: Provider Health, Routing, Profit, Repricing, QR Analytics
    // These use Firestore-based data; services that require imports are stubbed with Firestore queries
    app.get('/admin/orchestration/provider-health', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('provider_health_checks').orderBy('checkedAt', 'desc').limit(20).get();
            res.json({ checks: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/provider-health/check', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ success: true, message: "Health check initiated" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/provider-health/:providerType/check', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ provider: req.params.providerType, status: 'healthy', checkedAt: new Date() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/provider-health/:providerType/history', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('provider_health_checks').where('providerType', '==', req.params.providerType).orderBy('checkedAt', 'desc').limit(100).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/routing/recommendations/:blueprintId', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ blueprintId: req.params.blueprintId, recommendations: [] });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/routing/stats', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ totalRoutings: 0, byProvider: {} });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/routing/history', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('routing_decisions').orderBy('createdAt', 'desc').limit(20).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/profit/dashboard', middleware_1.requireAdmin, async (req, res) => {
        try {
            const orders = await core_1.db.collection('orders').orderBy('createdAt', 'desc').limit(100).get();
            let totalRevenue = 0, totalCost = 0;
            orders.docs.forEach(d => { const o = d.data(); totalRevenue += parseFloat(o.total || 0); totalCost += parseFloat(o.productionCost || 0); });
            res.json({ totalRevenue, totalCost, totalProfit: totalRevenue - totalCost, orderCount: orders.size });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/profit/channels', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json([]);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/profit/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json([]);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/profit/alerts', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json([]);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/profit/calculate', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { revenue, productionCost, shippingCost = 0, channel = 'direct' } = req.body;
            const gross = revenue - productionCost - shippingCost;
            const channelFees = { direct: 0, etsy: 0.065, ebay: 0.13, amazon: 0.15, printify: 0, printful: 0 };
            const fee = revenue * (channelFees[channel] || 0);
            res.json({ revenue, productionCost, shippingCost, channelFee: fee, netProfit: gross - fee, margin: revenue > 0 ? ((gross - fee) / revenue) * 100 : 0 });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/profit/compare-channels', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { productionCost, basePrice } = req.body;
            const channels = ['direct', 'etsy', 'ebay', 'amazon'];
            const feeRates = { direct: 0, etsy: 0.065, ebay: 0.13, amazon: 0.15 };
            const comparison = channels.map(ch => {
                const fee = basePrice * (feeRates[ch] || 0);
                const profit = basePrice - productionCost - fee;
                return { channel: ch, price: basePrice, fee, profit, margin: basePrice > 0 ? (profit / basePrice) * 100 : 0 };
            });
            res.json(comparison);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/profit/recommended-price', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { productionCost, targetMarginPercent = 50, channel = 'direct' } = req.body;
            const feeRates = { direct: 0, etsy: 0.065, ebay: 0.13, amazon: 0.15 };
            const feeRate = feeRates[channel] || 0;
            const recommended = productionCost / (1 - targetMarginPercent / 100 - feeRate);
            res.json({ productionCost, targetMarginPercent, channel, recommendedPrice: Math.ceil(recommended * 100) / 100 });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/repricing/rules', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('repricing_rules').orderBy('priority').get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/repricing/stats', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ totalRules: 0, activeRules: 0, lastRun: null });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/repricing/history', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('repricing_history').orderBy('executedAt', 'desc').limit(50).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/repricing/rules', middleware_1.requireAdmin, async (req, res) => {
        try {
            const ref = await core_1.db.collection('repricing_rules').add({ ...req.body, createdAt: new Date() });
            const doc = await ref.get();
            res.status(201).json({ id: doc.id, ...doc.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.patch('/admin/orchestration/repricing/rules/:ruleId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const ref = core_1.db.collection('repricing_rules').doc(req.params.ruleId);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: "Rule not found" });
                return;
            }
            await ref.update(req.body);
            const updated = await ref.get();
            res.json({ id: updated.id, ...updated.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.delete('/admin/orchestration/repricing/rules/:ruleId', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('repricing_rules').doc(req.params.ruleId).delete();
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/repricing/rules/:ruleId/toggle', middleware_1.requireAdmin, async (req, res) => {
        try {
            const ref = core_1.db.collection('repricing_rules').doc(req.params.ruleId);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: "Rule not found" });
                return;
            }
            await ref.update({ isActive: !doc.data().isActive });
            const updated = await ref.get();
            res.json({ id: updated.id, ...updated.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/repricing/rules/:ruleId/preview', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ ruleId: req.params.ruleId, affectedProducts: [], preview: [] });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orchestration/repricing/run', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { dryRun = true } = req.body;
            res.json({ dryRun, productsAffected: 0, results: [] });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/qr-analytics/summary', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('qr_scans').get();
            res.json({ totalScans: snap.size, uniqueProducts: new Set(snap.docs.map(d => d.data().masterProductId)).size });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/qr-analytics/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('qr_scans').orderBy('scannedAt', 'desc').limit(100).get();
            const byProduct = {};
            snap.docs.forEach(d => { const pid = d.data().masterProductId || 'unknown'; byProduct[pid] = (byProduct[pid] || 0) + 1; });
            res.json(Object.entries(byProduct).map(([productId, scans]) => ({ productId, scans })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/qr-analytics/trends', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ trends: [] });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orchestration/qr-analytics/recent', middleware_1.requireAdmin, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const snap = await core_1.db.collection('qr_scans').orderBy('scannedAt', 'desc').limit(Math.min(limit, 200)).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/qr/scan', async (req, res) => {
        try {
            const { masterProductId, customDesignId, qrUrl, country, region } = req.body;
            if (!masterProductId && !customDesignId && !qrUrl) {
                res.status(400).json({ error: "At least one identifier required" });
                return;
            }
            const ua = req.headers['user-agent'] || '';
            const deviceType = /mobile/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';
            await core_1.db.collection('qr_scans').add({ masterProductId, customDesignId, qrUrl, country, region, deviceType, userAgent: ua, scannedAt: new Date() });
            res.json({ success: true });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=orchestration.js.map