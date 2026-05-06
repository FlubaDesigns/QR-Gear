"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const pricing_1 = require("../services/pricing");
const core_routes_checkout_1 = require("./core-routes-checkout");
function register(app) {
    (0, core_routes_checkout_1.registerCoreCheckoutRoutes)(app);
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            mode: 'firebase-functions',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            buildId: process.env.QRGEAR_BUILD_ID || 'unknown',
        });
    });
    app.get('/members/allowed-products', async (req, res) => {
        try {
            const section = req.query.section;
            const validSections = ['member', 'public', 'external', 'marketplace', 'platform'];
            if (section && !validSections.includes(section)) {
                res.status(400).json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` });
                return;
            }
            const pricingDoc = await core_1.db.collection('testSettings').doc('pricing').get();
            const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
            const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
            const markupPercent = pricingSettings?.markupPercent ?? 25;
            const markupFixed = pricingSettings?.markupFixed ?? 0;
            const effectiveSection = section || 'member';
            let catalogBlankFilter = null;
            let catalogBlankDescriptions = {};
            const assignDoc = await core_1.db.collection('systemSettings').doc('catalog-assignments').get();
            const catalogId = assignDoc.exists ? assignDoc.data()?.[effectiveSection] : null;
            if (catalogId) {
                const catDoc = await core_1.db.collection('catalogs').doc(catalogId).get();
                if (catDoc.exists) {
                    const blankIds = catDoc.data()?.blankIds || [];
                    catalogBlankFilter = new Set(blankIds.map(String));
                    catalogBlankDescriptions = catDoc.data()?.blankDescriptions || {};
                    console.log(`[Member Products CF] Filtering by catalog "${catDoc.data()?.name}" (${blankIds.length} blanks) for section "${effectiveSection}"`);
                }
            }
            const blueprintCache = new Map();
            const enrichProducts = async (rawProducts) => {
                return await Promise.all((rawProducts || []).map(async (p) => {
                    let baseCost = Number(p.baseCost || 0);
                    let imageUrl = p.imageUrl || p.thumbnailUrl || p.image_url || null;
                    const blueprintId = Number(p.blueprintId || p.blueprint_id || 0) || null;
                    const printProviderId = Number(p.printProviderId || p.print_provider_id || 0) || null;
                    if (blueprintId) {
                        try {
                            if (!blueprintCache.has(blueprintId)) {
                                const bpDoc = await core_1.db.collection('printify_blueprints').doc(String(blueprintId)).get();
                                if (bpDoc.exists)
                                    blueprintCache.set(blueprintId, bpDoc.data());
                            }
                            const bpData = blueprintCache.get(blueprintId);
                            if (bpData) {
                                const bpImage = bpData.images?.[0] ||
                                    bpData.imageUrl ||
                                    bpData.image_url ||
                                    null;
                                if ((!imageUrl || String(imageUrl).includes('/api/files/')) && bpImage)
                                    imageUrl = bpImage;
                            }
                        }
                        catch (e) {
                            console.log(`[Member Products CF] Blueprint image lookup failed for ${blueprintId}: ${e.message}`);
                        }
                    }
                    if (baseCost === 0 && blueprintId && printProviderId) {
                        try {
                            const provDoc = await core_1.db.collection('printifyPrintProviders')
                                .doc(`${blueprintId}_${printProviderId}`)
                                .get();
                            if (provDoc.exists) {
                                const minCost = provDoc.data()?.minCost;
                                if (minCost)
                                    baseCost = Number(minCost) / 100;
                            }
                        }
                        catch (e) {
                            console.warn(`[Member Products CF] Cost lookup failed for ${blueprintId}_${printProviderId}: ${e.message}`);
                        }
                    }
                    const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
                    const profit = retailPrice - baseCost;
                    const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
                    let placements = p.placements;
                    if (!placements || placements.length === 0) {
                        placements = [
                            { id: 'front', title: 'Front', widthInches: '12"', heightInches: '16"' },
                            { id: 'back', title: 'Back', widthInches: '12"', heightInches: '16"' },
                            { id: 'pocket', title: 'Left Chest', widthInches: '4"', heightInches: '4"' },
                            { id: 'left_sleeve', title: 'Left Sleeve', widthInches: '4"', heightInches: '4"' },
                            { id: 'right_sleeve', title: 'Right Sleeve', widthInches: '4"', heightInches: '4"' },
                        ];
                    }
                    else {
                        placements = placements.map((pl) => {
                            const nId = (0, core_1.normalizePlacement)(p.fulfillmentProvider || 'printify', pl.id || pl.type || '');
                            return { ...pl, id: nId };
                        });
                    }
                    const fulfillmentProvider = p.fulfillmentProvider || 'printify';
                    const blankKey = fulfillmentProvider === 'printful' ? `pf:${blueprintId}` : String(blueprintId);
                    const bpData = blueprintId ? blueprintCache.get(blueprintId) : null;
                    const rawRichDesc = bpData?.richDescription || bpData?.description || p.description || '';
                    const providerDescription = rawRichDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    const adminCatalogDescription = catalogBlankDescriptions[blankKey] || '';
                    const productTitle = p.title || p.name || 'Untitled Product';
                    const effectiveDescription = adminCatalogDescription || providerDescription || `${productTitle}${p.brand ? ' by ' + p.brand : ''}. Premium quality custom product.`;
                    return {
                        ...p,
                        blueprintId,
                        printProviderId,
                        canonicalBlankKey: blankKey,
                        provider: fulfillmentProvider,
                        title: p.title || p.name || 'Untitled Product',
                        imageUrl,
                        baseCost,
                        retailPrice,
                        profit,
                        memberEarnings,
                        placements,
                        description: effectiveDescription,
                        providerDescription,
                        originalDescription: providerDescription,
                        adminCatalogDescription: adminCatalogDescription || null,
                        effectiveDescription,
                    };
                }));
            };
            const memberDoc = await core_1.db.collection('storeAllowedProducts').doc('member-products').get();
            const memberData = memberDoc.exists ? memberDoc.data() : null;
            const memberProducts = Array.isArray(memberData?.products) ? memberData.products : [];
            if (memberProducts.length > 0) {
                let products = await enrichProducts(memberProducts);
                if (catalogBlankFilter) {
                    products = products.filter((p) => catalogBlankFilter.has(p.canonicalBlankKey || String(p.blueprintId)));
                    console.log(`[Member Products CF] Catalog filter applied: ${products.length} products remain from ${memberProducts.length}`);
                }
                console.log(`[Member Products CF] Using curated member-products doc with ${products.length} products`);
                res.json({
                    products,
                    storeId: 'member-products',
                    source: 'storeAllowedProducts/member-products'
                });
                return;
            }
            const catalogSnap = await core_1.db.collection('products')
                .where('isEnabled', '==', true)
                .get();
            const catalogProducts = catalogSnap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    blueprintId: d.blueprintId || d.blueprint_id || null,
                    printProviderId: d.printProviderId || d.print_provider_id || null,
                    title: d.title || d.name || 'Untitled Product',
                    imageUrl: d.imageUrl || d.thumbnailUrl || d.image_url || null,
                    baseCost: d.baseCost || 0,
                    placements: d.placements || [],
                    brand: d.brand || null,
                    isEnabled: d.isEnabled === true,
                };
            }).filter(p => !!p.blueprintId);
            let products = await enrichProducts(catalogProducts);
            if (catalogBlankFilter) {
                products = products.filter((p) => catalogBlankFilter.has(p.canonicalBlankKey || String(p.blueprintId)));
                console.log(`[Member Products CF] Catalog filter applied (fallback): ${products.length} products remain`);
            }
            console.log(`[Member Products CF] member-products empty/missing. Falling back to /products catalog with ${products.length} products`);
            res.json({
                products,
                storeId: 'member-products',
                source: 'products-fallback'
            });
        }
        catch (error) {
            console.error('[Member Products CF] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/products', async (req, res) => {
        try {
            const featured = req.query.featured === 'true';
            let query = core_1.db.collection('products').where('isEnabled', '==', true);
            if (featured) {
                query = query.where('isFeatured', '==', true);
            }
            const snapshot = await query.get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            console.error('Error fetching products:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/products/:id', async (req, res) => {
        try {
            const doc = await core_1.db.collection('products').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/designs/:id', async (req, res) => {
        try {
            const doc = await core_1.db.collection('customDesigns').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Design not found' });
                return;
            }
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/auth/user', async (req, res) => {
        try {
            const decodedToken = await (0, middleware_1.verifyAuth)(req);
            if (!decodedToken) {
                // Return null instead of 401 for unauthenticated requests
                res.json(null);
                return;
            }
            const userDoc = await core_1.db.collection('users').doc(decodedToken.uid).get();
            if (!userDoc.exists) {
                const newUser = {
                    email: decodedToken.email,
                    displayName: decodedToken.name || decodedToken.email?.split('@')[0],
                    isAdmin: middleware_1.ADMIN_USER_IDS.includes(decodedToken.uid),
                    createdAt: core_1.admin.firestore.FieldValue.serverTimestamp()
                };
                await core_1.db.collection('users').doc(decodedToken.uid).set(newUser);
                res.json({ ...newUser, id: decodedToken.uid });
                return;
            }
            // Merge Firestore data with isAdmin check from both sources
            const userData = (0, core_1.docToObject)(userDoc);
            const isAdmin = userData.isAdmin === true || middleware_1.ADMIN_USER_IDS.includes(decodedToken.uid);
            res.json({ ...userData, isAdmin });
        }
        catch (error) {
            // Return null on error instead of 401
            console.error('[/auth/user] Error:', error.message);
            res.json(null);
        }
    });
    app.get('/cart', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const snapshot = await core_1.db.collection('cartItems').where('userId', '==', userId).get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/cart', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const { customization, quantity, price: clientPrice } = req.body;
            const productId = customization?.productId;
            if (!productId) {
                res.status(400).json({ error: 'Product ID is required' });
                return;
            }
            // ── Resolve authoritative price ───────────────────────────────────────
            // New store products use admin_catalog_instances (linkId/instanceId).
            // Old products use the products collection.
            // The add-to-cart endpoint already validated the price — trust it when
            // a catalog instance is involved, falling back to old pricing logic.
            let authoritativePrice = null;
            // Path 1: catalog instance (new store system)
            const instanceId = customization?.instanceId || customization?.linkId || productId;
            const instanceDoc = await core_1.db.collection('admin_catalog_instances').doc(instanceId).get();
            if (instanceDoc.exists) {
                const d = instanceDoc.data();
                authoritativePrice = d.resolved?.pricing?.customerPrice ?? null;
                // If not on the instance, check the packet
                if ((authoritativePrice === null || authoritativePrice <= 0) && d.currentPacketId) {
                    try {
                        const pDoc = await core_1.db.collection('productPackets').doc(d.currentPacketId).get();
                        if (pDoc.exists) {
                            const pkt = pDoc.data();
                            authoritativePrice = pkt.pricing?.customerPrice ?? null;
                        }
                    }
                    catch (_) { }
                }
                // Last resort: trust the already-validated price from the add-to-cart step
                if ((authoritativePrice === null || authoritativePrice <= 0) && clientPrice) {
                    authoritativePrice = parseFloat(String(clientPrice));
                }
            }
            // Path 2: legacy products collection (old builder flow)
            if (authoritativePrice === null || authoritativePrice <= 0) {
                const pricingInput = {
                    productId,
                    productLine: customization?.productLine || 'text',
                    hasTextAbove: customization?.hasTextAbove || false,
                    hasTextBelow: customization?.hasTextBelow || false,
                    templateId: customization?.templateId,
                    hostingTierCode: customization?.hostingTierCode || customization?.dynamicHostingTier || '1_year',
                };
                authoritativePrice = await (0, pricing_1.calculateAuthoritativePrice)(pricingInput);
            }
            if (authoritativePrice === null || authoritativePrice <= 0) {
                res.status(400).json({ error: 'Product not found or has no valid price' });
                return;
            }
            const cartItem = {
                customization,
                quantity: quantity || 1,
                price: (Math.round(authoritativePrice * 100) / 100).toString(),
                userId,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp()
            };
            const docRef = await core_1.db.collection('cartItems').add(cartItem);
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/cart/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            const { quantity } = req.body;
            await core_1.db.collection('cartItems').doc(req.params.id).update({ quantity });
            const doc = await core_1.db.collection('cartItems').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/cart/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            await core_1.db.collection('cartItems').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/orders', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const snapshot = await core_1.db.collection('orders')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/orders/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            const doc = await core_1.db.collection('orders').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/orders', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user.uid;
            const docRef = await core_1.db.collection('orders').add({
                ...req.body,
                userId,
                status: 'pending',
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp()
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/qr-templates', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('qrTemplates').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/qr-templates/:id', async (req, res) => {
        try {
            const doc = await core_1.db.collection('qrTemplates').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'QR Template not found' });
                return;
            }
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/hosting-tiers', async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('hostingTiers').orderBy('sortOrder', 'asc').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stores/:slug', async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('partnerStores')
                .where('slug', '==', req.params.slug)
                .limit(1)
                .get();
            if (snapshot.empty) {
                res.status(404).json({ error: 'Store not found' });
                return;
            }
            res.json((0, core_1.docToObject)(snapshot.docs[0]));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/settings', async (_req, res) => {
        try {
            const doc = await core_1.db.collection('settings').doc('admin').get();
            res.json(doc.exists ? doc.data() : {});
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stripe/publishable-key', async (_req, res) => {
        const key = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
        if (!key) {
            res.status(500).json({ error: 'Stripe not configured' });
            return;
        }
        res.json({ publishableKey: key });
    });
}
//# sourceMappingURL=core-routes.js.map