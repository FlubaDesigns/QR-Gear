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
    // ── GET /admin/master-catalog/products/:docId/options ────────────────────────
    // QRG-native product options resolver.
    // Given a qrg_STNNN doc ID, returns sizes, colors, print locations and variant
    // mappings without requiring callers to know provider IDs.
    //
    // Validation codes:
    //   400  INVALID_QRG_DOC_ID
    //   404  MASTER_PRODUCT_NOT_FOUND
    //   409  PRINTIFY_MAPPING_MISSING
    //   502  PRINTIFY_PLACEMENTS_FAILED
    app.get('/admin/master-catalog/products/:docId/options', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { docId } = req.params;
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
            if (!rawBlueprintId) {
                res.status(409).json({
                    error: 'PRINTIFY_MAPPING_MISSING',
                    message: 'This master product does not have blueprintId and printProviderId mapping.',
                });
                return;
            }
            const blueprintId = parseInt(rawBlueprintId, 10);
            let printProviderId = rawPrintProviderId ? parseInt(rawPrintProviderId, 10) : null;
            // 4. Resolve printProviderId if missing — check DB then live API
            if (!printProviderId) {
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
            if (!printProviderId && printify_1.printifyClient.isConfigured) {
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
                // Collect provider size/color labels for providerValues
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
            // Fall back to flat availableSizes/Colors code arrays if variants are empty
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
            // 6. Resolve print locations
            // First try cached printPositions on the master doc — no live API call needed
            let printLocations = [];
            const cachedPositions = Array.isArray(product.printPositions) ? product.printPositions : [];
            if (cachedPositions.length > 0) {
                printLocations = cachedPositions
                    .filter((p) => !(0, core_1.isEmbroideryPlacement)(p))
                    .map((pos) => ({
                    id: pos,
                    label: pos.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                    provider: 'printify',
                    providerPlacement: pos,
                }));
            }
            else if (printProviderId && printify_1.printifyClient.isConfigured) {
                // Live API fallback — same logic as /admin/catalog/placements
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
                        provider: 'printify',
                        providerPlacement: pos,
                    }));
                }
                catch (err) {
                    console.error(`[MasterCatalog/options] Placements fetch failed for blueprint ${blueprintId}:`, err.message);
                    res.status(502).json({ error: 'PRINTIFY_PLACEMENTS_FAILED' });
                    return;
                }
            }
            else {
                // No cached positions and no provider ID — return front as safe default
                printLocations = [{ id: 'front', label: 'Front', provider: 'printify', providerPlacement: 'front' }];
            }
            // 7. Build response — product identity uses QRG doc ID, provider IDs are metadata only
            res.json({
                docId,
                qrgBlankId,
                title: product.canonicalTitle || product.title || null,
                brand: product.brand || null,
                model: product.model || null,
                category: product.qrgCategory || product.category || null,
                availableSizes,
                availableColors,
                printLocations,
                provider: {
                    name: 'printify',
                    blueprintId: String(blueprintId),
                    printProviderId: printProviderId ? String(printProviderId) : null,
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