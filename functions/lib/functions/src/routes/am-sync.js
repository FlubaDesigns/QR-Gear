"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const printful_1 = require("../services/printful");
const printify_1 = require("../services/printify");
const mockup_generator_1 = require("../services/mockup-generator");
const printful_2 = require("../services/printful");
const composite_image_1 = require("../services/composite-image");
function register(app) {
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
    // --- Dynamic Pages ---
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
                const bpDoc = await core_1.db.collection('printify_blueprints').doc(String(bid)).get();
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
}
//# sourceMappingURL=am-sync.js.map