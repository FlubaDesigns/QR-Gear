"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const stripe_1 = __importDefault(require("stripe"));
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ QR DYNAMICS & RESOLVE ROUTES (Batch 4) ============
    app.get('/resolve/:instanceId', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const instanceDoc = await core_1.db.collection('buyer_instances').doc(instanceId).get();
            if (!instanceDoc.exists) {
                res.status(404).json({ error: "Instance not found", redirect: "/not-found" });
                return;
            }
            const instance = instanceDoc.data();
            const isActive = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) > new Date() : true;
            if (!isActive) {
                res.json({ expired: true, redirect: `/renew/${instanceId}`, message: "Your QR hosting has expired. Please renew to continue." });
                return;
            }
            res.json({ expired: false, destinationUrl: instance.destinationUrl, packetId: instance.packetId, instanceId: instance.instanceId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/buyer/instances', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid;
            const snapshot = await core_1.db.collection('buyer_instances').where('buyerUserId', '==', userId).get();
            const instances = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json({ instances });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/buyer/instances/:instanceId', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const doc = await core_1.db.collection('buyer_instances').doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Instance not found" });
                return;
            }
            const instance = doc.data();
            const isActive = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) > new Date() : true;
            res.json({ instance: { id: doc.id, ...instance }, isActive });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/buyer/instances/:instanceId', middleware_1.requireAuth, async (req, res) => {
        try {
            const { instanceId } = req.params;
            const { destinationUrl } = req.body;
            const userId = req.user?.uid;
            const doc = await core_1.db.collection('buyer_instances').doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Instance not found" });
                return;
            }
            if (doc.data()?.buyerUserId !== userId) {
                res.status(403).json({ error: "Not authorized" });
                return;
            }
            await core_1.db.collection('buyer_instances').doc(instanceId).update({ destinationUrl, updatedAt: new Date().toISOString() });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/buyer/instances/:instanceId/renew', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const doc = await core_1.db.collection('buyer_instances').doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Instance not found" });
                return;
            }
            const instance = doc.data();
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(503).json({ error: "Payment not configured" });
                return;
            }
            const stripe = new stripe_1.default(stripeKey, { apiVersion: '2023-10-16' });
            const baseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
            const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], line_items: [{ price_data: { currency: 'usd', product_data: { name: 'QR Hosting Renewal - 3 Years', description: 'Extend your QR hosting for another 3 years' }, unit_amount: 499 }, quantity: 1 }], mode: 'payment', success_url: `${baseUrl}/renew/${instanceId}/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/renew/${instanceId}`, metadata: { instanceId, type: 'hosting_renewal' }, customer_email: instance.buyerEmail });
            res.json({ url: session.url, sessionId: session.id });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/buyer/instances/:instanceId/verify-renewal', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const { sessionId } = req.body;
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(503).json({ error: "Payment not configured" });
                return;
            }
            const stripe = new stripe_1.default(stripeKey, { apiVersion: '2023-10-16' });
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status !== 'paid') {
                res.status(400).json({ error: "Payment not completed" });
                return;
            }
            if (session.metadata?.instanceId !== instanceId) {
                res.status(400).json({ error: "Session does not match instance" });
                return;
            }
            const doc = await core_1.db.collection('buyer_instances').doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Instance not found" });
                return;
            }
            const instance = doc.data();
            const currentExpiry = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) : new Date();
            const base = currentExpiry > new Date() ? currentExpiry : new Date();
            const newExpiry = new Date(base.getTime() + 3 * 365 * 24 * 60 * 60 * 1000);
            await core_1.db.collection('buyer_instances').doc(instanceId).update({ hostingExpiresAt: newExpiry.toISOString(), renewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ success: true, instance: { ...instance, hostingExpiresAt: newExpiry.toISOString() }, newExpirationDate: newExpiry.toISOString() });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/dynamics/surfaces', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, storeId, channelId, collectionName, rotationInterval, timezone, isEnabled } = req.body;
            if (!storeId || !channelId || !collectionName) {
                res.status(400).json({ error: "storeId, channelId, and collectionName are required" });
                return;
            }
            const surfaceData = { name: name || `Dynamics - ${collectionName}`, storeId, channelId, collectionName, rotationInterval: rotationInterval || "daily", timezone: timezone || "America/New_York", isEnabled: isEnabled !== false, createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(), updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp() };
            const surfaceRef = await core_1.db.collection("qrDynamicsSurfaces").add(surfaceData);
            res.json({ success: true, surfaceId: surfaceRef.id, message: `Dynamics surface created for ${collectionName}` });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/dynamics/surfaces', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection("qrDynamicsSurfaces").orderBy("createdAt", "desc").limit(100).get();
            const surfaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null, updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null }));
            res.json({ success: true, surfaces, count: surfaces.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/public/dynamics/resolve/:surfaceId', async (req, res) => {
        try {
            const { surfaceId } = req.params;
            const surfaceDoc = await core_1.db.collection("qrDynamicsSurfaces").doc(surfaceId).get();
            if (!surfaceDoc.exists) {
                res.status(404).json({ error: "Surface not found" });
                return;
            }
            const surface = surfaceDoc.data();
            if (!surface.isEnabled) {
                res.json({ success: true, surfaceId, isEnabled: false, activeItem: null, message: "Surface is disabled" });
                return;
            }
            const { storeId, channelId, collectionName, rotationInterval, timezone } = surface;
            const linksSnapshot = await core_1.db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).orderBy("createdAt", "asc").get();
            if (linksSnapshot.empty) {
                res.json({ success: true, surfaceId, isEnabled: true, activeItem: null, message: "No items in collection" });
                return;
            }
            const items = linksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const now = new Date();
            const tz = timezone || "America/New_York";
            const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false });
            const parts = fmt.formatToParts(now);
            const get = (type) => parts.find(p => p.type === type)?.value ?? "";
            const year = Number(get("year"));
            const month = Number(get("month"));
            const day = Number(get("day"));
            let indexKey;
            if (rotationInterval === "daily")
                indexKey = year * 10000 + month * 100 + day;
            else if (rotationInterval === "weekly") {
                const startOfYear = new Date(year, 0, 1);
                indexKey = year * 100 + Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) / 7);
            }
            else
                indexKey = year * 100 + month;
            const activeIndex = indexKey % items.length;
            const activeItem = items[activeIndex];
            res.json({ success: true, serverNowIso: now.toISOString(), surfaceId, isEnabled: true, rotationInterval, timezone: tz, totalItems: items.length, activeIndex, activeItem: { id: activeItem.id, packetId: activeItem.packetId, name: activeItem.productName || "Untitled", imageUrl: activeItem.compositeUrl || activeItem.qrOnlyUrl, mockupUrl: activeItem.mockupUrl, landingPageUrl: activeItem.landingPageUrl, qrProductState: activeItem.qrProductState }, nextSwitch: rotationInterval === "daily" ? "Midnight (local time)" : rotationInterval === "weekly" ? "Sunday midnight" : "1st of next month" });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/stores/:storeId/channels/:channelId/content', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const contentSnapshot = await core_1.db.collection("dynamicsChannelContent").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
            const explicitContent = contentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const channelIdLower = channelId.toLowerCase();
            let packetsSnapshot = await core_1.db.collection("productPackets").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
            if (packetsSnapshot.empty && channelId !== channelIdLower)
                packetsSnapshot = await core_1.db.collection("productPackets").where("storeId", "==", storeId).where("channelId", "==", channelIdLower).get();
            const packetContent = packetsSnapshot.docs.map(doc => { const data = doc.data(); if (data.landingPageSnapshotUrl) {
                return { id: `packet-${doc.id}`, storeId, channelId, name: data.productName || data.landingPageTitle || 'Landing Page', contentType: 'image', url: data.landingPageSnapshotUrl, thumbnailUrl: data.landingPageSnapshotUrl, sourceType: 'packet', packetId: doc.id, landingPageSlug: data.landingPageSlug };
            } return null; }).filter(Boolean);
            const content = [...explicitContent, ...packetContent];
            res.json({ success: true, content, count: content.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/stores/:storeId/channels/:channelId/content', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const { name, contentType, url, thumbnailUrl, metadata } = req.body;
            if (!name || !contentType || !url) {
                res.status(400).json({ error: "name, contentType, and url are required" });
                return;
            }
            const docRef = await core_1.db.collection("dynamicsChannelContent").add({ storeId, channelId, name, contentType, url, thumbnailUrl: thumbnailUrl || url, metadata: metadata || {}, createdAt: new Date(), updatedAt: new Date() });
            res.json({ success: true, contentId: docRef.id, name });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/stores/:storeId/channels/:channelId/content/:contentId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { contentId } = req.params;
            await core_1.db.collection("dynamicsChannelContent").doc(contentId).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/collections/:collectionId/items', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { collectionId } = req.params;
            const { contentId, contentType, name, url, thumbnailUrl, rotationInterval } = req.body;
            if (!collectionId || !contentId || !contentType || !name || !url) {
                res.status(400).json({ error: "Missing required fields" });
                return;
            }
            const existingItems = await core_1.db.collection("dynamicsCollectionItems").where("collectionId", "==", collectionId).orderBy("order", "desc").limit(1).get();
            const maxOrder = existingItems.empty ? 0 : (existingItems.docs[0].data().order || 0);
            const docRef = await core_1.db.collection("dynamicsCollectionItems").add({ collectionId, contentId, contentType, name, url, thumbnailUrl: thumbnailUrl || url, order: maxOrder + 1, rotationInterval: rotationInterval || 'daily', addedAt: new Date() });
            res.json({ success: true, itemId: docRef.id, order: maxOrder + 1 });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/collections/:collectionId/items', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { collectionId } = req.params;
            const itemsSnapshot = await core_1.db.collection("dynamicsCollectionItems").where("collectionId", "==", collectionId).orderBy("order", "asc").get();
            const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json({ success: true, items, count: items.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/collections/:collectionId/items/:itemId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { itemId } = req.params;
            const { order, rotationInterval } = req.body;
            const updateData = { updatedAt: new Date() };
            if (order !== undefined)
                updateData.order = order;
            if (rotationInterval)
                updateData.rotationInterval = rotationInterval;
            await core_1.db.collection("dynamicsCollectionItems").doc(itemId).update(updateData);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/collections/:collectionId/items/:itemId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { itemId } = req.params;
            await core_1.db.collection("dynamicsCollectionItems").doc(itemId).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/collections/:collectionId/items/reorder', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { itemOrders } = req.body;
            if (!itemOrders || !Array.isArray(itemOrders)) {
                res.status(400).json({ error: "itemOrders array is required" });
                return;
            }
            const batch = core_1.db.batch();
            for (const { itemId, order } of itemOrders) {
                batch.update(core_1.db.collection("dynamicsCollectionItems").doc(itemId), { order, updatedAt: new Date() });
            }
            await batch.commit();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/stores/:storeId/channels/:channelId/collections', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const linksSnapshot = await core_1.db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).get();
            const collectionsSet = new Set();
            linksSnapshot.docs.forEach(doc => { const c = doc.data().collection; if (c)
                collectionsSet.add(c); });
            const explicitSnapshot = await core_1.db.collection("dynamicsCollections").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
            explicitSnapshot.docs.forEach(doc => { const n = doc.data().name; if (n)
                collectionsSet.add(n); });
            const collections = Array.from(collectionsSet).sort();
            res.json({ success: true, collections, count: collections.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/stores/:storeId/channels/:channelId/collections', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const { name } = req.body;
            if (!name) {
                res.status(400).json({ error: "name is required" });
                return;
            }
            const docRef = await core_1.db.collection("dynamicsCollections").add({ storeId, channelId, name, createdAt: new Date(), updatedAt: new Date() });
            res.json({ success: true, collectionId: docRef.id, name });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/stores/:storeId/channels/:channelId/collections/:collectionName/items', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId, collectionName } = req.params;
            const linksSnapshot = await core_1.db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).get();
            const items = linksSnapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, linkId: doc.id, packetId: data.packetId || null, name: data.productName || "Untitled Product", imageUrl: data.compositeUrl || data.qrOnlyUrl || null, mockupUrl: data.mockupUrl || null, qrProductState: data.qrProductState || null, landingPageUrl: data.landingPageUrl || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null }; });
            res.json({ success: true, items, collection: collectionName, count: items.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/dynamics/packets', async (req, res) => {
        try {
            const storeId = req.query.storeId;
            const channelId = req.query.channelId;
            if (!storeId) {
                res.status(400).json({ error: "storeId is required" });
                return;
            }
            const packetsSnapshot = await core_1.db.collection("productPackets").where("storeId", "==", storeId).get();
            let docs = packetsSnapshot.docs;
            if (channelId) {
                const channelIdLower = channelId.toLowerCase();
                docs = docs.filter(doc => { const d = doc.data(); return d.channelId === channelId || d.channelId === channelIdLower; });
            }
            const packets = docs.map(doc => { const data = doc.data(); if (!data.landingPageSnapshotUrl)
                return null; let qrType = 'qr-canvas'; if ((data.landingPageSnapshotUrl || '').includes('/play/'))
                qrType = 'qr-play'; return { id: doc.id, packetId: doc.id, name: data.productName || data.landingPageTitle || 'Untitled', qrProductType: qrType, thumbnailUrl: data.landingPageSnapshotUrl, landingPageSlug: data.landingPageSlug, landingPageUrl: data.landingPageSlug ? `/p/${data.landingPageSlug}` : null, storeId: data.storeId, channelId: data.channelId }; }).filter(Boolean);
            res.json({ success: true, packets, count: packets.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/dynamics/instances', async (req, res) => {
        try {
            const { orderId, collectionId, slots, fallbackUrl } = req.body;
            if (!slots || !Array.isArray(slots) || slots.length === 0) {
                res.status(400).json({ error: "slots array is required" });
                return;
            }
            const nowEpoch = Math.floor(Date.now() / 1000);
            const instanceData = { orderId: orderId || null, collectionId: collectionId || null, createdAt: nowEpoch, startTimestamp: nowEpoch, mode: 'loop', fallbackUrl: fallbackUrl || null, slots: slots.map((slot, index) => ({ slotId: slot.slotId || `slot-${Date.now()}-${index}`, packetId: slot.packetId, durationSeconds: slot.durationSeconds || 86400, order: slot.order ?? index + 1 })) };
            const docRef = await core_1.db.collection("qr_dynamics_instances").add(instanceData);
            res.json({ success: true, instanceId: docRef.id, resolverUrl: `/qr/d/${docRef.id}` });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/dynamics/instances/:instanceId', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const doc = await core_1.db.collection("qr_dynamics_instances").doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Instance not found" });
                return;
            }
            res.json({ success: true, instance: { id: doc.id, ...doc.data() } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/dynamics/instances/:instanceId/preview', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const doc = await core_1.db.collection("qr_dynamics_instances").doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Instance not found" });
                return;
            }
            const instance = doc.data();
            const slots = instance.slots || [];
            if (slots.length === 0) {
                res.json({ success: true, activeSlot: null, message: "No slots configured" });
                return;
            }
            const sortedSlots = [...slots].sort((a, b) => a.order - b.order);
            const nowEpoch = Math.floor(Date.now() / 1000);
            const elapsed = nowEpoch - instance.startTimestamp;
            let cycleLength = 0;
            for (const slot of sortedSlots)
                cycleLength += slot.durationSeconds;
            if (cycleLength <= 0) {
                res.status(500).json({ error: "Invalid cycle length" });
                return;
            }
            const position = elapsed % cycleLength;
            let running = 0;
            let activeSlot = null;
            let activeIndex = 0;
            for (let i = 0; i < sortedSlots.length; i++) {
                running += sortedSlots[i].durationSeconds;
                if (position < running) {
                    activeSlot = sortedSlots[i];
                    activeIndex = i;
                    break;
                }
            }
            let packetDetails = null;
            if (activeSlot) {
                const packetDoc = await core_1.db.collection("productPackets").doc(activeSlot.packetId).get();
                if (packetDoc.exists) {
                    const pd = packetDoc.data();
                    packetDetails = { name: pd.productName || pd.landingPageTitle || 'Untitled', thumbnailUrl: pd.landingPageSnapshotUrl, landingPageSlug: pd.landingPageSlug, qrProductType: pd.qrProductType };
                }
            }
            let timeRemainingSeconds = 0;
            if (activeSlot) {
                const slotStart = running - activeSlot.durationSeconds;
                timeRemainingSeconds = activeSlot.durationSeconds - (position - slotStart);
            }
            res.json({ success: true, nowEpoch, elapsed, cycleLength, position, activeIndex, totalSlots: sortedSlots.length, activeSlot: activeSlot ? { ...activeSlot, packet: packetDetails } : null, timeRemainingSeconds, nextSlotIndex: (activeIndex + 1) % sortedSlots.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/dynamics/instances/:instanceId/slots', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const { slots } = req.body;
            if (!slots || !Array.isArray(slots)) {
                res.status(400).json({ error: "slots array is required" });
                return;
            }
            const nowEpoch = Math.floor(Date.now() / 1000);
            await core_1.db.collection("qr_dynamics_instances").doc(instanceId).update({ slots: slots.map((slot, index) => ({ slotId: slot.slotId || `slot-${Date.now()}-${index}`, packetId: slot.packetId, durationSeconds: slot.durationSeconds || 86400, order: slot.order ?? index + 1 })), startTimestamp: nowEpoch });
            res.json({ success: true, instanceId, newStartTimestamp: nowEpoch });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/qr/d/:instanceId', async (req, res) => {
        try {
            const { instanceId } = req.params;
            const doc = await core_1.db.collection("qr_dynamics_instances").doc(instanceId).get();
            if (!doc.exists) {
                res.status(404).send("QR Dynamics instance not found");
                return;
            }
            const instance = doc.data();
            const slots = instance.slots || [];
            if (slots.length === 0) {
                if (instance.fallbackUrl) {
                    res.redirect(302, instance.fallbackUrl);
                    return;
                }
                res.status(404).send("No content configured");
                return;
            }
            const sortedSlots = [...slots].sort((a, b) => a.order - b.order);
            if (instance.composeMode === 'scan-to-reveal') {
                const slotPacketIds = sortedSlots.map((s) => s.packetId);
                const packetSlugs = [];
                for (const pid of slotPacketIds) {
                    let pDoc = await core_1.db.collection("productPackets").doc(pid).get();
                    if (!pDoc.exists)
                        pDoc = await core_1.db.collection("memberPackets").doc(pid).get();
                    const pData = pDoc.exists ? pDoc.data() : null;
                    packetSlugs.push(pData?.landingPageSlug || '');
                }
                const validSlugs = packetSlugs.filter(s => s !== '');
                if (validSlugs.length === 0) {
                    if (instance.fallbackUrl) {
                        res.redirect(302, instance.fallbackUrl);
                        return;
                    }
                    res.status(404).send("No content configured");
                    return;
                }
                const slugsJson = JSON.stringify(validSlugs);
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading...</title></head><body><script>(function(){var k='qr_str_'+${JSON.stringify(instanceId)};var slugs=${slugsJson};var idx=parseInt(localStorage.getItem(k)||'0',10);if(isNaN(idx)||idx<0)idx=0;var current=idx%slugs.length;localStorage.setItem(k,String(idx+1));window.location.replace('/p/'+slugs[current]);})();</script><noscript><p>JavaScript is required.</p></noscript></body></html>`;
                res.status(200).type('html').send(html);
                return;
            }
            const nowEpoch = Math.floor(Date.now() / 1000);
            const elapsed = nowEpoch - instance.startTimestamp;
            let cycleLength = 0;
            for (const slot of sortedSlots)
                cycleLength += slot.durationSeconds;
            if (cycleLength <= 0) {
                if (instance.fallbackUrl) {
                    res.redirect(302, instance.fallbackUrl);
                    return;
                }
                res.status(500).send("Invalid config");
                return;
            }
            const position = elapsed % cycleLength;
            let running = 0;
            let activeSlot = null;
            for (const slot of sortedSlots) {
                running += slot.durationSeconds;
                if (position < running) {
                    activeSlot = slot;
                    break;
                }
            }
            if (!activeSlot) {
                if (instance.fallbackUrl) {
                    res.redirect(302, instance.fallbackUrl);
                    return;
                }
                res.status(500).send("Unable to resolve slot");
                return;
            }
            let packetDoc = await core_1.db.collection("productPackets").doc(activeSlot.packetId).get();
            if (!packetDoc.exists)
                packetDoc = await core_1.db.collection("memberPackets").doc(activeSlot.packetId).get();
            if (!packetDoc.exists) {
                if (instance.fallbackUrl) {
                    res.redirect(302, instance.fallbackUrl);
                    return;
                }
                res.status(404).send("Content not available");
                return;
            }
            const packetData = packetDoc.data();
            if (!packetData.landingPageSlug) {
                if (instance.fallbackUrl) {
                    res.redirect(302, instance.fallbackUrl);
                    return;
                }
                res.status(404).send("Landing page not configured");
                return;
            }
            res.redirect(302, `/p/${packetData.landingPageSlug}`);
        }
        catch (error) {
            res.status(500).send("QR Dynamics error");
        }
    });
    // ============ TEMP PACKETS & PUBLIC WIZARD (Batch 5) ============
    app.post('/public/packets', async (req, res) => {
        try {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const packetData = (0, core_1.stripUndef)({ status: 'building', ...req.body, createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
            if (packetData.headerStyle)
                packetData.headerStyle = (0, core_1.sanitizeStyleForFirestore)(packetData.headerStyle);
            if (packetData.footerStyle)
                packetData.footerStyle = (0, core_1.sanitizeStyleForFirestore)(packetData.footerStyle);
            const docRef = await core_1.db.collection('temp_packets').add(packetData);
            res.json({ success: true, tempPacketId: docRef.id, expiresAt: expiresAt.toISOString() });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    app.patch('/public/packets/:tempPacketId', async (req, res) => {
        try {
            const { tempPacketId } = req.params;
            const docRef = core_1.db.collection('temp_packets').doc(tempPacketId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ success: false, error: "Temp packet not found" });
                return;
            }
            if (doc.data()?.status === 'completed') {
                res.status(400).json({ success: false, error: "Packet already completed" });
                return;
            }
            const tempClean = (0, core_1.stripUndef)({ ...req.body, updatedAt: new Date().toISOString() });
            if (tempClean.headerStyle)
                tempClean.headerStyle = (0, core_1.sanitizeStyleForFirestore)(tempClean.headerStyle);
            if (tempClean.footerStyle)
                tempClean.footerStyle = (0, core_1.sanitizeStyleForFirestore)(tempClean.footerStyle);
            await docRef.update(tempClean);
            res.json({ success: true, tempPacketId });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    app.post('/public/packets/:tempPacketId/complete', async (req, res) => {
        try {
            const { tempPacketId } = req.params;
            const docRef = core_1.db.collection('temp_packets').doc(tempPacketId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ success: false, error: "Temp packet not found" });
                return;
            }
            await docRef.update({ status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ success: true, tempPacketId });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    app.delete('/public/packets/cleanup/expired', async (_req, res) => {
        try {
            const now = new Date().toISOString();
            const expiredQuery = await core_1.db.collection('temp_packets').where('status', '==', 'building').where('expiresAt', '<', now).limit(100).get();
            let deletedCount = 0;
            const batch = core_1.db.batch();
            expiredQuery.docs.forEach(doc => { batch.delete(doc.ref); deletedCount++; });
            if (deletedCount > 0)
                await batch.commit();
            res.json({ success: true, deletedCount });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    app.post('/public/checkout', async (req, res) => {
        try {
            const { tempPacketId } = req.body;
            if (!tempPacketId) {
                res.status(400).json({ error: "Missing tempPacketId" });
                return;
            }
            const packetDoc = await core_1.db.collection('temp_packets').doc(tempPacketId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: "Temp packet not found" });
                return;
            }
            const packet = packetDoc.data();
            if (packet.status === 'completed') {
                res.status(400).json({ error: "Already purchased" });
                return;
            }
            const pricingDoc = await core_1.db.collection("testSettings").doc("pricing").get();
            const ps = pricingDoc.exists ? pricingDoc.data() : null;
            const defaultSU = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
            const sizeUpcharges = ps?.sizeUpcharges || defaultSU;
            const additionalPlacementCost = ps?.additionalPlacementCost ?? 4;
            const textLineUpcharge = ps?.textLineUpcharge ?? 2;
            const basePrice = parseFloat(packet.retailPrice) || ps?.baseRetailPrice || 29.99;
            const selectedSize = packet.selectedShirtSize || packet.selectedSize || 'M';
            const sizeUpcharge = sizeUpcharges[selectedSize] || 0;
            const placements = packet.selectedPlacements || ['front'];
            const placementCost = Math.max(0, placements.length - 1) * additionalPlacementCost;
            const textLayout = packet.textLayoutChoice || '';
            let textCostLines = 0;
            if (textLayout === 'both')
                textCostLines = 2;
            else if (textLayout === 'header' || textLayout === 'footer')
                textCostLines = 1;
            const textCost = textCostLines * textLineUpcharge;
            const serverTotal = Math.round((basePrice + sizeUpcharge + placementCost + textCost) * 100) / 100;
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(503).json({ error: "Payment not configured" });
                return;
            }
            const stripe = new stripe_1.default(stripeKey, { apiVersion: '2023-10-16' });
            const productTitle = packet.productTitle || 'QR Gear Custom Product';
            const baseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
            const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], line_items: [{ price_data: { currency: 'usd', product_data: { name: productTitle, images: packet.mockupUrl ? [packet.mockupUrl.startsWith('http') ? packet.mockupUrl : `${baseUrl}${packet.mockupUrl}`] : [] }, unit_amount: Math.round(serverTotal * 100) }, quantity: 1 }], mode: 'payment', success_url: `${baseUrl}/build/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/build`, metadata: { tempPacketId, source: 'public_wizard', serverTotal: serverTotal.toString() }, customer_creation: 'if_required' });
            await packetDoc.ref.update({ stripeSessionId: session.id, serverCalculatedTotal: serverTotal, checkoutCreatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            res.json({ url: session.url, sessionId: session.id, total: serverTotal });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/public/checkout/verify/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(503).json({ error: "Payment not configured" });
                return;
            }
            const stripe = new stripe_1.default(stripeKey, { apiVersion: '2023-10-16' });
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status !== 'paid') {
                res.status(400).json({ error: "Payment not completed" });
                return;
            }
            const tempPacketId = session.metadata?.tempPacketId;
            if (!tempPacketId) {
                res.status(400).json({ error: "No packet linked" });
                return;
            }
            const existingOrderQuery = await core_1.db.collection('orders_public').where('stripeSessionId', '==', sessionId).limit(1).get();
            if (!existingOrderQuery.empty) {
                const existingOrder = existingOrderQuery.docs[0].data();
                res.json({ success: true, alreadyProcessed: true, order: { id: existingOrderQuery.docs[0].id, ...existingOrder } });
                return;
            }
            const packetDoc = await core_1.db.collection('temp_packets').doc(tempPacketId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: "Temp packet not found" });
                return;
            }
            const packet = packetDoc.data();
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let claimCode = '';
            for (let i = 0; i < 8; i++)
                claimCode += chars.charAt(Math.floor(Math.random() * chars.length));
            const buyerEmail = session.customer_details?.email || '';
            const buyerName = session.customer_details?.name || '';
            const now = new Date();
            const realPacketData = { ...packet, status: 'purchased', source: 'public_wizard', buyerEmail, buyerName, stripeSessionId: sessionId, stripePaymentIntentId: session.payment_intent, purchasedAt: now.toISOString(), createdAt: packet.createdAt || now.toISOString(), updatedAt: now.toISOString() };
            delete realPacketData.expiresAt;
            delete realPacketData.checkoutCreatedAt;
            delete realPacketData.serverCalculatedTotal;
            const realPacketRef = await core_1.db.collection('product_packets').add(realPacketData);
            const serverTotal = parseFloat(packet.serverCalculatedTotal || session.amount_total / 100);
            const orderData = { tempPacketId, realPacketId: realPacketRef.id, stripeSessionId: sessionId, stripePaymentIntentId: session.payment_intent, buyerEmail, buyerName, claimCode, productTitle: packet.productTitle || 'QR Gear Product', qrType: packet.qrType || 'qr-basic', selectedColor: packet.selectedColor || '', selectedSize: packet.selectedShirtSize || packet.selectedSize || 'M', totalAmount: serverTotal, mockupUrl: packet.mockupUrl || null, lifestyleMockupUrl: packet.lifestyleMockupUrl || null, status: 'paid', graphicRetainedUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() };
            const orderRef = await core_1.db.collection('orders_public').add(orderData);
            await packetDoc.ref.update({ status: 'completed', completedAt: now.toISOString(), realPacketId: realPacketRef.id, orderId: orderRef.id, updatedAt: now.toISOString() });
            res.json({ success: true, order: { id: orderRef.id, ...orderData }, realPacketId: realPacketRef.id, claimCode });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=dynamics.js.map