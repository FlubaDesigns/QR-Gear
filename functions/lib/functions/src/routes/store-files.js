"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const pricing_1 = require("../services/pricing");
const storefrontTypes_1 = require("../../../shared/storefrontTypes");
function register(app) {
    // ============ BATCH: STORE/LIBRARY FILE ROUTES ============
    app.get('/store/product/:linkId', async (req, res) => {
        try {
            const { linkId } = req.params;
            // Helper: normalize images array (items may be strings or {url} objects)
            const toUrlArr = (imgs) => (imgs || []).map((img) => (typeof img === 'string' ? img : img?.url || null)).filter(Boolean);
            // ── Path A: storeProductLinks (original path) ───────────────────────────
            const linkDoc = await core_1.db.collection('storeProductLinks').doc(linkId).get();
            if (linkDoc.exists) {
                const link = linkDoc.data();
                let price = null;
                let availableSizes = link.enabledSizes || [];
                let availableColors = link.enabledColors || [];
                let availablePlacements = [];
                let description = '';
                let category = '';
                let productLine = '';
                let packetImageUrl = null;
                let packetPlacementMockupUrls = {};
                if (link.packetId) {
                    const packetDoc = await core_1.db.collection('packets').doc(link.packetId).get();
                    if (packetDoc.exists) {
                        const packet = packetDoc.data();
                        packetImageUrl = packet.priorityMockupUrl || packet.landingPageSnapshotUrl || packet.productGraphicUrl || null;
                        if (packet.placementMockupUrls && typeof packet.placementMockupUrls === 'object') {
                            packetPlacementMockupUrls = packet.placementMockupUrls;
                        }
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
                // Build ordered gallery: kept catalog images first → digital markup mockups appended at end
                const lifestyleUrl = link.lifestyleMockupUrl || null;
                const flatMockupUrl = link.mockupUrl || packetImageUrl || null;
                const storedImages = toUrlArr(link.images || []);
                // Merge placement mockup URLs — link overrides packet (admin can override via PATCH)
                const mergedPlacementUrls = {
                    ...packetPlacementMockupUrls,
                    ...(link.placementMockupUrls && typeof link.placementMockupUrls === 'object'
                        ? link.placementMockupUrls
                        : {}),
                };
                const EXTRA_PLACEMENT_ORDER = ['back', 'left_sleeve', 'right_sleeve'];
                // Collect all mockup/graphic URLs to append after catalog images
                const mockupImages = [];
                if (lifestyleUrl)
                    mockupImages.push(lifestyleUrl);
                if (flatMockupUrl && flatMockupUrl !== lifestyleUrl)
                    mockupImages.push(flatMockupUrl);
                EXTRA_PLACEMENT_ORDER.forEach(p => {
                    const u = mergedPlacementUrls[p];
                    if (u && !mockupImages.includes(u))
                        mockupImages.push(u);
                });
                // Also include QR artwork if distinct from above
                const qrArtUrl = link.compositeUrl || link.qrOnlyUrl || null;
                if (qrArtUrl && !mockupImages.includes(qrArtUrl))
                    mockupImages.push(qrArtUrl);
                const allImages = [];
                // Kept catalog images first
                storedImages.forEach((u) => { if (!allImages.includes(u))
                    allImages.push(u); });
                // Digital markup mockups appended at the end
                mockupImages.forEach((u) => { if (!allImages.includes(u))
                    allImages.push(u); });
                res.json({
                    id: linkDoc.id,
                    name: link.productName || 'Untitled Product',
                    description,
                    category,
                    productLine,
                    imageUrl: allImages[0] || null,
                    images: allImages,
                    packetImageUrl,
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
                    options: (0, storefrontTypes_1.buildStructuredOptions)(availableColors, availableSizes),
                    cardMode: (0, storefrontTypes_1.deriveCardMode)(availableColors, availableSizes),
                    media: { images: allImages, mockupPriority: true, heroStrategy: 'catalogFirst' },
                });
                return;
            }
            // ── Path B: admin_catalog_instances (products from store catalog listing) ─
            const instanceDoc = await core_1.db.collection('admin_catalog_instances').doc(linkId).get();
            if (!instanceDoc.exists) {
                res.status(404).json({ error: "Product not found" });
                return;
            }
            const d = instanceDoc.data();
            const resolved = d.resolved || {};
            let price = resolved.pricing?.customerPrice ?? null;
            let packetMockupUrl = null;
            if (d.currentPacketId) {
                try {
                    const pDoc = await core_1.db.collection('productPackets').doc(d.currentPacketId).get();
                    if (pDoc.exists) {
                        const pkt = pDoc.data();
                        packetMockupUrl = pkt.priorityMockupUrl || pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                        if (price === null && pkt.pricing?.customerPrice)
                            price = pkt.pricing.customerPrice;
                    }
                }
                catch (_) { }
            }
            const toStrArr = (arr) => (arr || []).map((v) => (typeof v === 'string' ? v : v?.name || v?.label || String(v))).filter(Boolean);
            // Build ordered gallery: kept catalog images first → digital markup mockup appended
            const providerImages = toUrlArr(resolved.images || []);
            const allImages = [];
            providerImages.forEach((u) => { if (!allImages.includes(u))
                allImages.push(u); });
            if (packetMockupUrl && !allImages.includes(packetMockupUrl))
                allImages.push(packetMockupUrl);
            const bColors = toStrArr(d.enabledColors || resolved.colors || []);
            const bSizes = toStrArr(d.enabledSizes || resolved.sizes || []);
            res.json({
                id: instanceDoc.id,
                name: resolved.title || 'Untitled',
                description: resolved.description || '',
                category: resolved.category || '',
                productLine: resolved.productLine || '',
                imageUrl: allImages[0] || null,
                images: allImages,
                packetImageUrl: packetMockupUrl,
                qrCodeUrl: null,
                qrProductType: d.qrProductType || 'qr-basics',
                price: price !== null ? Math.round(price * 100) / 100 : null,
                availableSizes: bSizes,
                availableColors: bColors,
                availablePlacements: [],
                defaultColor: null,
                mockupsByColor: null,
                selectedGraphicSize: null,
                storeId: d.storeId || null,
                storeName: d.storeName || null,
                channel: d.channelId || null,
                collection: d.collectionName || null,
                packetId: d.currentPacketId || null,
                options: (0, storefrontTypes_1.buildStructuredOptions)(bColors, bSizes),
                cardMode: (0, storefrontTypes_1.deriveCardMode)(bColors, bSizes),
                media: { images: allImages, mockupPriority: true, heroStrategy: 'catalogFirst' },
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
            // ── Path A: storeProductLinks ──────────────────────────────────────────
            const linkDoc = await core_1.db.collection('storeProductLinks').doc(linkId).get();
            if (linkDoc.exists) {
                const link = linkDoc.data();
                let price = null;
                let productId = null;
                if (link.packetId) {
                    const packetDoc = await core_1.db.collection('packets').doc(link.packetId).get();
                    if (packetDoc.exists) {
                        const packet = packetDoc.data();
                        productId = packet.productId || null;
                        if (productId)
                            price = await (0, pricing_1.getAuthoritativePrice)(productId);
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
                return;
            }
            // ── Path B: admin_catalog_instances ────────────────────────────────────
            const instanceDoc = await core_1.db.collection('admin_catalog_instances').doc(linkId).get();
            if (!instanceDoc.exists) {
                res.status(404).json({ error: "Product not found" });
                return;
            }
            const d = instanceDoc.data();
            const resolved = d.resolved || {};
            let price = resolved.pricing?.customerPrice ?? null;
            let heroImageUrl = null;
            if (d.currentPacketId) {
                try {
                    const pDoc = await core_1.db.collection('productPackets').doc(d.currentPacketId).get();
                    if (pDoc.exists) {
                        const pkt = pDoc.data();
                        heroImageUrl = pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                        if (price === null && pkt.pricing?.customerPrice)
                            price = pkt.pricing.customerPrice;
                    }
                }
                catch (_) { }
            }
            // Fallback to first provider catalog image
            if (!heroImageUrl && resolved.images?.length) {
                const img = resolved.images[0];
                heroImageUrl = typeof img === 'string' ? img : (img?.url || null);
            }
            if (price === null || price <= 0) {
                res.status(400).json({ error: "Price could not be determined for this product" });
                return;
            }
            res.json({
                productId: linkId,
                linkId,
                price: Math.round(price * 100) / 100,
                name: resolved.title || 'Untitled',
                imageUrl: heroImageUrl,
                selectedColor: selectedColor || null,
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
                    // Lifestyle/person image from the Printify catalog — this is always first
                    const imageUrl = getFirstImageUrl(resolved.images || []);
                    // QR graphic mockup from the packet — shown as secondary image
                    let packetImageUrl = null;
                    if (d.currentPacketId) {
                        try {
                            const pDoc = await core_1.db.collection('productPackets').doc(d.currentPacketId).get();
                            if (pDoc.exists) {
                                const pkt = pDoc.data();
                                packetImageUrl = pkt.priorityMockupUrl || pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                                if (price === null && pkt.pricing?.customerPrice)
                                    price = pkt.pricing.customerPrice;
                            }
                        }
                        catch (_) { }
                    }
                    const toStringArray = (arr) => (arr || []).map((v) => (typeof v === 'string' ? v : v?.name || v?.label || String(v))).filter(Boolean);
                    const toImgUrl = (img) => typeof img === 'string' ? img : (img?.url || null);
                    const rawColors = d.enabledColors || resolved.colors || [];
                    const rawSizes = d.enabledSizes || resolved.sizes || [];
                    // Build ordered gallery: kept catalog images first → digital markup mockup appended
                    const providerImgs = (resolved.images || []).map(toImgUrl).filter(Boolean);
                    const allImages = [];
                    providerImgs.forEach((u) => { if (!allImages.includes(u))
                        allImages.push(u); });
                    if (packetImageUrl && !allImages.includes(packetImageUrl))
                        allImages.push(packetImageUrl);
                    const l1Colors = toStringArray(rawColors);
                    const l1Sizes = toStringArray(rawSizes);
                    return {
                        id: doc.id,
                        name: resolved.title || 'Untitled',
                        imageUrl: allImages[0] || null,
                        images: allImages,
                        packetImageUrl,
                        segment: d.collectionName || null,
                        isFeatured: false,
                        isSeasonalPromo: false,
                        templateVariant: null,
                        qrProductType: 'qr-basics',
                        qrCodeUrl: null,
                        selectedColors: l1Colors,
                        availableSizes: l1Sizes,
                        defaultColor: null,
                        mockupsByColor: null,
                        price: price !== null ? Math.round(price * 100) / 100 : null,
                        createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                        options: (0, storefrontTypes_1.buildStructuredOptions)(l1Colors, l1Sizes),
                        cardMode: (0, storefrontTypes_1.deriveCardMode)(l1Colors, l1Sizes),
                        media: { images: allImages, mockupPriority: true, heroStrategy: 'catalogFirst' },
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
                const storeSlugCompact = storeSlug.replace(/-/g, '');
                if (doc.id === storeName || storeSlug === storeName || storeSlugCompact === storeName) {
                    matchedStore = { id: doc.id, ...data };
                    break;
                }
            }
            // Channel-first fallback: if store not found by name, resolve it via the channel doc
            if (!matchedStore && channel) {
                const fallbackChan = await core_1.db.collection('storeChannels').doc(channel).get();
                if (fallbackChan.exists) {
                    const fcData = fallbackChan.data() || {};
                    if (fcData.storeId) {
                        const storeDoc = await core_1.db.collection('stores').doc(fcData.storeId).get();
                        if (storeDoc.exists)
                            matchedStore = { id: storeDoc.id, ...storeDoc.data() };
                    }
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
                // Normalize to slug for comparison so "Armed Forces" matches URL param "armed-forces"
                const toSlug = (s) => s.toLowerCase().replace(/[\s_]+/g, '-');
                const collectionSlug = collection ? toSlug(collection) : null;
                const channelProducts = await Promise.all(instancesSnap.docs
                    .filter((doc) => {
                    if (!collection)
                        return true;
                    const name = doc.data().collectionName || '';
                    return name === collection || toSlug(name) === collectionSlug;
                })
                    .map(async (doc) => {
                    const d = doc.data();
                    const resolved = d.resolved || {};
                    let price = resolved.pricing?.customerPrice ?? null;
                    const imageUrl = getFirstImgUrl(resolved.images || []);
                    let packetImageUrl = null;
                    if (d.currentPacketId) {
                        try {
                            const pDoc = await core_1.db.collection('productPackets').doc(d.currentPacketId).get();
                            if (pDoc.exists) {
                                const pkt = pDoc.data();
                                packetImageUrl = pkt.priorityMockupUrl || pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                                if (price === null && pkt.pricing?.customerPrice)
                                    price = pkt.pricing.customerPrice;
                            }
                        }
                        catch (_) { }
                    }
                    const toImgUrlCh = (img) => typeof img === 'string' ? img : (img?.url || null);
                    const providerImgsCh = (resolved.images || []).map(toImgUrlCh).filter(Boolean);
                    const allImagesCh = [];
                    providerImgsCh.forEach((u) => { if (!allImagesCh.includes(u))
                        allImagesCh.push(u); });
                    if (packetImageUrl && !allImagesCh.includes(packetImageUrl))
                        allImagesCh.push(packetImageUrl);
                    const l2Colors = toStrArr(d.enabledColors || resolved.colors || []);
                    const l2Sizes = toStrArr(d.enabledSizes || resolved.sizes || []);
                    return {
                        id: doc.id,
                        name: resolved.title || 'Untitled',
                        imageUrl: allImagesCh[0] || null,
                        images: allImagesCh,
                        packetImageUrl,
                        segment: d.collectionName || null,
                        isFeatured: false,
                        isSeasonalPromo: false,
                        templateVariant: null,
                        qrProductType: 'qr-basics',
                        qrCodeUrl: null,
                        selectedColors: l2Colors,
                        availableSizes: l2Sizes,
                        defaultColor: null,
                        mockupsByColor: null,
                        price: price !== null ? Math.round(price * 100) / 100 : null,
                        createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                        options: (0, storefrontTypes_1.buildStructuredOptions)(l2Colors, l2Sizes),
                        cardMode: (0, storefrontTypes_1.deriveCardMode)(l2Colors, l2Sizes),
                        media: { images: allImagesCh, mockupPriority: true, heroStrategy: 'catalogFirst' },
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
            const getFirstImgUrl2 = (images) => {
                if (!images?.length)
                    return null;
                const img = images[0];
                return typeof img === 'string' ? img : (img?.url || null);
            };
            const toStrArr2 = (arr) => (arr || []).map((v) => typeof v === 'string' ? v : v?.name || v?.label || String(v)).filter(Boolean);
            const storeInstancesSnap = await core_1.db.collection('admin_catalog_instances')
                .where('storeId', '==', matchedStore.id)
                .get();
            const products = await Promise.all(storeInstancesSnap.docs
                .filter((doc) => !segment || doc.data().collectionName === segment)
                .map(async (doc) => {
                const d = doc.data();
                const resolved = d.resolved || {};
                let price = resolved.pricing?.customerPrice ?? null;
                const imageUrl = getFirstImgUrl2(resolved.images || []);
                let packetImageUrl = null;
                if (d.currentPacketId) {
                    try {
                        const pDoc = await core_1.db.collection('productPackets').doc(d.currentPacketId).get();
                        if (pDoc.exists) {
                            const pkt = pDoc.data();
                            packetImageUrl = pkt.priorityMockupUrl || pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                            if (price === null && pkt.pricing?.customerPrice)
                                price = pkt.pricing.customerPrice;
                        }
                    }
                    catch (_) { }
                }
                const toImgUrlSt = (img) => typeof img === 'string' ? img : (img?.url || null);
                const providerImgsSt = (resolved.images || []).map(toImgUrlSt).filter(Boolean);
                const allImagesSt = [];
                providerImgsSt.forEach((u) => { if (!allImagesSt.includes(u))
                    allImagesSt.push(u); });
                if (packetImageUrl && !allImagesSt.includes(packetImageUrl))
                    allImagesSt.push(packetImageUrl);
                const l3Colors = toStrArr2(d.enabledColors || resolved.colors || []);
                const l3Sizes = toStrArr2(d.enabledSizes || resolved.sizes || []);
                return {
                    id: doc.id,
                    name: resolved.title || 'Untitled',
                    imageUrl: allImagesSt[0] || null,
                    images: allImagesSt,
                    packetImageUrl,
                    segment: d.collectionName || null,
                    isFeatured: false,
                    isSeasonalPromo: false,
                    templateVariant: null,
                    qrProductType: 'qr-basics',
                    qrCodeUrl: null,
                    selectedColors: l3Colors,
                    availableSizes: l3Sizes,
                    defaultColor: null,
                    mockupsByColor: null,
                    price: price !== null ? Math.round(price * 100) / 100 : null,
                    createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    options: (0, storefrontTypes_1.buildStructuredOptions)(l3Colors, l3Sizes),
                    cardMode: (0, storefrontTypes_1.deriveCardMode)(l3Colors, l3Sizes),
                    media: { images: allImagesSt, mockupPriority: true, heroStrategy: 'catalogFirst' },
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
// build-marker: catalogFirst-gallery-fix
//# sourceMappingURL=store-files.js.map