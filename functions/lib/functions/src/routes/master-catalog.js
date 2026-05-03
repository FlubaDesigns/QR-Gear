"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const master_catalog_1 = require("../services/master-catalog");
function register(app) {
    // POST /admin/master-catalog/sync — trigger a full sync (runs synchronously)
    app.post('/admin/master-catalog/sync', middleware_1.requireAdmin, async (req, res) => {
        const startedAt = new Date().toISOString();
        try {
            const forceRefresh = req.body?.forceRefresh === true;
            const cleanSweep = req.body?.cleanSweep === true;
            console.log(`[MasterCatalog] Sync requested${cleanSweep ? ' (CLEAN SWEEP)' : ''}, running synchronously...`);
            const result = await (0, master_catalog_1.syncMasterCatalog)({ forceRefresh, cleanSweep });
            await core_1.db.collection(master_catalog_1.MASTER_CATALOG_SYNCS_COLLECTION).add({
                status: 'completed',
                ...result,
                startedAt,
                completedAt: new Date().toISOString(),
            });
            console.log('[MasterCatalog] Sync complete:', result);
            res.json({ success: true, message: 'Master catalog sync complete', startedAt, completedAt: new Date().toISOString(), ...result });
        }
        catch (error) {
            console.error('[MasterCatalog] Sync error:', error.message);
            await core_1.db.collection(master_catalog_1.MASTER_CATALOG_SYNCS_COLLECTION).add({
                status: 'failed',
                error: error.message,
                startedAt,
                completedAt: new Date().toISOString(),
            }).catch(() => { });
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
    // POST /admin/master-catalog/enrich — fetch print positions + sizes from provider APIs
    // and store them on every master catalog doc for fast retrieval.
    // Skips docs enriched within the last 7 days unless forceRefresh=true.
    // Runs as a background job; responds immediately with a jobId.
    app.post('/admin/master-catalog/enrich', middleware_1.requireAdmin, async (req, res) => {
        const startedAt = new Date().toISOString();
        const forceRefresh = req.body?.forceRefresh === true;
        const categoryFilter = req.body?.categoryFilter || undefined;
        const jobRef = await core_1.db.collection(master_catalog_1.MASTER_CATALOG_SYNCS_COLLECTION).add({
            type: 'enrich',
            status: 'running',
            forceRefresh,
            ...(categoryFilter ? { categoryFilter } : {}),
            startedAt,
        });
        res.json({ success: true, jobId: jobRef.id, message: 'Enrichment started in background', startedAt });
        (async () => {
            try {
                if (categoryFilter) {
                    // Single-category mode
                    const result = await (0, master_catalog_1.enrichMasterCatalog)({ forceRefresh, categoryFilter });
                    await jobRef.update({ status: 'completed', ...result, completedAt: new Date().toISOString() });
                    console.log('[MasterCatalog] Enrich job complete (single category):', result);
                }
                else {
                    // All-categories mode: process each subcategory sequentially, write progress to Firestore
                    const subcategories = master_catalog_1.QRG_BLANK_CATEGORIES.filter((c) => c.parent);
                    const totals = { total: 0, printfulEnriched: 0, printifyEnriched: 0, skipped: 0, errors: 0 };
                    const categoryResults = {};
                    for (let i = 0; i < subcategories.length; i++) {
                        const cat = subcategories[i];
                        console.log(`[MasterCatalog] Enriching category ${i + 1}/${subcategories.length}: ${cat.name}`);
                        await jobRef.update({ currentCategory: cat.name, categoryIndex: i + 1, categoryTotal: subcategories.length });
                        const result = await (0, master_catalog_1.enrichMasterCatalog)({ forceRefresh, categoryFilter: cat.name });
                        categoryResults[cat.name] = result;
                        totals.total += result.total;
                        totals.printfulEnriched += result.printfulEnriched;
                        totals.printifyEnriched += result.printifyEnriched;
                        totals.skipped += result.skipped;
                        totals.errors += result.errors;
                        console.log(`[MasterCatalog] Category ${cat.name} done:`, result);
                    }
                    await jobRef.update({ status: 'completed', ...totals, categoryResults, completedAt: new Date().toISOString() });
                    console.log('[MasterCatalog] All-category enrich complete:', totals);
                }
            }
            catch (e) {
                console.error('[MasterCatalog] Enrich job error:', e.message);
                await jobRef.update({ status: 'failed', error: e.message, completedAt: new Date().toISOString() });
            }
        })();
    });
    // Alias: POST /admin/sync-master-products → same as /admin/master-catalog/sync
    // Used by the "Rebuild Master Products" button in the admin Products page.
    app.post('/admin/sync-master-products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { forceRefresh = false } = req.body || {};
            console.log('[MasterCatalog] sync-master-products alias triggered');
            const startedAt = new Date().toISOString();
            const result = await (0, master_catalog_1.syncMasterCatalog)({ forceRefresh });
            const completedAt = new Date().toISOString();
            res.json({ success: true, message: 'Master catalog sync complete', startedAt, completedAt, ...result });
        }
        catch (error) {
            console.error('[MasterCatalog] sync-master-products error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=master-catalog.js.map