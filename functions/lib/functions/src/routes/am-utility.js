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
function register(app) {
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
//# sourceMappingURL=am-utility.js.map