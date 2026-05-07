"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const constants_1 = require("../constants");
const middleware_1 = require("../middleware");
const mockup_generator_1 = require("../services/mockup-generator");
function register(app) {
    // ============ PRODUCTS PAGE: QUEUE/PROCESS ============
    app.post('/admin/queue/retry-failed', middleware_1.requireAdmin, async (req, res) => {
        try {
            const failedSnapshot = await core_1.db.collection("mockup_jobs").where("status", "==", "failed").get();
            if (failedSnapshot.empty) {
                res.json({ success: true, reset: 0, message: "No failed jobs to retry" });
                return;
            }
            let resetCount = 0;
            const batch = core_1.db.batch();
            for (const doc of failedSnapshot.docs) {
                batch.update(doc.ref, {
                    status: "pending",
                    error: null,
                    retryCount: core_1.admin.firestore.FieldValue.increment(1),
                    lastRetryAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                });
                resetCount++;
            }
            await batch.commit();
            console.log(`[Queue CF] Reset ${resetCount} failed jobs to pending`);
            res.json({ success: true, reset: resetCount, message: `Reset ${resetCount} failed jobs to pending` });
        }
        catch (error) {
            console.error("[Queue CF] Error retrying failed:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/queue/process', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { limit = 5 } = req.body;
            const processLimit = Math.min(limit, 20);
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            const processingSnapshot = await core_1.db.collection("mockup_jobs").where("status", "==", "processing").limit(50).get();
            let recoveredCount = 0;
            for (const doc of processingSnapshot.docs) {
                const data = doc.data();
                const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
                if (startedAt < fiveMinutesAgo) {
                    await core_1.db.collection("mockup_jobs").doc(doc.id).update({
                        status: "pending", retryCount: core_1.admin.firestore.FieldValue.increment(1),
                        lastRetryAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                    });
                    recoveredCount++;
                }
            }
            const pendingSnapshot = await core_1.db.collection("mockup_jobs").where("status", "==", "pending").limit(processLimit).get();
            if (pendingSnapshot.empty) {
                res.json({ success: true, processed: 0, recovered: recoveredCount, message: "No pending jobs in queue" });
                return;
            }
            console.log(`[Queue CF] Processing ${pendingSnapshot.size} mockup jobs`);
            const results = [];
            for (const jobDoc of pendingSnapshot.docs) {
                const job = jobDoc.data();
                const jobId = jobDoc.id;
                try {
                    const claimed = await core_1.db.runTransaction(async (transaction) => {
                        const jobRef = core_1.db.collection("mockup_jobs").doc(jobId);
                        const freshDoc = await transaction.get(jobRef);
                        if (!freshDoc.exists || freshDoc.data()?.status !== "pending")
                            return false;
                        transaction.update(jobRef, { status: "processing", startedAt: core_1.admin.firestore.FieldValue.serverTimestamp(), processorId: `cf-${Date.now()}` });
                        return true;
                    });
                    if (!claimed) {
                        console.log(`[Queue CF] Job ${jobId} already claimed`);
                        continue;
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const templateDoc = await core_1.db.collection("productTemplates").doc(job.templateId).get();
                    if (!templateDoc.exists)
                        throw new Error(`Template ${job.templateId} not found`);
                    const template = templateDoc.data();
                    const mockupResult = await (0, mockup_generator_1.generateMockupFromPrintful)({
                        blueprintId: template.blueprintId || 5,
                        printProviderId: template.printProviderId || 39,
                        colorName: job.colorName,
                        artworkUrl: template.artworkUrl,
                        artworkVariant: template.artworkVariant || "black",
                        fulfillmentProvider: template.fulfillmentProvider || job.fulfillmentProvider || "printify",
                        hasCompositeGraphic: true,
                    });
                    if (mockupResult.error)
                        throw new Error(mockupResult.error);
                    const colorKey = job.colorName.replace(/\s+/g, "_").toLowerCase();
                    const placementKey = job.placement || "front";
                    const sizeKey = job.qrSize || "large";
                    const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
                    await core_1.db.collection("productTemplates").doc(job.templateId).update({
                        [mockupPath]: mockupResult.mockupUrl || null,
                        [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleUrl || null,
                        updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                    });
                    await core_1.db.collection("mockup_jobs").doc(jobId).update({
                        status: "completed", mockupUrl: mockupResult.mockupUrl || null,
                        lifestyleUrl: mockupResult.lifestyleUrl || null,
                        completedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                    });
                    results.push({ jobId, status: "completed" });
                    console.log(`[Queue CF] Job ${jobId} completed`);
                }
                catch (error) {
                    console.error(`[Queue CF] Job ${jobId} failed:`, error.message);
                    await core_1.db.collection("mockup_jobs").doc(jobId).update({
                        status: "failed", error: error.message, failedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                    });
                    results.push({ jobId, status: "failed", error: error.message });
                }
            }
            const completed = results.filter(r => r.status === "completed").length;
            const failed = results.filter(r => r.status === "failed").length;
            res.json({ success: true, processed: results.length, completed, failed, recovered: recoveredCount, results, message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed` });
        }
        catch (error) {
            console.error("[Queue CF] Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRODUCTS PAGE: MOCKUP PRIORITY ============
    app.post('/admin/mockup/priority', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
            if (!blueprintId || !colorName || !artworkUrl) {
                res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" });
                return;
            }
            console.log(`[Priority Mockup CF] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
            const result = await (0, mockup_generator_1.generateMockupFromPrintful)({
                blueprintId: parseInt(blueprintId),
                printProviderId: printProviderId ? parseInt(printProviderId) : 0,
                colorName,
                colorHex,
                artworkUrl,
                artworkVariant: "black",
                fulfillmentProvider: fulfillmentProvider,
                hasCompositeGraphic: true,
            });
            console.log(`[Priority Mockup CF] Generated: ${result.mockupUrl}`);
            res.json({
                success: true, mockupUrl: result.mockupUrl,
                lifestyleMockupUrl: result.lifestyleUrl || null,
                fromCache: false, generatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error("[Priority Mockup CF] Error:", error);
            res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
        }
    });
    // ============ PRODUCTS PAGE: CONTENT UPLOAD ============
    app.post('/admin/content/upload', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;
            if (!mode || !userId || !packetId || !base64Data) {
                res.status(400).json({ error: "mode, userId, packetId, and base64Data are required" });
                return;
            }
            const validModes = ['canvas', 'play', 'dynamics', 'basics', 'compose'];
            if (!validModes.includes(mode)) {
                res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
                return;
            }
            const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            const actualMimeType = base64Match?.[1] || mimeType || 'image/png';
            const actualBase64 = base64Match?.[2] || base64Data;
            if (!actualBase64 || actualBase64.length === 0) {
                res.status(400).json({ error: 'No file data received' });
                return;
            }
            const buffer = Buffer.from(actualBase64, 'base64');
            if (buffer.length === 0) {
                res.status(400).json({ error: 'File data is empty after decoding' });
                return;
            }
            const ext = actualMimeType.includes('png') ? 'png' : actualMimeType.includes('mp4') ? 'mp4' : actualMimeType.includes('webm') ? 'webm' : 'jpg';
            const storagePath = `content/${mode}/${userId}/${packetId}/${Date.now()}.${ext}`;
            const bucket = core_1.admin.storage().bucket();
            const file = bucket.file(storagePath);
            await file.save(buffer, { metadata: { contentType: actualMimeType } });
            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
            const updateData = { updatedAt: new Date() };
            if (mode === 'canvas' || mode === 'basics' || mode === 'compose') {
                updateData.compositeUrl = publicUrl;
            }
            else if (mode === 'play') {
                updateData.playMediaUrl = publicUrl;
                updateData.playMediaType = actualMimeType;
            }
            else if (mode === 'dynamics') {
                updateData.dynamicsMediaUrl = publicUrl;
                updateData.dynamicsMediaType = actualMimeType;
            }
            await core_1.db.collection(constants_1.PRODUCT_PACKETS_COLLECTION).doc(packetId).update(updateData);
            console.log(`[Content Upload CF] Uploaded ${mode} content for packet ${packetId}`);
            res.json({ success: true, publicUrl, storagePath, mimeType: actualMimeType, message: `${mode} content uploaded successfully` });
        }
        catch (error) {
            console.error("[Content Upload CF] Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRODUCTS PAGE: COMPOSE (QR DYNAMICS) ============
    app.get('/admin/published-compose-items', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('packets').where('status', '==', 'published').get();
            const items = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((p) => ['qr-canvas', 'qr-play'].includes(p.packetType || p.type));
            res.json({ items });
        }
        catch (error) {
            console.error("[ComposeItems CF] Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/compose/publish', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { composeItems, composeMode, composeHostingTerm, productId, blueprintId, color, colorHex } = req.body;
            if (!composeItems || !Array.isArray(composeItems) || composeItems.length === 0) {
                res.status(400).json({ error: 'At least one compose item is required' });
                return;
            }
            const nowEpoch = Math.floor(Date.now() / 1000);
            const instanceData = {
                createdAt: nowEpoch, startTimestamp: nowEpoch,
                mode: composeMode || 'auto-rotate', hostingTerm: composeHostingTerm || '1-year',
                productId: productId || null, blueprintId: blueprintId || null,
                color: color || null, colorHex: colorHex || null,
                slots: composeItems.map((item, index) => ({
                    slotId: item.slotId || `slot-${Date.now()}-${index}`,
                    packetId: item.packetId || item.id,
                    durationSeconds: item.durationSeconds || 86400,
                    order: item.order ?? index + 1,
                })),
            };
            const docRef = await core_1.db.collection(constants_1.QR_DYNAMICS_INSTANCES_COLLECTION).add(instanceData);
            console.log(`[ComposePublish CF] Created instance ${docRef.id} with ${composeItems.length} slots`);
            res.json({ success: true, instanceId: docRef.id, composeInstanceId: docRef.id });
        }
        catch (error) {
            console.error("[ComposePublish CF] Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRODUCTS PAGE: SHELF GROUPS & BUILD SHELF ============
    app.get('/admin/shelf-groups', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection("admin_shelf_groups").orderBy("sortOrder", "asc").get();
            const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(groups);
        }
        catch (error) {
            console.error("[BuildShelf CF] List groups error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/shelf-groups', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, sortOrder = 0 } = req.body;
            if (!name || typeof name !== 'string' || name.length === 0) {
                res.status(400).json({ error: "name is required" });
                return;
            }
            const existing = await core_1.db.collection("admin_shelf_groups").where("name", "==", name).get();
            if (!existing.empty) {
                res.status(409).json({ error: "A group with that name already exists" });
                return;
            }
            const docRef = await core_1.db.collection("admin_shelf_groups").add({
                name, sortOrder, createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json({ id: docRef.id, ...doc.data() });
        }
        catch (error) {
            console.error("[BuildShelf CF] Create group error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/shelf-groups/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, sortOrder } = req.body;
            const updates = {};
            if (name !== undefined) {
                const existing = await core_1.db.collection("admin_shelf_groups").where("name", "==", name).get();
                if (!existing.empty && existing.docs[0].id !== req.params.id) {
                    res.status(409).json({ error: "A group with that name already exists" });
                    return;
                }
                updates.name = name;
            }
            if (sortOrder !== undefined)
                updates.sortOrder = sortOrder;
            updates.updatedAt = core_1.admin.firestore.FieldValue.serverTimestamp();
            await core_1.db.collection("admin_shelf_groups").doc(req.params.id).update(updates);
            const doc = await core_1.db.collection("admin_shelf_groups").doc(req.params.id).get();
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            console.error("[BuildShelf CF] Update group error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/shelf-groups/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection("admin_shelf_groups").doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error("[BuildShelf CF] Delete group error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/build-shelf', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { provider, groupId, catalogId, mode } = req.query;
            let items;
            if (catalogId) {
                const snapshot = await core_1.db.collection("admin_build_shelf").where("catalogId", "==", catalogId).orderBy("createdAt", "desc").get();
                items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Synthesize shelf items for any blankIds in the catalog that have no
                // corresponding admin_build_shelf entry. This bridges the gap when blanks
                // are added via BlankPickerModal (which only writes catalogs.blankIds) vs
                // the old shelf flow (which writes admin_build_shelf rows).
                try {
                    const catalogDoc = await core_1.db.collection("catalogs").doc(String(catalogId)).get();
                    if (catalogDoc.exists) {
                        const catalogData = catalogDoc.data();
                        const blankIds = catalogData?.blankIds || [];
                        const coveredKeys = new Set(items.map((i) => i.shelfKey).filter(Boolean));
                        const uncoveredIds = blankIds.filter((id) => !coveredKeys.has(id));
                        if (uncoveredIds.length > 0) {
                            const CHUNK = 30;
                            for (let i = 0; i < uncoveredIds.length; i += CHUNK) {
                                const chunk = uncoveredIds.slice(i, i + CHUNK);
                                const docs = await Promise.all(chunk.map((key) => core_1.db.collection("master_catalog").doc(key).get()));
                                for (const doc of docs) {
                                    if (!doc.exists)
                                        continue;
                                    const m = doc.data();
                                    const providerId = m.printfulProductId ? "printful" : "printify";
                                    const numericId = m.printifyBlueprintId ?? m.printfulProductId ?? 0;
                                    const synthetic = {
                                        id: `synthetic:${doc.id}`,
                                        shelfKey: doc.id,
                                        catalogId: String(catalogId),
                                        groupIds: [],
                                        providerId,
                                        catalog: {
                                            docId: doc.id,
                                            id: numericId,
                                            title: m.canonicalTitle || m.title || "",
                                            description: m.canonicalDescription || m.description || null,
                                            brand: m.brand || null,
                                            imageUrl: m.images?.[0] || m.imageUrl || null,
                                            images: m.images || [],
                                            madeInUSA: m.madeInUSA ?? false,
                                            minPrice: m.minPrice || null,
                                            maxPrice: m.maxPrice || null,
                                            colorCount: m.colorCount ?? null,
                                            availableColors: m.availableColors || [],
                                            availableSizes: m.availableSizes || [],
                                            fulfillmentProvider: providerId,
                                            qrgCategory: m.qrgCategory || null,
                                            printifyImages: m.printifyImages || [],
                                            printfulImages: m.printfulImages || [],
                                        },
                                    };
                                    items = [...items, synthetic];
                                }
                            }
                        }
                    }
                }
                catch (synthErr) {
                    console.warn("[BuildShelf CF] Synthetic item synthesis failed (non-fatal):", synthErr.message);
                }
            }
            else if (groupId) {
                const snapshot = await core_1.db.collection("admin_build_shelf").where("groupIds", "array-contains", groupId).orderBy("createdAt", "desc").get();
                items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            else if (mode === "global") {
                const snapshot = await core_1.db.collection("admin_build_shelf").orderBy("createdAt", "desc").get();
                items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            else {
                res.status(400).json({ error: "catalogId is required. Pass ?mode=global to list all shelf items." });
                return;
            }
            if (provider) {
                items = items.filter((item) => item.providerId === provider);
            }
            // Augment each shelf item's catalog with images[] and qrgCategory from master_catalog.
            const shelfKeys = [...new Set(items.map((i) => i.shelfKey).filter(Boolean))];
            if (shelfKeys.length > 0) {
                const CHUNK = 30;
                const masterMap = new Map();
                for (let i = 0; i < shelfKeys.length; i += CHUNK) {
                    const chunk = shelfKeys.slice(i, i + CHUNK);
                    const docs = await Promise.all(chunk.map((key) => core_1.db.collection("master_catalog").doc(key).get()));
                    for (const doc of docs) {
                        if (doc.exists)
                            masterMap.set(doc.id, doc.data());
                    }
                }
                items = items.map((item) => {
                    const master = masterMap.get(item.shelfKey);
                    const masterImages = master?.images || [];
                    const qrgCategory = master?.qrgCategory || null;
                    if (!masterImages.length && !qrgCategory)
                        return item;
                    const catalogPatch = {};
                    if (masterImages.length)
                        catalogPatch.images = masterImages;
                    if (qrgCategory)
                        catalogPatch.qrgCategory = qrgCategory;
                    return { ...item, catalog: { ...item.catalog, ...catalogPatch } };
                });
            }
            res.json(items);
        }
        catch (error) {
            console.error("[BuildShelf CF] List items error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/build-shelf', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { providerId, catalogId, catalog, groupIds = [] } = req.body;
            if (!providerId || !catalogId || !catalog) {
                res.status(400).json({ error: "providerId, catalogId, and catalog are required" });
                return;
            }
            const key = `${providerId}:${catalogId}`;
            const existing = await core_1.db.collection("admin_build_shelf").where("shelfKey", "==", key).get();
            if (!existing.empty) {
                await existing.docs[0].ref.update({ catalog, groupIds, updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp() });
                const updated = await existing.docs[0].ref.get();
                res.json({ id: updated.id, ...updated.data() });
                return;
            }
            const docRef = await core_1.db.collection("admin_build_shelf").add({
                shelfKey: key, providerId, catalogId, catalog, groupIds,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json({ id: docRef.id, ...doc.data() });
        }
        catch (error) {
            console.error("[BuildShelf CF] Add item error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/build-shelf/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const updates = {};
            if (req.body.groupIds !== undefined)
                updates.groupIds = req.body.groupIds;
            if (req.body.catalog !== undefined)
                updates.catalog = req.body.catalog;
            updates.updatedAt = core_1.admin.firestore.FieldValue.serverTimestamp();
            await core_1.db.collection("admin_build_shelf").doc(req.params.id).update(updates);
            const doc = await core_1.db.collection("admin_build_shelf").doc(req.params.id).get();
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (error) {
            console.error("[BuildShelf CF] Update item error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/build-shelf/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection("admin_build_shelf").doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error("[BuildShelf CF] Delete item error:", error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRODUCTS PAGE: PRICING SETTINGS SYNC ============
    app.post('/admin/pricing-settings/sync', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const pricingDoc = await core_1.db.collection("testSettings").doc("pricing").get();
            const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
            const markupPercent = pricingSettings?.markupPercent ?? 25;
            const markupFixed = pricingSettings?.markupFixed ?? 0;
            const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
            const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
            console.log(`[Pricing Sync CF] Settings: markup=${markupPercent}%, fixed=${markupFixed}, memberShare=${memberProfitShare}`);
            res.json({
                success: true,
                message: "Pricing sync completed",
                settings: { markupPercent, markupFixed, memberProfitShare, additionalPlacementCost },
            });
        }
        catch (error) {
            console.error("[Pricing Sync CF] Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=pp-builder.js.map