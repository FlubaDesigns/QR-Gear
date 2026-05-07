"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const master_catalog_1 = require("../services/master-catalog");
const printify_1 = require("../services/printify");
const printful_1 = require("../services/printful");
const qrgVariantMappings_1 = require("../../../shared/qrgVariantMappings");
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
            const allowed = ['title', 'description', 'brand', 'images', 'colors', 'sizes', 'originCountry', 'category', 'qrgCategory', 'minPrice', 'maxPrice'];
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
                    const totals = { total: 0, printfulEnriched: 0, printifyEnriched: 0, skipped: 0, errors: 0, colorsAdded: 0, sizesAdded: 0, pricesAdded: 0, originAdded: 0 };
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
                        totals.colorsAdded += result.colorsAdded ?? 0;
                        totals.sizesAdded += result.sizesAdded ?? 0;
                        totals.pricesAdded += result.pricesAdded ?? 0;
                        totals.originAdded += result.originAdded ?? 0;
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
    // POST /admin/master-catalog/backfill-placements
    // Fetches print placements from carrier APIs and stores them permanently on master_catalog docs.
    // After this runs, /public/catalog/placements serves directly from master_catalog — no live API calls.
    app.post('/admin/master-catalog/backfill-placements', middleware_1.requireAdmin, async (req, res) => {
        const forceRefresh = req.body?.forceRefresh === true;
        const categoryFilter = req.body?.categoryFilter || undefined;
        const startedAt = new Date().toISOString();
        try {
            const baseQuery = categoryFilter
                ? core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).where('qrgCategory', '==', categoryFilter)
                : core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION);
            const snap = await baseQuery.get();
            let synced = 0, skipped = 0, errors = 0;
            for (const doc of snap.docs) {
                const data = doc.data();
                const pm = data.providerMappings;
                const pyMap = (pm && !Array.isArray(pm)) ? pm.printify : (Array.isArray(pm) ? pm.find((m) => m.provider === 'printify') : null);
                const pfMap = (pm && !Array.isArray(pm)) ? pm.printful : (Array.isArray(pm) ? pm.find((m) => m.provider === 'printful') : null);
                const blueprintId = pyMap?.blueprintId ? Number(pyMap.blueprintId) : null;
                const providerId = pyMap?.printProviderId ? Number(pyMap.printProviderId) : null;
                const printfulId = pfMap?.productId ? Number(pfMap.productId) : null;
                const hasPy = Array.isArray(data.printifyPlacements) && data.printifyPlacements.length > 0;
                const hasPf = Array.isArray(data.printfulPlacements) && data.printfulPlacements.length > 0;
                const needsPy = blueprintId && providerId && (!hasPy || forceRefresh);
                const needsPf = printfulId && (!hasPf || forceRefresh);
                if (!needsPy && !needsPf) {
                    skipped++;
                    continue;
                }
                const update = { lastPlacementSyncAt: new Date().toISOString() };
                // ── Printify: extract positions + dimensions from variant placeholders ──
                if (needsPy && printify_1.printifyClient.isConfigured) {
                    try {
                        const variantData = await printify_1.printifyClient.getVariants(blueprintId, providerId);
                        const seen = new Map();
                        for (const v of (variantData?.variants ?? [])) {
                            for (const ph of (v.placeholders ?? [])) {
                                if (ph.position && !seen.has(ph.position)) {
                                    seen.set(ph.position, {
                                        position: ph.position,
                                        label: ph.label || ph.position.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                                        width: ph.width ?? null,
                                        height: ph.height ?? null,
                                    });
                                }
                            }
                        }
                        if (seen.size > 0) {
                            update.printifyPlacements = Array.from(seen.values());
                            console.log(`[BackfillPlacements] ${doc.id}: ${seen.size} Printify placements`);
                        }
                    }
                    catch (e) {
                        console.warn(`[BackfillPlacements] Printify error blueprint=${blueprintId}:`, e.message);
                        errors++;
                    }
                }
                // ── Printful: extract positions + dimensions from printfiles ──
                if (needsPf) {
                    try {
                        const printfileInfo = await printful_1.printfulClient.getPrintfiles(printfulId);
                        if (printfileInfo?.available_placements) {
                            const placements = Object.entries(printfileInfo.available_placements)
                                .filter(([key]) => !(0, core_1.isEmbroideryPlacement)(key))
                                .map(([key, val]) => ({
                                position: key,
                                label: val.title || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                                width: val.width ?? null,
                                height: val.height ?? null,
                            }));
                            if (placements.length > 0) {
                                update.printfulPlacements = placements;
                                console.log(`[BackfillPlacements] ${doc.id}: ${placements.length} Printful placements`);
                            }
                        }
                    }
                    catch (e) {
                        console.warn(`[BackfillPlacements] Printful error productId=${printfulId}:`, e.message);
                        errors++;
                    }
                }
                if (Object.keys(update).length > 1) {
                    await doc.ref.update(update);
                    synced++;
                }
                else {
                    skipped++;
                }
            }
            res.json({ success: true, synced, skipped, errors, total: snap.docs.length, startedAt, completedAt: new Date().toISOString() });
        }
        catch (error) {
            console.error('[BackfillPlacements] Fatal error:', error.message);
            res.status(500).json({ error: error.message });
        }
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
    // POST /admin/master-catalog/rebuild-full
    // Full sequential pipeline: Printify → Printful → master_catalog.
    // Responds immediately; tracks progress in sync_status/masterCatalog.
    app.post('/admin/master-catalog/rebuild-full', middleware_1.requireAdmin, async (req, res) => {
        const startedAt = new Date().toISOString();
        const cleanSweep = req.body?.cleanSweep === true;
        const statusRef = core_1.db.collection('sync_status').doc('masterCatalog');
        await statusRef.set({
            status: 'running',
            startedAt,
            cleanSweep,
            printify: { status: 'running', startedAt: new Date().toISOString() },
            printful: { status: 'pending' },
            master: { status: 'pending' },
        });
        res.json({ success: true, message: 'Full rebuild started. Poll /rebuild-status for progress.', startedAt });
        (async () => {
            try {
                // ── Phase 1: Printify ──────────────────────────────────────────────────
                let printifyResult = { blueprints: 0, added: 0, updated: 0, errors: 0 };
                try {
                    printifyResult = await (0, master_catalog_1.syncPrintifyToStaging)({
                        onProgress: (msg) => console.log(msg),
                    });
                    await statusRef.update({
                        'printify.status': 'completed',
                        'printify.count': printifyResult.blueprints,
                        'printify.added': printifyResult.added,
                        'printify.finishedAt': new Date().toISOString(),
                        'printful.status': 'running',
                        'printful.startedAt': new Date().toISOString(),
                    });
                }
                catch (e) {
                    console.error('[rebuild-full] Printify sync failed:', e.message);
                    await statusRef.update({
                        'printify.status': 'failed',
                        'printify.error': e.message,
                        'printify.finishedAt': new Date().toISOString(),
                        'printful.status': 'running',
                        'printful.startedAt': new Date().toISOString(),
                    });
                }
                // ── Phase 2: Printful ──────────────────────────────────────────────────
                let printfulResult = { products: 0, added: 0, updated: 0, errors: 0 };
                try {
                    printfulResult = await (0, master_catalog_1.syncPrintfulToStaging)({
                        onProgress: (msg) => console.log(msg),
                    });
                    await statusRef.update({
                        'printful.status': 'completed',
                        'printful.count': printfulResult.products,
                        'printful.added': printfulResult.added,
                        'printful.finishedAt': new Date().toISOString(),
                        'master.status': 'running',
                        'master.startedAt': new Date().toISOString(),
                    });
                }
                catch (e) {
                    console.warn('[rebuild-full] Printful sync failed (non-fatal):', e.message);
                    await statusRef.update({
                        'printful.status': 'failed',
                        'printful.error': e.message,
                        'printful.finishedAt': new Date().toISOString(),
                        'master.status': 'running',
                        'master.startedAt': new Date().toISOString(),
                    });
                }
                // ── Phase 3: Master catalog sync ────────────────────────────────────────
                const masterResult = await (0, master_catalog_1.syncMasterCatalog)({ forceRefresh: false, cleanSweep });
                const completedAt = new Date().toISOString();
                await statusRef.update({
                    status: 'completed',
                    completedAt,
                    'master.status': 'completed',
                    'master.count': masterResult.created + masterResult.updated,
                    'master.created': masterResult.created,
                    'master.updated': masterResult.updated,
                    'master.finishedAt': completedAt,
                    result: {
                        printify: printifyResult,
                        printful: printfulResult,
                        master: masterResult,
                    },
                });
                console.log('[rebuild-full] Complete:', { printify: printifyResult, printful: printfulResult, master: masterResult });
            }
            catch (e) {
                console.error('[rebuild-full] Fatal error:', e.message);
                await statusRef.update({
                    status: 'failed',
                    error: e.message,
                    completedAt: new Date().toISOString(),
                }).catch(() => { });
            }
        })();
    });
    // GET /admin/master-catalog/rebuild-status
    // Returns the current rebuild job status from sync_status/masterCatalog.
    app.get('/admin/master-catalog/rebuild-status', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const doc = await core_1.db.collection('sync_status').doc('masterCatalog').get();
            if (!doc.exists) {
                res.json({ status: 'never_run' });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /admin/master-catalog/diagnostics
    // Collection counts + samples for each staging + master collection.
    app.get('/admin/master-catalog/diagnostics', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const COLLECTIONS = [
                'printify_blueprints',
                'printifyPrintProviders',
                'printful_products',
                'printful_variants',
                'printfulCatalog',
                'master_catalog',
                'sync_status',
            ];
            const results = {};
            await Promise.all(COLLECTIONS.map(async (col) => {
                const [countSnap, sampleSnap] = await Promise.all([
                    core_1.db.collection(col).count().get(),
                    core_1.db.collection(col).limit(3).get(),
                ]);
                results[col] = {
                    count: countSnap.data().count,
                    samples: sampleSnap.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            title: data.title || data.canonicalTitle || null,
                            brand: data.brand || null,
                            model: data.model || null,
                            status: data.status || null,
                            availableVia: data.availableVia || null,
                        };
                    }),
                };
            }));
            const masterSnap = await core_1.db.collection('master_catalog').get();
            const masterDocs = masterSnap.docs.map(d => d.data());
            const unclassified = masterDocs.filter(d => !d.qrgCategory || d.qrgCategory === 'Unclassified').length;
            const noMappings = masterDocs.filter(d => !d.providerMappings || (!d.providerMappings.printify && !d.providerMappings.printful)).length;
            const printifyOnly = masterDocs.filter(d => Array.isArray(d.availableVia) && d.availableVia.includes('printify') && !d.availableVia.includes('printful')).length;
            const printfulOnly = masterDocs.filter(d => Array.isArray(d.availableVia) && d.availableVia.includes('printful') && !d.availableVia.includes('printify')).length;
            const bridged = masterDocs.filter(d => Array.isArray(d.availableVia) && d.availableVia.includes('printify') && d.availableVia.includes('printful')).length;
            res.json({
                collections: results,
                masterCatalog: {
                    total: masterDocs.length,
                    printifyOnly,
                    printfulOnly,
                    bridged,
                    unclassified,
                    noProviderMappings: noMappings,
                },
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/master-catalog/repair-provider-qrg-mapping', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { dryRun = true, deleteInvalid = false } = req.body || {};
            const snap = await core_1.db.collection('master_catalog').get();
            const validIds = [];
            const invalidIds = [];
            const missingVariants = [];
            const withUnmapped = [];
            const batchWrites = [];
            let fixed = 0;
            for (const doc of snap.docs) {
                const data = doc.data();
                const docId = doc.id;
                if (/^qrg_[1-6][1-9][0-9]{3}$/.test(docId)) {
                    validIds.push(docId);
                }
                else {
                    invalidIds.push(docId);
                    if (!dryRun && deleteInvalid)
                        batchWrites.push({ ref: doc.ref, data: null });
                    continue;
                }
                if (!data.qrgVariants || Object.keys(data.qrgVariants).length === 0)
                    missingVariants.push(docId);
                const unmapped = data.unmappedProviderValues;
                if ((unmapped?.sizes?.length ?? 0) > 0 || (unmapped?.colors?.length ?? 0) > 0)
                    withUnmapped.push(docId);
                if (!dryRun && Array.isArray(data.providerMappings)) {
                    const pyOld = data.providerMappings.find((m) => m.provider === 'printify');
                    const pfOld = data.providerMappings.find((m) => m.provider === 'printful');
                    if (pyOld || pfOld) {
                        const newPm = {};
                        if (pyOld)
                            newPm.printify = { blueprintId: String(pyOld.blueprintId || ''), printProviderId: String(pyOld.printProviderId || ''), rawTitle: pyOld.rawTitle || null, rawDescription: pyOld.rawDescription || null };
                        if (pfOld)
                            newPm.printful = { productId: String(pfOld.productId || ''), rawTitle: pfOld.rawTitle || null, rawDescription: pfOld.rawDescription || null };
                        batchWrites.push({ ref: doc.ref, data: { providerMappings: newPm, updatedAt: new Date().toISOString() } });
                        fixed++;
                    }
                }
            }
            if (!dryRun && batchWrites.length > 0) {
                const batch = core_1.db.batch();
                for (const w of batchWrites) {
                    if (w.data === null)
                        batch.delete(w.ref);
                    else
                        batch.update(w.ref, w.data);
                }
                await batch.commit();
            }
            res.json({
                success: true,
                dryRun,
                total: snap.docs.length,
                validIds: validIds.length,
                invalidIds,
                missingVariants,
                withUnmapped,
                fixed: dryRun ? 0 : fixed,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── QRG Schema Resolution ────────────────────────────────────────────────────
    // Maps QRG STNNN digits → schemaFamily, schemaType, canonicalProfilePath.
    // S = super-category digit, T = product-type digit (per QRG.md §3).
    // GET /admin/master-catalog/products/:docId/options ────────────────────────
    // QRG-native product options resolver — schema-first, provider-refined.
    // Resolution order:
    //   Tier 1: canonical layout_profiles/{family}/{type} document
    //   Tier 2: backfilled provider placements on master_catalog doc
    //   Tier 3: live provider API call
    //   Tier 4: generic front fallback
    //
    // Query params:
    //   ?provider=printify|printful  — which provider to filter placements for (default: printify)
    //
    // Validation codes:
    //   400  INVALID_QRG_DOC_ID
    //   404  MASTER_PRODUCT_NOT_FOUND
    //   409  PRINTIFY_MAPPING_MISSING
    //   502  PRINTIFY_PLACEMENTS_FAILED
    app.get('/admin/master-catalog/products/:docId/options', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { docId } = req.params;
            // Normalize "both" → "printify". The crosswalk only has entries for a specific
            // provider; "both" would match nothing and fall through to the front-only fallback.
            const rawProvider = (typeof req.query.provider === 'string' ? req.query.provider : 'printify').toLowerCase();
            const requestedProvider = (!rawProvider || rawProvider === 'both') ? 'printify' : rawProvider;
            // 1. Validate docId format: qrg_[STNNN]
            if (!/^qrg_[1-6][1-9][0-9]{3}$/.test(docId)) {
                res.status(400).json({ error: 'INVALID_QRG_DOC_ID' });
                return;
            }
            // 2. Load master product
            const doc = await core_1.db.collection(master_catalog_1.MASTER_CATALOG_COLLECTION).doc(docId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'MASTER_PRODUCT_NOT_FOUND' });
                return;
            }
            const product = doc.data();
            const qrgBlankId = product.qrgBlankId || docId.slice(4);
            // ── Schema-first resolution (QRG.md §3) ─────────────────────────────────
            // Parse STNNN from docId to resolve product family + type before any provider query.
            const stnnn = docId.slice(4); // e.g. "11001"
            const sDigit = stnnn[0]; // S = super-category
            const tDigit = stnnn[1]; // T = product type
            const stKey = `${sDigit}${tDigit}`; // e.g. "11"
            const QRG_S_FAMILY = {
                '1': 'apparel', '2': 'houseware', '3': 'print_display',
                '4': 'accessories', '5': 'pet', '6': 'holiday',
            };
            const QRG_ST_TYPE = {
                '11': 'tshirt', '12': 'hoodie', '13': 'tank', '14': 'longsleeve',
                '15': 'jacket', '16': 'shorts', '17': 'dress', '18': 'leggings',
                '21': 'drinkware', '22': 'kitchen', '23': 'home_decor',
                '31': 'poster', '32': 'canvas', '33': 'card',
                '41': 'bag', '42': 'hat', '43': 'phone_case', '44': 'jewelry',
                '51': 'pet_apparel', '52': 'pet_accessory',
                '61': 'ornament', '62': 'seasonal_decor',
            };
            const QRG_ST_COLLECTION = {
                '11': 'tshirts', '12': 'hoodies', '13': 'tanks', '14': 'longsleeves',
                '15': 'jackets', '16': 'shorts', '17': 'dresses', '18': 'leggings',
                '21': 'drinkware', '22': 'kitchen', '23': 'home_decor',
                '31': 'posters', '32': 'canvas', '33': 'cards',
                '41': 'bags', '42': 'hats', '43': 'phone_cases', '44': 'jewelry',
                '51': 'pet_apparel', '52': 'pet_accessories',
                '61': 'ornaments', '62': 'seasonal_decor',
            };
            const schemaFamily = QRG_S_FAMILY[sDigit] || 'unknown';
            const schemaType = QRG_ST_TYPE[stKey] || 'unknown';
            const schemaCollection = QRG_ST_COLLECTION[stKey] || 'unknown';
            const canonicalProfilePath = `layout_profiles/${schemaFamily}/${schemaCollection}`;
            // Read cached Printify positions early — used for provider guard and placement crosswalk
            const cachedPositions = Array.isArray(product.printPositions) ? product.printPositions : [];
            // 3. Resolve Printify provider IDs
            // Canonical source: providerMappings.printify — fall back to legacy flat fields
            const pm = product.providerMappings;
            const isProviderObj = pm && typeof pm === 'object' && !Array.isArray(pm);
            const pyMapping = isProviderObj ? (pm.printify || null) : null;
            const rawBlueprintId = pyMapping?.blueprintId ||
                product.printifyBlueprintId ||
                product.blueprintId ||
                null;
            const rawPrintProviderId = pyMapping?.printProviderId ||
                product.printifyPrintProviderId ||
                product.printProviderId ||
                null;
            // blueprintId is required for the Printify live API fallback only.
            // For Printful, or for Printify when printPositions are already cached, proceed without it.
            if (!rawBlueprintId && requestedProvider === 'printify' && cachedPositions.length === 0) {
                res.status(409).json({
                    error: 'PRINTIFY_MAPPING_MISSING',
                    message: 'This master product does not have blueprintId. Sync the catalog to populate print positions.',
                });
                return;
            }
            const blueprintId = rawBlueprintId ? parseInt(rawBlueprintId, 10) : null;
            let printProviderId = rawPrintProviderId ? parseInt(rawPrintProviderId, 10) : null;
            // 4. Resolve printProviderId if missing — check DB then live API (Printify only)
            if (blueprintId !== null && !printProviderId) {
                try {
                    const provSnap = await core_1.db.collection('printify_providers').get();
                    const matching = provSnap.docs
                        .map(d => d.data())
                        .filter(d => Number(d.blueprintId ?? d.blueprint_id) === blueprintId);
                    if (matching.length > 0) {
                        const best = matching.reduce((prev, cur) => {
                            const prevColors = Array.isArray(prev.availableColors) ? prev.availableColors.length : 0;
                            const curColors = Array.isArray(cur.availableColors) ? cur.availableColors.length : 0;
                            return curColors > prevColors ? cur : prev;
                        });
                        printProviderId = best.providerId ?? best.provider_id ?? null;
                    }
                }
                catch (_) { /* continue — live API fallback below */ }
            }
            if (blueprintId !== null && !printProviderId && printify_1.printifyClient.isConfigured) {
                try {
                    const liveProviders = await printify_1.printifyClient.getPrintProviders(blueprintId);
                    if (liveProviders && liveProviders.length > 0) {
                        const usaFirst = liveProviders.find((p) => p.location?.country === 'US' || p.location?.country === 'USA');
                        printProviderId = (usaFirst || liveProviders[0]).id;
                    }
                }
                catch (_) { /* handled below */ }
            }
            // 5. Build availableSizes from qrgVariants (or fall back to availableSizes codes)
            const qrgVariants = product.qrgVariants || {};
            const sizeCodesInVariants = new Set();
            const colorCodesInVariants = new Set();
            const sizeProviderValues = {};
            const colorProviderValues = {};
            for (const [vc, variant] of Object.entries(qrgVariants)) {
                const v = variant;
                const sc = vc.slice(0, 2);
                const cc = vc.slice(2, 4);
                sizeCodesInVariants.add(sc);
                colorCodesInVariants.add(cc);
                if (v.sizeLabel) {
                    if (!sizeProviderValues[sc])
                        sizeProviderValues[sc] = new Set();
                    sizeProviderValues[sc].add(v.sizeLabel);
                }
                if (v.colorLabel) {
                    if (!colorProviderValues[cc])
                        colorProviderValues[cc] = new Set();
                    colorProviderValues[cc].add(v.colorLabel);
                }
            }
            const sizeCodes = sizeCodesInVariants.size > 0
                ? Array.from(sizeCodesInVariants).sort()
                : (Array.isArray(product.availableSizes) ? product.availableSizes : []);
            const colorCodes = colorCodesInVariants.size > 0
                ? Array.from(colorCodesInVariants).sort()
                : (Array.isArray(product.availableColors) ? product.availableColors : []);
            const availableSizes = sizeCodes.map((code) => ({
                code,
                label: qrgVariantMappings_1.SIZE_LABELS[code] ?? code,
                providerValues: sizeProviderValues[code] ? Array.from(sizeProviderValues[code]) : [],
            }));
            const availableColors = colorCodes.map((code) => ({
                code,
                label: qrgVariantMappings_1.COLOR_LABELS[code] ?? code,
                providerValues: colorProviderValues[code] ? Array.from(colorProviderValues[code]) : [],
            }));
            let printLocations = [];
            // Helper: resolve a canonical print_placements doc + id for a given position name.
            // Tries direct doc-id lookup first, then falls back to scanning provider dtgNames/dtfNames.
            function resolvePlacement(placementMap, pos, provider) {
                const direct = placementMap.get(pos);
                if (direct)
                    return { canonicalId: pos, pp: direct };
                for (const [cId, candidate] of placementMap.entries()) {
                    const entry = candidate.providers?.[provider];
                    if (!entry)
                        continue;
                    if ((entry.dtgNames || []).includes(pos) || (entry.dtfNames || []).includes(pos)) {
                        return { canonicalId: cId, pp: candidate };
                    }
                }
                return null;
            }
            // Declared here so buildLocation (below) can close over it.
            // Populated in the inner try block once the canonical profile is fetched.
            let canonicalDimsMap = new Map();
            function buildLocation(canonicalId, pp, providerEntry, provider) {
                // Dimension fallback order: provider crosswalk → print_placements doc → Tier 1 canonical profile
                const canonicalP = canonicalDimsMap.get(canonicalId);
                const dims = providerEntry.dimensions || pp.dimensions || canonicalP?.dimensions || null;
                const printArea = providerEntry.printArea || canonicalP?.printArea
                    || (dims ? { widthPx: dims.widthPx, heightPx: dims.heightPx } : null);
                return {
                    id: canonicalId,
                    label: pp.displayName || canonicalId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                    canonicalLocationCode: canonicalId,
                    provider,
                    providerPlacement: providerEntry.defaultDtgName || canonicalId,
                    providerPlacementId: providerEntry.providerPlacementId || providerEntry.defaultDtgName || canonicalId,
                    sourceTable: providerEntry.sourceTable || `${provider}_print_placements`,
                    dimensions: dims,
                    printArea,
                    safeArea: providerEntry.safeArea || canonicalP?.safeArea || null,
                    dpi: providerEntry.dpi || pp.dimensions?.dpi || canonicalP?.dpi || 300,
                    rawProviderPlacement: providerEntry,
                };
            }
            // ── Provider-first resolution ──────────────────────────────────────────
            // For Printful: derive positions from printful_products/{id}.printLocations.
            // This is authoritative — product.printPositions is legacy cache only.
            // For Printify: falls through to cachedPositions + crosswalk (existing path).
            let providerPositions = [];
            const providerDimsMap = new Map();
            let layoutSource = 'legacy_printPositions';
            let providerProductId = null;
            if (requestedProvider === 'printful' && product.printfulProductId) {
                try {
                    providerProductId = String(product.printfulProductId);
                    const pfDoc = await core_1.db.collection('printful_products').doc(providerProductId).get();
                    if (pfDoc.exists) {
                        const pfData = pfDoc.data();
                        const pfLocs = Array.isArray(pfData.printLocations) ? pfData.printLocations : [];
                        if (pfLocs.length > 0) {
                            for (const loc of pfLocs) {
                                if (loc.placement && !(0, core_1.isEmbroideryPlacement)(loc.placement)) {
                                    providerPositions.push(loc.placement);
                                    if (loc.width && loc.height) {
                                        providerDimsMap.set(loc.placement, { widthPx: loc.width, heightPx: loc.height, dpi: 300 });
                                    }
                                }
                            }
                            layoutSource = 'provider_product_locations';
                            console.log(`[MasterCatalog/options] ${docId} Printful product ${providerProductId}: ${providerPositions.length} locations`);
                        }
                    }
                }
                catch (pfErr) {
                    console.warn(`[MasterCatalog/options] ${docId}: printful_products lookup failed:`, pfErr.message);
                }
            }
            // Positions to resolve: provider product data takes precedence over legacy cache
            const resolvePositions = providerPositions.length > 0 ? providerPositions : cachedPositions;
            try {
                // Load print_placements crosswalk + canonical profile in parallel (Tier 1)
                const canonicalProfileRef = core_1.db
                    .collection('layout_profiles').doc(schemaFamily)
                    .collection(schemaCollection).doc('canonical');
                const [placementsSnap, canonicalProfileDoc] = await Promise.all([
                    core_1.db.collection('print_placements').get(),
                    schemaFamily !== 'unknown' && schemaCollection !== 'unknown'
                        ? canonicalProfileRef.get()
                        : Promise.resolve(null),
                ]);
                const placementMap = new Map();
                for (const d of placementsSnap.docs) {
                    placementMap.set(d.id, d.data());
                }
                // Populate canonical dims map from Tier 1 profile (layout_profiles/family/type/canonical)
                const canonicalProfile = canonicalProfileDoc?.exists ? canonicalProfileDoc.data() : null;
                if (canonicalProfile?.placements) {
                    for (const p of canonicalProfile.placements) {
                        if (p.id)
                            canonicalDimsMap.set(p.id, p);
                    }
                }
                console.log(`[MasterCatalog/options] ${docId} schema=${schemaFamily}/${schemaType} canonicalProfile=${canonicalProfile ? 'found' : 'none'} placements=${canonicalDimsMap.size} layoutSource=${layoutSource}`);
                if (resolvePositions.length > 0) {
                    // Resolve positions through the crosswalk for the requested provider.
                    // seenCanonicalIds deduplicates cases where multiple provider names map to the
                    // same canonical ID (e.g. "front" + "front_large" both → canonical "front").
                    const seenCanonicalIds = new Set();
                    for (const pos of resolvePositions) {
                        if ((0, core_1.isEmbroideryPlacement)(pos))
                            continue;
                        const resolved = resolvePlacement(placementMap, pos, requestedProvider);
                        if (!resolved) {
                            // Not in crosswalk — if we have actual provider dims, build a direct location
                            if (layoutSource === 'provider_product_locations' && providerDimsMap.has(pos)) {
                                if (seenCanonicalIds.has(pos))
                                    continue;
                                seenCanonicalIds.add(pos);
                                const dims = providerDimsMap.get(pos);
                                printLocations.push({
                                    id: pos,
                                    label: pos.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                                    canonicalLocationCode: pos,
                                    provider: requestedProvider,
                                    providerPlacement: pos,
                                    providerPlacementId: pos,
                                    sourceTable: `printful_products/${providerProductId}.printLocations`,
                                    layoutSource,
                                    dimensions: dims,
                                    printArea: { widthPx: dims.widthPx, heightPx: dims.heightPx },
                                    dpi: dims.dpi,
                                });
                            }
                            else {
                                console.warn(`[MasterCatalog/options] ${docId}: position "${pos}" not in print_placements — skipping`);
                            }
                            continue;
                        }
                        const { canonicalId, pp } = resolved;
                        // Deduplicate: skip if this canonical ID was already added
                        // (e.g. "front_large" resolves to canonical "front" already added via "front")
                        if (seenCanonicalIds.has(canonicalId))
                            continue;
                        seenCanonicalIds.add(canonicalId);
                        const providerEntry = pp.providers?.[requestedProvider];
                        if (!providerEntry)
                            continue;
                        // Enrich crosswalk entry with actual provider dims when the crosswalk lacks them
                        const actualDims = providerDimsMap.get(pos) || null;
                        const enrichedEntry = (actualDims && !providerEntry.dimensions)
                            ? { ...providerEntry, dimensions: actualDims }
                            : providerEntry;
                        const loc = buildLocation(canonicalId, pp, enrichedEntry, requestedProvider);
                        const srcTable = layoutSource === 'provider_product_locations'
                            ? `printful_products/${providerProductId}.printLocations`
                            : (loc.sourceTable || `${requestedProvider}_print_placements`);
                        printLocations.push({ ...loc, layoutSource, sourceTable: srcTable });
                    }
                    printLocations.sort((a, b) => {
                        const aOrd = placementMap.get(a.id)?.sortOrder ?? 99;
                        const bOrd = placementMap.get(b.id)?.sortOrder ?? 99;
                        return aOrd - bOrd;
                    });
                }
                else {
                    // No positions from either source — return all active placements for the provider
                    const all = [];
                    for (const [internalName, pp] of placementMap.entries()) {
                        if (!pp.isActive)
                            continue;
                        if ((0, core_1.isEmbroideryPlacement)(internalName))
                            continue;
                        const providerEntry = pp.providers?.[requestedProvider];
                        if (!providerEntry)
                            continue;
                        all.push({ ...buildLocation(internalName, pp, providerEntry, requestedProvider), sortOrder: pp.sortOrder ?? 99, layoutSource });
                    }
                    all.sort((a, b) => a.sortOrder - b.sortOrder);
                    printLocations = all;
                }
                console.log(`[MasterCatalog/options] ${docId} provider=${requestedProvider} → ${printLocations.length} placements (source=${layoutSource})`);
            }
            catch (crosswalkErr) {
                console.error(`[MasterCatalog/options] print_placements load failed for ${docId}:`, crosswalkErr.message);
                // Fall back to provider positions (if any) then cached positions so the builder is not broken
                const fallbackPositions = providerPositions.length > 0 ? providerPositions : cachedPositions;
                if (fallbackPositions.length > 0) {
                    printLocations = fallbackPositions
                        .filter((p) => !(0, core_1.isEmbroideryPlacement)(p))
                        .map((pos) => ({
                        id: pos,
                        label: pos.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                        canonicalLocationCode: pos,
                        provider: requestedProvider,
                        providerPlacement: pos,
                        providerPlacementId: pos,
                        sourceTable: layoutSource === 'provider_product_locations'
                            ? `printful_products/${providerProductId}.printLocations`
                            : `${requestedProvider}_print_placements`,
                        layoutSource,
                        dpi: 300,
                    }));
                }
            }
            // Tier 2: backfilled provider placements stored on master_catalog doc
            // These are written by POST /admin/master-catalog/backfill-placements
            if (printLocations.length === 0) {
                const backfilled = requestedProvider === 'printful'
                    ? (Array.isArray(product.printfulPlacements) ? product.printfulPlacements : [])
                    : (Array.isArray(product.printifyPlacements) ? product.printifyPlacements : []);
                if (backfilled.length > 0) {
                    printLocations = backfilled
                        .filter((p) => !(0, core_1.isEmbroideryPlacement)(p.position))
                        .map((p) => {
                        const canonicalP = canonicalDimsMap.get(p.position);
                        const dims = canonicalP?.dimensions
                            || (p.width && p.height ? { widthPx: p.width, heightPx: p.height, dpi: 300 } : null);
                        return {
                            id: p.position,
                            label: p.label || p.position.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                            canonicalLocationCode: p.position,
                            provider: requestedProvider,
                            providerPlacement: p.position,
                            providerPlacementId: p.position,
                            sourceTable: `${requestedProvider}_placements_cached`,
                            dimensions: dims,
                            printArea: canonicalP?.printArea || (dims ? { widthPx: dims.widthPx, heightPx: dims.heightPx } : null),
                            safeArea: canonicalP?.safeArea || null,
                            dpi: canonicalP?.dpi || 300,
                        };
                    });
                    console.log(`[MasterCatalog/options] ${docId} Tier2: ${printLocations.length} from cached ${requestedProvider} placements`);
                }
            }
            // Tier 3: Printify live API fallback — only if Tier 2 also empty and we have Printify IDs
            if (printLocations.length === 0 && requestedProvider === 'printify' && blueprintId !== null && printProviderId && printify_1.printifyClient.isConfigured) {
                try {
                    const variantData = await printify_1.printifyClient.getVariants(blueprintId, printProviderId);
                    const placementSet = new Set();
                    if (variantData?.variants) {
                        for (const v of variantData.variants) {
                            if (v.placeholders) {
                                for (const ph of v.placeholders) {
                                    if (ph.position && !(0, core_1.isEmbroideryPlacement)(ph.position))
                                        placementSet.add(ph.position);
                                }
                            }
                        }
                    }
                    if (placementSet.size === 0)
                        placementSet.add('front');
                    const normalized = (0, core_1.normalizePlacements)('printify', Array.from(placementSet));
                    printLocations = normalized.map((pos) => ({
                        id: pos,
                        label: pos.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                        canonicalLocationCode: pos,
                        provider: 'printify',
                        providerPlacement: pos,
                        providerPlacementId: pos,
                        sourceTable: 'printify_print_placements',
                        dpi: 300,
                    }));
                }
                catch (err) {
                    console.error(`[MasterCatalog/options] Printify live fallback failed for blueprint ${blueprintId}:`, err.message);
                    res.status(502).json({ error: 'PRINTIFY_PLACEMENTS_FAILED' });
                    return;
                }
            }
            if (printLocations.length === 0) {
                layoutSource = 'emergency_fallback';
                printLocations = [{
                        id: 'front', label: 'Front', canonicalLocationCode: 'front',
                        provider: requestedProvider, providerPlacement: 'front',
                        providerPlacementId: 'front', sourceTable: `${requestedProvider}_print_placements`,
                        layoutSource: 'emergency_fallback', dpi: 300,
                    }];
            }
            // 7. Build response — schema-first: QRG identity leads, provider IDs are metadata only
            res.json({
                docId,
                qrgBlankId,
                // Schema identity — resolved from QRG STNNN digits before any provider query
                schemaFamily,
                schemaType,
                canonicalProfilePath,
                layoutSource,
                title: product.canonicalTitle || product.title || null,
                brand: product.brand || null,
                model: product.model || null,
                category: product.qrgCategory || product.category || null,
                availableSizes,
                availableColors,
                printLocations,
                provider: {
                    name: requestedProvider,
                    blueprintId: blueprintId !== null ? String(blueprintId) : null,
                    printProviderId: printProviderId ? String(printProviderId) : null,
                    printfulProductId: providerProductId,
                },
                qrgVariants,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=master-catalog.js.map