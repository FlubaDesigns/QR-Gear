"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const pricing_1 = require("../services/pricing");
function register(app) {
    // ============ BATCH: STORE/LIBRARY FILE ROUTES ============
    app.get('/store/product/:linkId', async (req, res) => {
        try {
            const { linkId } = req.params;
            const linkDoc = await core_1.db.collection('storeProductLinks').doc(linkId).get();
            if (!linkDoc.exists) {
                res.status(404).json({ error: "Product not found" });
                return;
            }
            const link = linkDoc.data();
            let price = null;
            let availableSizes = link.enabledSizes || [];
            let availableColors = link.enabledColors || [];
            let availablePlacements = [];
            let description = '';
            let category = '';
            let productLine = '';
            let packetImageUrl = null;
            if (link.packetId) {
                const packetDoc = await core_1.db.collection('packets').doc(link.packetId).get();
                if (packetDoc.exists) {
                    const packet = packetDoc.data();
                    packetImageUrl = packet.priorityMockupUrl || packet.landingPageSnapshotUrl || packet.productGraphicUrl || null;
                    const productId = packet.productId;
                    if (productId) {
                        price = await (0, pricing_1.getAuthoritativePrice)(productId);
                        const productDoc = await core_1.db.collection('products').doc(productId).get();
                        if (productDoc.exists) {
                            const product = productDoc.data();
                            if (availableSizes.length === 0)
                                availableSizes = product.availableSizes || product.sizes || [];
                            if (availableColors.length === 0)
                                availableColors = product.availableColors || product.colors || [];
                            availablePlacements = product.availablePlacements || [];
                            description = product.description || '';
                            category = product.category || '';
                            productLine = product.productLine || '';
                        }
                    }
                    if (price === null && packet.pricingSnapshot?.totalPrice) {
                        price = parseFloat(packet.pricingSnapshot.totalPrice);
                    }
                }
            }
            if (price === null && link.pricing) {
                price = parseFloat(link.pricing.customerPrice || link.pricing.totalPrice || link.pricing.retailPrice || '0');
            }
            res.json({
                id: linkDoc.id,
                name: link.productName || 'Untitled Product',
                description,
                category,
                productLine,
                imageUrl: link.mockupUrl || packetImageUrl || link.compositeUrl || link.qrOnlyUrl || null,
                qrCodeUrl: link.qrOnlyUrl || null,
                qrProductType: link.qrProductState || 'qr-basics',
                price: price !== null ? Math.round(price * 100) / 100 : null,
                availableSizes,
                availableColors,
                availablePlacements,
                defaultColor: link.defaultColor || null,
                mockupsByColor: null,
                selectedGraphicSize: link.selectedGraphicSize || null,
                storeId: link.storeId || null,
                storeName: link.storeName || null,
                channel: link.channel || null,
                collection: link.collection || null,
                packetId: link.packetId || null,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/store/product/:linkId/add-to-cart', async (req, res) => {
        try {
            const { linkId } = req.params;
            const { selectedColor, selectedSize, quantity = 1 } = req.body;
            const linkDoc = await core_1.db.collection('storeProductLinks').doc(linkId).get();
            if (!linkDoc.exists) {
                res.status(404).json({ error: "Product not found" });
                return;
            }
            const link = linkDoc.data();
            let price = null;
            let productId = null;
            if (link.packetId) {
                const packetDoc = await core_1.db.collection('packets').doc(link.packetId).get();
                if (packetDoc.exists) {
                    const packet = packetDoc.data();
                    productId = packet.productId || null;
                    if (productId) {
                        price = await (0, pricing_1.getAuthoritativePrice)(productId);
                    }
                    if (price === null && packet.pricingSnapshot?.totalPrice) {
                        price = parseFloat(packet.pricingSnapshot.totalPrice);
                    }
                }
            }
            if (price === null && link.pricing) {
                price = parseFloat(link.pricing.customerPrice || link.pricing.totalPrice || link.pricing.retailPrice || '0');
            }
            if (price === null || price <= 0) {
                res.status(400).json({ error: "Price could not be determined for this product" });
                return;
            }
            res.json({
                productId: productId || linkId,
                linkId,
                price: Math.round(price * 100) / 100,
                name: link.productName || 'Untitled Product',
                imageUrl: link.mockupUrl || link.compositeUrl || link.qrOnlyUrl || null,
                selectedColor: selectedColor || link.defaultColor || null,
                selectedSize: selectedSize || null,
                quantity,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/store/:storeType/:storeName', async (req, res) => {
        try {
            const { storeType, storeName } = req.params;
            const segment = req.query.segment;
            const channel = req.query.channel;
            const collection = req.query.collection;
            if (storeType === 'channel') {
                const channelDoc = await core_1.db.collection('storeChannels').doc(storeName).get();
                if (!channelDoc.exists) {
                    res.status(404).json({ error: "Channel not found" });
                    return;
                }
                const channelData = channelDoc.data() || {};
                const storeId = channelData.storeId;
                let storeData = { id: storeId, name: storeId };
                if (storeId) {
                    const storeDoc = await core_1.db.collection('stores').doc(storeId).get();
                    if (storeDoc.exists) {
                        storeData = { id: storeDoc.id, ...storeDoc.data() };
                    }
                }
                const instancesSnap = await core_1.db.collection('admin_catalog_instances')
                    .where('storeId', '==', storeId)
                    .where('channelId', '==', storeName)
                    .get();
                const getFirstImageUrl = (images) => {
                    if (!images?.length)
                        return null;
                    const img = images[0];
                    if (typeof img === 'string')
                        return img;
                    return img?.url || null;
                };
                const products = await Promise.all(instancesSnap.docs
                    .filter((doc) => {
                    if (!segment)
                        return true;
                    return doc.data().collectionName === segment;
                })
                    .map(async (doc) => {
                    const d = doc.data();
                    const resolved = d.resolved || {};
                    const pricing = resolved.pricing || null;
                    let price = pricing?.customerPrice ?? null;
                    let imageUrl = getFirstImageUrl(resolved.images || []);
                    if (d.currentPacketId) {
                        try {
                            const pDoc = await core_1.db.collection('product_packets').doc(d.currentPacketId).get();
                            if (pDoc.exists) {
                                const pkt = pDoc.data();
                                const mockup = pkt.priorityMockupUrl || pkt.productGraphicUrl || null;
                                if (mockup)
                                    imageUrl = mockup;
                                if (price === null && pkt.pricing?.customerPrice)
                                    price = pkt.pricing.customerPrice;
                            }
                        }
                        catch (_) { }
                    }
                    const toStringArray = (arr) => (arr || []).map((v) => (typeof v === 'string' ? v : v?.name || v?.label || String(v))).filter(Boolean);
                    const rawColors = d.enabledColors || resolved.colors || [];
                    const rawSizes = d.enabledSizes || resolved.sizes || [];
                    return {
                        id: doc.id,
                        name: resolved.title || 'Untitled',
                        imageUrl,
                        segment: d.collectionName || null,
                        isFeatured: false,
                        isSeasonalPromo: false,
                        templateVariant: null,
                        qrProductType: 'qr-basics',
                        qrCodeUrl: null,
                        selectedColors: toStringArray(rawColors),
                        availableSizes: toStringArray(rawSizes),
                        defaultColor: null,
                        mockupsByColor: null,
                        price: price !== null ? Math.round(price * 100) / 100 : null,
                        createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    };
                }));
                console.log(`[Public Store] Channel "${storeName}" in store "${storeId}": ${products.length} catalog instances`);
                res.json({
                    storeType: storeData.roleType || 'internal',
                    storeName: channelData.name || storeName,
                    segment: segment || null,
                    products,
                });
                return;
            }
            const snap = await core_1.db.collection('stores').where('roleType', '==', storeType).limit(10).get();
            if (snap.empty) {
                res.status(404).json({ error: "Store not found" });
                return;
            }
            let matchedStore = null;
            for (const doc of snap.docs) {
                const data = doc.data();
                const storeSlug = (data.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                if (doc.id === storeName || storeSlug === storeName) {
                    matchedStore = { id: doc.id, ...data };
                    break;
                }
            }
            if (!matchedStore) {
                res.status(404).json({ error: "Store not found" });
                return;
            }
            // ---- Channel-scoped query: /api/store/internal/qr-gear?channel=usa250[&collection=monuments] ----
            if (channel) {
                const channelDoc = await core_1.db.collection('storeChannels').doc(channel).get();
                if (!channelDoc.exists || (channelDoc.data() || {}).storeId !== matchedStore.id) {
                    res.status(404).json({ error: 'Channel not found in this store' });
                    return;
                }
                const channelData = channelDoc.data() || {};
                const instancesSnap = await core_1.db.collection('admin_catalog_instances')
                    .where('storeId', '==', matchedStore.id)
                    .where('channelId', '==', channel)
                    .get();
                const getFirstImgUrl = (images) => {
                    if (!images?.length)
                        return null;
                    const img = images[0];
                    return typeof img === 'string' ? img : (img?.url || null);
                };
                const toStrArr = (arr) => (arr || []).map((v) => typeof v === 'string' ? v : v?.name || v?.label || String(v)).filter(Boolean);
                const channelProducts = await Promise.all(instancesSnap.docs
                    .filter((doc) => !collection || doc.data().collectionName === collection)
                    .map(async (doc) => {
                    const d = doc.data();
                    const resolved = d.resolved || {};
                    let price = resolved.pricing?.customerPrice ?? null;
                    let imageUrl = getFirstImgUrl(resolved.images || []);
                    if (d.currentPacketId) {
                        try {
                            const pDoc = await core_1.db.collection('product_packets').doc(d.currentPacketId).get();
                            if (pDoc.exists) {
                                const pkt = pDoc.data();
                                const mockup = pkt.priorityMockupUrl || pkt.productGraphicUrl || null;
                                if (mockup)
                                    imageUrl = mockup;
                                if (price === null && pkt.pricing?.customerPrice)
                                    price = pkt.pricing.customerPrice;
                            }
                        }
                        catch (_) { }
                    }
                    return {
                        id: doc.id,
                        name: resolved.title || 'Untitled',
                        imageUrl,
                        segment: d.collectionName || null,
                        isFeatured: false,
                        isSeasonalPromo: false,
                        templateVariant: null,
                        qrProductType: 'qr-basics',
                        qrCodeUrl: null,
                        selectedColors: toStrArr(d.enabledColors || resolved.colors || []),
                        availableSizes: toStrArr(d.enabledSizes || resolved.sizes || []),
                        defaultColor: null,
                        mockupsByColor: null,
                        price: price !== null ? Math.round(price * 100) / 100 : null,
                        createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    };
                }));
                console.log(`[Public Store] Channel "${channel}" in "${matchedStore.name}": ${channelProducts.length} instances${collection ? ` / collection: ${collection}` : ''}`);
                res.json({
                    storeType: matchedStore.roleType || storeType,
                    storeName: matchedStore.name || storeName,
                    channelId: channel,
                    channelName: channelData.name || channel,
                    collection: collection || null,
                    segment: null,
                    products: channelProducts,
                });
                return;
            }
            // ---- End channel-scoped query ----
            const channelsSnap = await core_1.db.collection('storeChannels').where('storeId', '==', matchedStore.id).get();
            const channels = channelsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // ---- Store-level query: uses admin_catalog_instances (new system) ----
            const getFirstImgUrl2 = (images) => {
                if (!images?.length)
                    return null;
                const img = images[0];
                return typeof img === 'string' ? img : (img?.url || null);
            };
            const toStrArr2 = (arr) => (arr || []).map((v) => typeof v === 'string' ? v : v?.name || v?.label || String(v)).filter(Boolean);
            let instancesQuery = core_1.db.collection('admin_catalog_instances').where('storeId', '==', matchedStore.id);
            const instancesSnap2 = await instancesQuery.get();
            const products = await Promise.all(instancesSnap2.docs
                .filter((doc) => !segment || doc.data().collectionName === segment)
                .map(async (doc) => {
                const d = doc.data();
                const resolved = d.resolved || {};
                let price = resolved.pricing?.customerPrice ?? null;
                let imageUrl = getFirstImgUrl2(resolved.images || []);
                if (d.currentPacketId) {
                    try {
                        const pDoc = await core_1.db.collection('product_packets').doc(d.currentPacketId).get();
                        if (pDoc.exists) {
                            const pkt = pDoc.data();
                            const mockup = pkt.priorityMockupUrl || pkt.productGraphicUrl || null;
                            if (mockup)
                                imageUrl = mockup;
                            if (price === null && pkt.pricing?.customerPrice)
                                price = pkt.pricing.customerPrice;
                        }
                    }
                    catch (_) { }
                }
                return {
                    id: doc.id,
                    name: resolved.title || 'Untitled',
                    imageUrl,
                    segment: d.collectionName || null,
                    isFeatured: false,
                    isSeasonalPromo: false,
                    templateVariant: null,
                    qrProductType: 'qr-basics',
                    qrCodeUrl: null,
                    selectedColors: toStrArr2(d.enabledColors || resolved.colors || []),
                    availableSizes: toStrArr2(d.enabledSizes || resolved.sizes || []),
                    defaultColor: null,
                    mockupsByColor: null,
                    price: price !== null ? Math.round(price * 100) / 100 : null,
                    createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                };
            }));
            console.log(`[Public Store] Store "${matchedStore.name}" (${storeType}): ${products.length} catalog instances, ${channels.length} channels`);
            res.json({
                storeType,
                storeName: matchedStore.name,
                segment: segment || null,
                channels,
                products,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/product-categories/seed', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ message: "Use POST to seed categories" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/product-categories/seed', middleware_1.requireAdmin, async (req, res) => {
        try {
            const defaults = ['T-Shirts', 'Hoodies', 'Mugs', 'Posters', 'Stickers', 'Phone Cases', 'Tote Bags', 'Hats'];
            const batch = core_1.db.batch();
            defaults.forEach(name => { const ref = core_1.db.collection('product_categories').doc(); batch.set(ref, { name, slug: name.toLowerCase().replace(/\s+/g, '-'), isActive: true, createdAt: new Date() }); });
            await batch.commit();
            res.json({ success: true, count: defaults.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ============ BATCH: FILE SERVING ROUTES ============
    app.get('/library-files/:file', async (req, res) => {
        try {
            res.setHeader('Access-Control-Allow-Origin', '*');
            const fileName = String(req.params.file || '').trim();
            if (!fileName) {
                res.status(400).json({ error: 'Missing filename' });
                return;
            }
            const bucket = core_1.admin.storage().bucket();
            const roots = ['library/backgrounds/raw', 'library/backgrounds/cropped', 'library/backgrounds/raw/zip', 'library/backgrounds/zip', 'library/templates', 'library/designs', 'custom-designs', 'library/images'];
            for (const root of roots) {
                const file = bucket.file(`${root}/${fileName}`);
                const [exists] = await file.exists();
                if (exists) {
                    const [metadata] = await file.getMetadata();
                    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
                    res.set('Cache-Control', 'public, max-age=3600');
                    const stream = file.createReadStream();
                    stream.pipe(res);
                    return;
                }
            }
            const imgSnap = await core_1.admin.firestore().collection('admin_images').where('isActive', '==', true).get();
            for (const doc of imgSnap.docs) {
                const sUrl = doc.data().storageUrl || '';
                if (sUrl && sUrl.split('/').pop() === fileName) {
                    const file = bucket.file(sUrl);
                    const [exists] = await file.exists();
                    if (exists) {
                        const [metadata] = await file.getMetadata();
                        res.set('Content-Type', metadata.contentType || 'application/octet-stream');
                        res.set('Cache-Control', 'public, max-age=3600');
                        file.createReadStream().pipe(res);
                        return;
                    }
                }
            }
            res.status(404).json({ error: 'File not found' });
        }
        catch (e) {
            if (!res.headersSent)
                res.status(500).json({ error: e.message });
        }
    });
    app.get('/files/:file', async (req, res) => {
        try {
            const fileName = String(req.params.file || '').trim();
            if (!fileName) {
                res.status(400).json({ error: 'Missing filename' });
                return;
            }
            const bucket = core_1.admin.storage().bucket();
            const file = bucket.file(`custom-designs/${fileName}`);
            const [exists] = await file.exists();
            if (!exists) {
                res.status(404).json({ error: 'File not found' });
                return;
            }
            const [metadata] = await file.getMetadata();
            res.set('Content-Type', metadata.contentType || 'application/octet-stream');
            res.set('Cache-Control', 'public, max-age=31536000');
            file.createReadStream().pipe(res);
        }
        catch (e) {
            if (!res.headersSent)
                res.status(500).json({ error: e.message });
        }
    });
    app.get('/media-files/:filename', async (req, res) => {
        try {
            const fileName = req.params.filename;
            const bucket = core_1.admin.storage().bucket();
            const file = bucket.file(`uploads/${fileName}`);
            const [exists] = await file.exists();
            if (!exists) {
                res.status(404).json({ error: 'Media file not found' });
                return;
            }
            const [metadata] = await file.getMetadata();
            res.set('Content-Type', metadata.contentType || 'application/octet-stream');
            res.set('Cache-Control', 'public, max-age=31536000');
            file.createReadStream().pipe(res);
        }
        catch (e) {
            if (!res.headersSent)
                res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=store-files.js.map