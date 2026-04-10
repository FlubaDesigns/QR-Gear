"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const master_catalog_1 = require("../services/master-catalog");
function register(app) {
    // POST /admin/master-catalog/sync — trigger a full sync
    app.post('/admin/master-catalog/sync', middleware_1.requireAdmin, async (req, res) => {
        try {
            const forceRefresh = req.body?.forceRefresh === true;
            const startedAt = new Date().toISOString();
            // Respond immediately; run sync in background
            res.json({ success: true, message: 'Master catalog sync started in background', startedAt });
            try {
                const result = await (0, master_catalog_1.syncMasterCatalog)({ forceRefresh });
                await core_1.db.collection(master_catalog_1.MASTER_CATALOG_SYNCS_COLLECTION).add({
                    status: 'completed',
                    ...result,
                    startedAt,
                    completedAt: new Date().toISOString(),
                });
                console.log('[MasterCatalog] Background sync complete:', result);
            }
            catch (err) {
                console.error('[MasterCatalog] Background sync error:', err.message);
                await core_1.db.collection(master_catalog_1.MASTER_CATALOG_SYNCS_COLLECTION).add({
                    status: 'failed',
                    error: err.message,
                    startedAt,
                    completedAt: new Date().toISOString(),
                });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // GET /admin/master-catalog/sync-status — latest sync result + total count
    app.get('/admin/master-catalog/sync-status', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const [syncSnap, countSnap] = await Promise.all([
                core_1.db.collection(master_catalog_1.MASTER_CATALOG_SYNCS_COLLECTION).orderBy('completedAt', 'desc').limit(1).get(),
                core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).count().get(),
            ]);
            const latest = syncSnap.docs[0] ? { id: syncSnap.docs[0].id, ...syncSnap.docs[0].data() } : null;
            res.json({ latest, totalProducts: countSnap.data().count });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // GET /admin/master-catalog/products — paginated list with optional search
    app.get('/admin/master-catalog/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const limit = Math.min(parseInt(String(req.query.limit || '50')), 200);
            const offset = parseInt(String(req.query.offset || '0'));
            const search = String(req.query.search || '').toLowerCase().trim();
            const snap = await core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).orderBy('title').get();
            let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (search) {
                products = products.filter(p => (p.title || '').toLowerCase().includes(search) ||
                    (p.brand || '').toLowerCase().includes(search) ||
                    (p.description || '').toLowerCase().includes(search));
            }
            const total = products.length;
            res.json({ products: products.slice(offset, offset + limit), total, limit, offset });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // GET /admin/master-catalog/products/:id — single product
    app.get('/admin/master-catalog/products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // PATCH /admin/master-catalog/products/:id — admin manual edits
    app.patch('/admin/master-catalog/products/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const doc = await core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).doc(id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            const allowed = ['title', 'description', 'brand', 'images', 'colors', 'sizes', 'originCountry', 'category', 'minPrice', 'maxPrice'];
            const updates = { updatedAt: new Date().toISOString() };
            for (const field of allowed) {
                if (req.body[field] !== undefined)
                    updates[field] = req.body[field];
            }
            await core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).doc(id).update(updates);
            const updated = await core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).doc(id).get();
            res.json({ id: updated.id, ...updated.data() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=master-catalog.js.map