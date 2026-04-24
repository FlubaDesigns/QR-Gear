"use strict";
/**
 * Admin Build Sessions (Cloud Functions port)
 *
 * Temporary working records that prevent orphan admin_catalog_instances.
 * A session is created when admin starts editing a master product.
 * A real admin_catalog_instance is only created after artifact generation succeeds (commit).
 *
 * Flow:
 *   select master product
 *   → create/load admin_build_session (temp, safe to abandon)
 *   → edit working state (title, description, QR config, graphics, etc.)
 *   → generate artifact (packet/template/graphics)
 *   → commit → creates real admin_catalog_instance, binds artifacts, marks session committed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminBuildSessions = registerAdminBuildSessions;
const firestore_1 = require("firebase-admin/firestore");
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const BUILD_SESSIONS_COLLECTION = 'admin_build_sessions';
const ADMIN_INSTANCES_COLLECTION = 'admin_catalog_instances';
const MASTER_CATALOG_COLLECTION = 'master_catalog';
const PRODUCT_PACKETS_COLLECTION = 'productPackets';
const SESSION_EXPIRY_DAYS = 7;
function resolveFields(base, overrides) {
    const resolved = { ...base };
    for (const [key, val] of Object.entries(overrides)) {
        if (val !== null && val !== undefined && val !== '') {
            resolved[key] = val;
        }
    }
    return resolved;
}
function registerAdminBuildSessions(app) {
    // ── List build sessions for admin ─────────────────────────────────────────
    app.get('/admin/build-sessions', middleware_1.requireAdmin, async (req, res) => {
        try {
            const uid = req.user?.uid || '';
            // Single equality filter only — no orderBy — avoids any composite index requirement.
            // Firestore auto-indexes single-field equality; sorting and filtering happen in code.
            const snap = await core_1.db.collection(BUILD_SESSIONS_COLLECTION)
                .where('ownerAdminId', '==', uid)
                .limit(200)
                .get();
            let sessions = snap.docs.map((doc) => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    createdAt: d.createdAt?.toDate?.() || null,
                    updatedAt: d.updatedAt?.toDate?.() || null,
                    lastActiveAt: d.lastActiveAt?.toDate?.() || null,
                    expiresAt: d.expiresAt?.toDate?.() || null,
                };
            });
            // In-code filters and sort
            const statusFilter = req.query.status;
            const masterFilter = req.query.sourceMasterId;
            if (statusFilter)
                sessions = sessions.filter((s) => s.status === statusFilter);
            if (masterFilter)
                sessions = sessions.filter((s) => s.sourceMasterId === masterFilter);
            sessions.sort((a, b) => {
                const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return bTime - aTime;
            });
            sessions = sessions.slice(0, 50);
            res.json({ success: true, sessions, count: sessions.length });
        }
        catch (err) {
            console.error('[BuildSessions] list error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Get single build session ──────────────────────────────────────────────
    app.get('/admin/build-sessions/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Build session not found' });
                return;
            }
            const d = doc.data();
            res.json({
                success: true,
                session: {
                    id: doc.id,
                    ...d,
                    createdAt: d.createdAt?.toDate?.() || null,
                    updatedAt: d.updatedAt?.toDate?.() || null,
                    lastActiveAt: d.lastActiveAt?.toDate?.() || null,
                    expiresAt: d.expiresAt?.toDate?.() || null,
                },
            });
        }
        catch (err) {
            console.error('[BuildSessions] get error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Create or load a build session from a master catalog item ─────────────
    app.post('/admin/build-sessions/from-master', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { sourceMasterId, catalogId, blankKey: bodyBlankKey } = req.body;
            if (!sourceMasterId) {
                res.status(400).json({ error: 'sourceMasterId is required' });
                return;
            }
            const ownerAdminId = req.user?.uid || null;
            if (!ownerAdminId) {
                res.status(401).json({ error: 'Admin UID required' });
                return;
            }
            // Filter status in-memory to avoid requiring a composite Firestore index.
            const rawSessions = await core_1.db.collection(BUILD_SESSIONS_COLLECTION)
                .where('ownerAdminId', '==', ownerAdminId)
                .where('sourceMasterId', '==', sourceMasterId)
                .get();
            const activeDocs = rawSessions.docs
                .filter((d) => ['working', 'artifact_ready'].includes(d.data().status))
                .sort((a, b) => {
                const aTime = a.data().updatedAt?.toMillis?.() || 0;
                const bTime = b.data().updatedAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
            const existing = { empty: activeDocs.length === 0, docs: activeDocs };
            if (!existing.empty) {
                const doc = existing.docs[0];
                const d = doc.data();
                // Touch lastActiveAt and back-fill blankKey/catalogId if the session predates those fields
                const existingPatch = { lastActiveAt: firestore_1.FieldValue.serverTimestamp() };
                if (bodyBlankKey && !d.blankKey)
                    existingPatch.blankKey = bodyBlankKey;
                if (catalogId && !d.catalogId)
                    existingPatch.catalogId = catalogId;
                await doc.ref.update(existingPatch);
                res.json({
                    success: true,
                    sessionId: doc.id,
                    isExisting: true,
                    session: {
                        id: doc.id,
                        ...d,
                        blankKey: d.blankKey || bodyBlankKey || null,
                        catalogId: d.catalogId || catalogId || null,
                        createdAt: d.createdAt?.toDate?.() || null,
                        updatedAt: d.updatedAt?.toDate?.() || null,
                    },
                });
                return;
            }
            // sourceMasterId may be a Firestore doc ID (preferred) or a legacy numeric blueprint ID string.
            let masterDoc = await core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(sourceMasterId).get();
            if (!masterDoc.exists) {
                // Fallback: try querying by printifyBlueprintId (legacy numeric ID sent by old clients)
                const numericId = Number(sourceMasterId);
                if (!isNaN(numericId)) {
                    const qSnap = await core_1.db.collection(MASTER_CATALOG_COLLECTION)
                        .where('printifyBlueprintId', '==', numericId)
                        .limit(1)
                        .get();
                    if (!qSnap.empty) {
                        masterDoc = qSnap.docs[0];
                        console.log(`[BuildSessions] Resolved blueprint ${numericId} → doc ${masterDoc.id}`);
                    }
                }
            }
            if (!masterDoc.exists) {
                res.status(404).json({ error: `Master catalog item not found: ${sourceMasterId}` });
                return;
            }
            const master = masterDoc.data();
            const now = firestore_1.FieldValue.serverTimestamp();
            const expiresAt = firestore_1.Timestamp.fromDate(new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
            const sessionData = {
                sessionType: 'admin_build',
                sourceMasterId,
                ownerAdminId,
                catalogId: catalogId || null,
                blankKey: bodyBlankKey || null,
                working: {
                    title: master.title || null,
                    description: master.description || null,
                    images: master.images || [],
                    pricing: null,
                    graphics: null,
                    qrConfig: null,
                    layoutConfig: null,
                    zones: null,
                    metadata: null,
                },
                generated: {
                    packetId: null,
                    templateId: null,
                    graphicSetId: null,
                    artifactReady: false,
                },
                status: 'working',
                createdAt: now,
                updatedAt: now,
                lastActiveAt: now,
                expiresAt,
                committedInstanceId: null,
            };
            const ref = await core_1.db.collection(BUILD_SESSIONS_COLLECTION).add(sessionData);
            res.json({
                success: true,
                sessionId: ref.id,
                isExisting: false,
                session: { id: ref.id, ...sessionData, createdAt: null, updatedAt: null },
            });
        }
        catch (err) {
            console.error('[BuildSessions] from-master error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Clone a session into a fresh working draft ────────────────────────────
    app.post('/admin/build-sessions/clone', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { sourceSessionId } = req.body;
            if (!sourceSessionId) {
                res.status(400).json({ error: 'sourceSessionId is required' });
                return;
            }
            const uid = req.user?.uid || null;
            const sourceDoc = await core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(sourceSessionId).get();
            if (!sourceDoc.exists) {
                res.status(404).json({ error: 'Source session not found' });
                return;
            }
            const source = sourceDoc.data();
            const now = firestore_1.FieldValue.serverTimestamp();
            const expiresAt = firestore_1.Timestamp.fromDate(new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
            const newSession = {
                sessionType: 'admin_build',
                sourceMasterId: source.sourceMasterId,
                catalogId: source.catalogId || null,
                ownerAdminId: uid,
                working: source.working || {},
                draftName: source.draftName ? `${source.draftName} (copy)` : null,
                generated: { packetId: null, templateId: null, graphicSetId: null, artifactReady: false },
                status: 'working',
                clonedFromSessionId: sourceSessionId,
                createdAt: now,
                updatedAt: now,
                lastActiveAt: now,
                expiresAt,
                committedInstanceId: null,
            };
            const ref = await core_1.db.collection(BUILD_SESSIONS_COLLECTION).add(newSession);
            console.log(`[BuildSessions] Cloned ${sourceSessionId} → ${ref.id}`);
            res.json({ success: true, sessionId: ref.id, clonedFrom: sourceSessionId });
        }
        catch (err) {
            console.error('[BuildSessions] clone error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Update working state / draftName ──────────────────────────────────────
    app.patch('/admin/build-sessions/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { working, draftName } = req.body;
            if (!working && draftName === undefined) {
                res.status(400).json({ error: 'working object or draftName is required' });
                return;
            }
            const ref = core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Build session not found' });
                return;
            }
            const existing = doc.data();
            // draftName is a display-only label — allow it on any session status.
            // Only block working-state writes on sessions that are already finalized.
            const isDraftNameOnly = draftName !== undefined && !working;
            if (!isDraftNameOnly && (existing.status === 'committed' || existing.status === 'abandoned')) {
                res.status(409).json({
                    error: `Cannot update a ${existing.status} session. Start a new session instead.`,
                });
                return;
            }
            const updatePayload = {
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                lastActiveAt: firestore_1.FieldValue.serverTimestamp(),
            };
            if (working && typeof working === 'object') {
                updatePayload.working = { ...existing.working, ...working };
            }
            if (draftName !== undefined) {
                updatePayload.draftName = draftName;
            }
            await ref.update(updatePayload);
            res.json({ success: true, sessionId: id });
        }
        catch (err) {
            console.error('[BuildSessions] patch error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Generate artifact ─────────────────────────────────────────────────────
    app.post('/admin/build-sessions/:id/generate-artifact', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const packetFields = req.body;
            const ref = core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Build session not found' });
                return;
            }
            const session = doc.data();
            if (session.status === 'committed') {
                res.status(409).json({ error: 'Session already committed.' });
                return;
            }
            if (session.status === 'abandoned') {
                res.status(409).json({ error: 'Cannot generate artifact for an abandoned session.' });
                return;
            }
            const now = firestore_1.FieldValue.serverTimestamp();
            let packetId;
            if (packetFields.existingPacketId) {
                packetId = packetFields.existingPacketId;
                await core_1.db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).update({
                    ownerType: 'admin_build_session',
                    buildSessionId: id,
                    sourceMasterId: session.sourceMasterId,
                    sourceAdminInstanceId: null,
                    updatedAt: now,
                });
            }
            else {
                const packetData = {
                    ownerType: 'admin_build_session',
                    buildSessionId: id,
                    sourceMasterId: session.sourceMasterId,
                    sourceAdminInstanceId: null,
                    masterTitle: session.working?.title || null,
                    adminCatalogTitle: session.working?.title || null,
                    effectiveTitle: session.working?.title || null,
                    masterDescription: session.working?.description || null,
                    adminCatalogDescription: session.working?.description || null,
                    effectiveDescription: session.working?.description || null,
                    productImageUrl: session.working?.images?.[0] || null,
                    ...packetFields,
                    createdAt: now,
                    updatedAt: now,
                };
                if (session.generated?.packetId) {
                    const { createdAt: _c, ...updateFields } = packetData;
                    await core_1.db.collection(PRODUCT_PACKETS_COLLECTION)
                        .doc(session.generated.packetId)
                        .update({ ...updateFields, updatedAt: now });
                    packetId = session.generated.packetId;
                }
                else {
                    const packetRef = await core_1.db.collection(PRODUCT_PACKETS_COLLECTION).add(packetData);
                    packetId = packetRef.id;
                }
            }
            const sessionUpdate = {
                'generated.packetId': packetId,
                'generated.artifactReady': true,
                status: 'artifact_ready',
                updatedAt: now,
                lastActiveAt: now,
            };
            if (packetFields.previewImageUrl) {
                sessionUpdate['generated.previewImageUrl'] = packetFields.previewImageUrl;
            }
            await ref.update(sessionUpdate);
            res.json({ success: true, sessionId: id, packetId, artifactReady: true });
        }
        catch (err) {
            console.error('[BuildSessions] generate-artifact error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Commit — creates real admin_catalog_instance ──────────────────────────
    app.post('/admin/build-sessions/:id/commit', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { catalogId, pricing: bodyPricing } = req.body;
            const ref = core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Build session not found' });
                return;
            }
            const session = doc.data();
            if (session.status === 'committed') {
                res.json({
                    success: true,
                    alreadyCommitted: true,
                    instanceId: session.committedInstanceId,
                    sessionId: id,
                });
                return;
            }
            if (session.status === 'abandoned') {
                res.status(409).json({ error: 'Cannot commit an abandoned session.' });
                return;
            }
            if (!session.generated?.artifactReady) {
                res.status(422).json({
                    error: 'Artifact must be generated before committing. Call generate-artifact first.',
                });
                return;
            }
            const masterDoc = await core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(session.sourceMasterId).get();
            if (!masterDoc.exists) {
                res.status(404).json({ error: `Master catalog item not found: ${session.sourceMasterId}` });
                return;
            }
            const master = masterDoc.data();
            const now = firestore_1.FieldValue.serverTimestamp();
            const effectiveCatalogId = catalogId || session.catalogId || null;
            // --- Resolve curated title, description, and image list from catalog overrides ---
            // Priority: catalog blankTitles/blankDescriptions/blankImages > master catalog
            let curatedTitle = master.title || '';
            let curatedDescription = master.description || null;
            let curatedImages = master.images || [];
            if (effectiveCatalogId) {
                try {
                    const catDoc = await core_1.db.collection('catalogs').doc(effectiveCatalogId).get();
                    if (catDoc.exists) {
                        const catData = catDoc.data();
                        const blankTitles = catData.blankTitles || {};
                        const blankDescriptions = catData.blankDescriptions || {};
                        const blankImages = catData.blankImages || {};
                        // blankKey is the correct lookup key (e.g. "pf:71" or "36").
                        // sourceMasterId is the Firestore doc ID — wrong key for blankImages.
                        const lookupKey = session.blankKey || session.sourceMasterId;
                        if (blankTitles[lookupKey])
                            curatedTitle = blankTitles[lookupKey];
                        if (blankDescriptions[lookupKey])
                            curatedDescription = blankDescriptions[lookupKey];
                        const trimmed = blankImages[lookupKey] || [];
                        if (trimmed.length > 0)
                            curatedImages = trimmed;
                    }
                }
                catch (_) { /* fall back to master values */ }
            }
            // Prepend the generated mockup as the hero image if available
            // Also capture the admin-curated colors/sizes from the packet for enabledColors/enabledSizes
            const packetId = session.generated?.packetId || null;
            let mockupUrl = null;
            let packetEnabledColors = null;
            let packetEnabledSizes = null;
            if (packetId) {
                try {
                    const packetDoc = await core_1.db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
                    if (packetDoc.exists) {
                        const pkt = packetDoc.data();
                        mockupUrl = pkt.priorityMockupUrl || null;
                        const rawColors = pkt.colors || pkt.enabledColors || [];
                        const rawSizes = pkt.sizes || pkt.enabledSizes || [];
                        const normalizedColors = rawColors
                            .map((c) => (typeof c === 'string' ? c : c?.name || c?.label || null))
                            .filter(Boolean);
                        const normalizedSizes = rawSizes
                            .filter((s) => typeof s === 'string' && s.length > 0);
                        if (normalizedColors.length > 0)
                            packetEnabledColors = normalizedColors;
                        if (normalizedSizes.length > 0)
                            packetEnabledSizes = normalizedSizes;
                    }
                }
                catch (_) { /* no mockup */ }
            }
            const finalImages = mockupUrl ? [mockupUrl, ...curatedImages] : curatedImages;
            // ----------------------------------------
            const baseSnapshot = {
                title: curatedTitle,
                description: curatedDescription,
                images: finalImages,
                brand: master.brand || null,
                colors: master.colors || [],
                sizes: master.sizes || [],
                category: master.category || null,
                originCountry: master.originCountry || null,
                minPrice: master.minPrice || null,
                maxPrice: master.maxPrice || null,
                printifyBlueprintId: master.printifyBlueprintId || null,
                printfulProductId: master.printfulProductId || null,
            };
            const overrides = {};
            const w = session.working || {};
            if (w.title && w.title !== master.title)
                overrides.title = w.title;
            if (w.description && w.description !== master.description)
                overrides.description = w.description;
            // When a catalog is active, curatedImages (embedded in finalImages / baseSnapshot) is the
            // authority for images — do NOT let working.images blindly stomp it.
            // working.images starts from master.images and will restore deleted images if applied.
            if (!effectiveCatalogId && w.images?.length)
                overrides.images = w.images;
            const effectivePricing = bodyPricing || w.pricing || null;
            if (effectivePricing)
                overrides.pricing = effectivePricing;
            if (w.metadata)
                overrides.metadata = w.metadata;
            const resolved = resolveFields(baseSnapshot, overrides);
            const newPacketId = session.generated?.packetId || null;
            const meta = w.metadata || {};
            const selectedStore = meta.selectedStore || null;
            const selectedChannel = meta.selectedChannel || null;
            const selectedCollection = meta.selectedCollection || null;
            const folderPath = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name]
                .filter(Boolean).join(' / ') || null;
            // ── Always CREATE a new instance — every commit is a new catalog entry ──
            const instanceRef = await core_1.db.collection(ADMIN_INSTANCES_COLLECTION).add({
                instanceType: 'admin', sourceMasterId: session.sourceMasterId, sourceSessionId: id,
                catalogId: effectiveCatalogId, ownerAdminId: session.ownerAdminId,
                baseSnapshot, overrides, resolved,
                // Admin-curated selections from the builder — overrides full provider catalog at storefront
                enabledColors: packetEnabledColors,
                enabledSizes: packetEnabledSizes,
                currentPacketId: newPacketId, currentTemplateId: session.generated?.templateId || null,
                currentGraphicSetId: session.generated?.graphicSetId || null,
                storeId: selectedStore?.id || null,
                storeName: selectedStore?.name || null,
                channelId: selectedChannel?.id || null,
                channelName: selectedChannel?.name || null,
                collectionId: selectedCollection?.id || null,
                collectionName: selectedCollection?.name || null,
                folderPath,
                status: 'draft', createdAt: now, updatedAt: now,
            });
            const instanceId = instanceRef.id;
            console.log(`[BuildSessions] Created new instance ${instanceId} from session ${id}`);
            if (newPacketId) {
                await core_1.db.collection(PRODUCT_PACKETS_COLLECTION).doc(newPacketId).update({
                    ownerType: 'admin',
                    ownerInstanceId: instanceId,
                    sourceAdminInstanceId: instanceId,
                    updatedAt: now,
                });
            }
            await ref.update({
                status: 'committed',
                committedInstanceId: instanceId,
                updatedAt: now,
            });
            res.json({
                success: true,
                sessionId: id,
                instanceId,
                sourceMasterId: session.sourceMasterId,
                packetId: newPacketId,
            });
        }
        catch (err) {
            console.error('[BuildSessions] commit error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Abandon a session ─────────────────────────────────────────────────────
    app.post('/admin/build-sessions/:id/abandon', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const ref = core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Build session not found' });
                return;
            }
            const session = doc.data();
            if (session.status === 'committed') {
                res.status(409).json({ error: 'Cannot abandon a committed session.' });
                return;
            }
            await ref.update({
                status: 'abandoned',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            res.json({ success: true, sessionId: id });
        }
        catch (err) {
            console.error('[BuildSessions] abandon error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Reopen a committed session for editing ────────────────────────────────
    app.post('/admin/build-sessions/:id/reopen', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const ref = core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Session not found' });
                return;
            }
            const session = doc.data();
            if (session.status !== 'committed') {
                res.json({ success: true, sessionId: id, status: session.status, committedInstanceId: session.committedInstanceId || null, alreadyOpen: true });
                return;
            }
            await ref.update({
                status: 'working',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                lastActiveAt: firestore_1.FieldValue.serverTimestamp(),
            });
            console.log(`[BuildSessions] Reopened session ${id} (committed → working, keeps instanceId: ${session.committedInstanceId})`);
            res.json({ success: true, sessionId: id, status: 'working', committedInstanceId: session.committedInstanceId || null });
        }
        catch (err) {
            console.error('[BuildSessions] reopen error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Cleanup stale sessions ────────────────────────────────────────────────
    app.post('/admin/build-sessions/cleanup', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const cutoff = firestore_1.Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
            const stale = await core_1.db.collection(BUILD_SESSIONS_COLLECTION)
                .where('status', 'in', ['working', 'artifact_ready'])
                .where('lastActiveAt', '<', cutoff)
                .limit(100)
                .get();
            const batch = core_1.db.batch();
            stale.docs.forEach((doc) => {
                batch.update(doc.ref, { status: 'abandoned' });
            });
            await batch.commit();
            res.json({ success: true, cleaned: stale.size });
        }
        catch (err) {
            console.error('[BuildSessions] cleanup error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
}
//# sourceMappingURL=admin-build-sessions.js.map