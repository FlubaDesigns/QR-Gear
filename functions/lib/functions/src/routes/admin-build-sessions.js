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
exports.registerAdminBuildSessions = registerAdminBuildSessions;
const firestore_1 = require("firebase-admin/firestore");
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const composite_image_1 = require("../services/composite-image");
const BUILD_SESSIONS_COLLECTION = 'admin_build_sessions';
const ADMIN_INSTANCES_COLLECTION = 'admin_catalog_instances';
const MASTER_CATALOG_COLLECTION = 'master_catalog';
const PRODUCT_PACKETS_COLLECTION = 'productPackets';
const QRG_COUNTERS_COLLECTION = 'qrg_counters';
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
            // Capture the admin-curated colors/sizes from the packet for enabledColors/enabledSizes.
            // NOTE: mockup URL is intentionally NOT baked into resolved.images — the gallery reads it
            // dynamically from pkt.priorityMockupUrl at request time and appends it after catalog images.
            const packetId = session.generated?.packetId || null;
            let packetEnabledColors = null;
            let packetEnabledSizes = null;
            if (packetId) {
                try {
                    const packetDoc = await core_1.db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
                    if (packetDoc.exists) {
                        const pkt = packetDoc.data();
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
                catch (_) { /* no packet */ }
            }
            // resolved.images = only the admin-curated catalog images (mockup appended by gallery at read time)
            const finalImages = curatedImages;
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
    // ── Permanently delete a build session ───────────────────────────────────
    app.delete('/admin/build-sessions/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const ref = core_1.db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Build session not found' });
                return;
            }
            await ref.delete();
            console.log(`[BuildSessions] Deleted session ${id}`);
            res.json({ success: true, sessionId: id });
        }
        catch (err) {
            console.error('[BuildSessions] delete error:', err.message);
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
    // ── QRG Composite Regeneration ────────────────────────────────────────────
    app.post('/admin/qrg/regenerate-composite/:packetId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { packetId } = req.params;
            const packetRef = core_1.db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId);
            const packetDoc = await packetRef.get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: 'Packet not found' });
                return;
            }
            const packet = packetDoc.data();
            const qrContent = packet.qrContent;
            if (!qrContent) {
                res.status(400).json({ error: 'Packet has no qrContent' });
                return;
            }
            const STORAGE_BUCKET = 'qrgear-c1ffd.firebasestorage.app';
            const folder = `content/canvas/admin/${packetId}`;
            const resolveImageUrl = (url) => {
                if (!url)
                    return url;
                if (url.startsWith('/api/library-files/')) {
                    const filename = url.replace('/api/library-files/', '');
                    return `https://storage.googleapis.com/${STORAGE_BUCKET}/library-files/${filename}`;
                }
                return url;
            };
            const hs = packet.headerStyle;
            const fs = packet.footerStyle;
            const graphicLayoutMode = packet.graphicLayoutMode || 'zone';
            const qrSizePercent = packet.qrSizePercent ?? 75;
            const topText = hs?.enabled ? (hs.mode === 'image' && hs.imageUrl
                ? { text: '', fontFamily: 'Arial', fontSize: '14', mode: 'image', imageUrl: resolveImageUrl(hs.imageUrl), imageScale: hs.imageScale ?? 100, horizontalOffset: hs.horizontalOffset ?? 50, verticalOffset: hs.verticalOffset ?? 50 }
                : hs.text ? { text: hs.text, fontFamily: hs.fontFamily || 'Arial', fontSize: hs.fontSize || '14', color: hs.color || '#000000', strokeColor: hs.strokeColor || '', strokeWidth: hs.strokeWidth || 0 } : null) : null;
            const bottomText = fs?.enabled && fs.text ? {
                text: fs.text,
                fontFamily: fs.fontFamily || 'Arial',
                fontSize: fs.fontSize || '14',
                color: fs.color || '#000000',
                strokeColor: fs.strokeColor || '',
                strokeWidth: fs.strokeWidth || 0,
            } : null;
            // ── 1. Front composite (with header/footer) ───────────────────────────
            const frontPlacement = (packet.placements?.[0]) || 'front';
            const frontDataUrl = await (0, composite_image_1.cfGeneratePrintifyComposite)(qrContent, topText, bottomText, 1200, 1800, 'black', frontPlacement, graphicLayoutMode, qrSizePercent);
            const frontBuf = Buffer.from(frontDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
            const { publicUrl: compositeUrl } = await (0, composite_image_1.cfUploadBufferToStorage)(frontBuf, 'image/png', folder);
            // ── 2. Sleeve composites (QR code only — no header/footer) ───────────
            const SLEEVE_PLACEMENTS = ['left_sleeve', 'right_sleeve'];
            const packetPlacements = packet.placements || [];
            const sleevePlacements = packetPlacements.filter((p) => SLEEVE_PLACEMENTS.includes(p));
            const sleeveUrls = {};
            for (const slv of sleevePlacements) {
                const slvDataUrl = await (0, composite_image_1.cfGeneratePrintifyComposite)(qrContent, null, null, 1200, 1500, 'black', slv, 'zone', 90);
                const slvBuf = Buffer.from(slvDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
                const { publicUrl } = await (0, composite_image_1.cfUploadBufferToStorage)(slvBuf, 'image/png', folder);
                sleeveUrls[slv] = publicUrl;
            }
            const sleeveCompositeUrl = sleeveUrls['left_sleeve'] || sleeveUrls['right_sleeve'] || null;
            // ── 3. QR-only external URL ───────────────────────────────────────────
            const encodeUri = (s) => encodeURIComponent(s);
            const qrOnlyUrl = `https://api.qrserver.com/v1/create-qr-code/?size=3000x3000&data=${encodeUri(qrContent)}&format=png&qzone=0&ecc=H&color=000000&bgcolor=ffffff`;
            // ── 4. Save composites to packet ──────────────────────────────────────
            const packetUpdate = { compositeUrl, qrOnlyUrl, updatedAt: firestore_1.FieldValue.serverTimestamp() };
            if (sleeveCompositeUrl)
                packetUpdate.sleeveCompositeUrl = sleeveCompositeUrl;
            await packetRef.update(packetUpdate);
            // ── 5. Build resolved.images for catalog instance ─────────────────────
            // Order: front composite, sleeve composite(s), priority mockup, qr-only URL
            // Drop all stock images (images.printify.com) when we have ≥3 real images
            const priorityMockupUrl = packet.priorityMockupUrl || null;
            const realImages = [compositeUrl];
            for (const slv of sleevePlacements) {
                if (sleeveUrls[slv])
                    realImages.push(sleeveUrls[slv]);
            }
            if (priorityMockupUrl)
                realImages.push(priorityMockupUrl);
            realImages.push(qrOnlyUrl);
            // Use real images if ≥3; otherwise fall back to keeping existing non-stock images
            const instanceSnap = await core_1.db.collection(ADMIN_INSTANCES_COLLECTION)
                .where('currentPacketId', '==', packetId).limit(1).get();
            if (!instanceSnap.empty) {
                const instRef = instanceSnap.docs[0].ref;
                const instData = instanceSnap.docs[0].data();
                let updatedImages;
                if (realImages.length >= 3) {
                    // We have enough real images — drop all stock printify images
                    updatedImages = realImages;
                }
                else {
                    // Not enough real images yet — keep existing non-stock images and prepend composite
                    const existingImages = (instData.resolved?.images || [])
                        .filter((u) => !u.includes('images.printify.com'));
                    updatedImages = [compositeUrl, ...existingImages.filter((u) => u !== compositeUrl)];
                }
                await instRef.update({
                    'resolved.images': updatedImages,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            // ── 6. Auto re-publish to Printify if instances are already live ─────────
            // Fire-and-forget: response goes out immediately, republish runs in background
            Promise.resolve().then(() => __importStar(require('../services/printify-republish'))).then(({ republishAllInstancesForPacket }) => {
                republishAllInstancesForPacket(packetId).catch((e) => console.error('[AutoRepublish] background error for packet', packetId, e.message));
            }).catch(() => { });
            res.json({ success: true, packetId, compositeUrl, sleeveCompositeUrl, qrOnlyUrl, imageCount: realImages.length });
        }
        catch (err) {
            console.error('[QRG] regenerate-composite error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Publish Packet to Printify ────────────────────────────────────────────
    // Creates a Printify product from the packet's composites, stores printifyProductId
    // and a full color/size → variantId map back on the packet so orders can be fulfilled.
    app.post('/admin/qrg/publish-to-printify/:packetId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { packetId } = req.params;
            // printProviderId can be overridden via body; defaults to 99 (Monster Digital – US)
            const overrideProviderId = req.body.printProviderId
                ? parseInt(req.body.printProviderId, 10)
                : undefined;
            const packetDoc = await core_1.db.collection('productPackets').doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: `Packet ${packetId} not found` });
                return;
            }
            const packet = packetDoc.data();
            if (!packet.blueprintId) {
                res.status(400).json({ error: 'Packet is missing blueprintId' });
                return;
            }
            if (!packet.compositeUrl) {
                res.status(400).json({ error: 'Packet is missing compositeUrl — regenerate composite first' });
                return;
            }
            const blueprintId = parseInt(packet.blueprintId, 10);
            const printProviderId = overrideProviderId || packet.printProviderId || 99;
            // ── 1. Resolve enabled colors + sizes ──────────────────────────────────
            const enabledColors = (packet.colors || packet.enabledColors || []).map((c) => typeof c === 'string' ? c : c?.name || c?.label || String(c)).filter(Boolean);
            const enabledSizes = (packet.sizes || packet.enabledSizes || []).map((s) => typeof s === 'string' ? s : s?.name || s?.label || String(s)).filter(Boolean);
            if (enabledColors.length === 0 || enabledSizes.length === 0) {
                res.status(400).json({ error: 'Packet has no enabled colors or sizes — add them before publishing' });
                return;
            }
            // ── 2. Fetch Printify variants for this blueprint + provider ───────────
            const { printifyClient } = await Promise.resolve().then(() => __importStar(require('../services/printify')));
            const variantsData = await printifyClient.getVariants(blueprintId, printProviderId);
            const allVariants = variantsData.variants || [];
            // Match variants: Printify variant title is typically "Color / Size"
            const matchedVariants = allVariants.filter((v) => {
                const parts = (v.title || '').split(' / ');
                const vColor = parts[0]?.trim();
                const vSize = parts[1]?.trim();
                if (!vColor || !vSize)
                    return false;
                const colorMatch = enabledColors.some((c) => c.toLowerCase() === vColor.toLowerCase());
                const sizeMatch = enabledSizes.some((s) => s === vSize);
                return colorMatch && sizeMatch;
            });
            if (matchedVariants.length === 0) {
                res.status(400).json({
                    error: `No Printify variants matched for colors [${enabledColors.join(', ')}] and sizes [${enabledSizes.join(', ')}] on blueprint ${blueprintId} / provider ${printProviderId}. Check spelling or choose a different print provider.`,
                });
                return;
            }
            const priceInCents = Math.round((packet.pricing?.customerPrice || 29.99) * 100);
            const variantObjs = matchedVariants.map((v) => ({
                id: v.id,
                price: priceInCents,
                is_enabled: true,
            }));
            const variantIds = variantObjs.map((v) => v.id);
            // Build color/size → variantId lookup map stored on the packet
            const printifyVariantMap = {};
            for (const v of matchedVariants) {
                const parts = (v.title || '').split(' / ');
                const vColor = parts[0]?.trim();
                const vSize = parts[1]?.trim();
                if (vColor && vSize)
                    printifyVariantMap[`${vColor}/${vSize}`] = v.id;
            }
            // ── 3. Upload composite images to Printify (generic — driven by placements array) ──
            const PLACEMENT_URL_MAP = {
                front: 'compositeUrl',
                left_sleeve: 'sleeveCompositeUrl',
                right_sleeve: 'rightSleeveCompositeUrl',
                back: 'backCompositeUrl',
            };
            const placements = packet.placements || ['front'];
            const placeholders = [];
            for (const placement of placements) {
                const urlField = PLACEMENT_URL_MAP[placement];
                if (!urlField) {
                    console.warn(`[PublishToPrintify] Unknown placement "${placement}" — skipping`);
                    continue;
                }
                const imageUrl = packet[urlField];
                if (!imageUrl) {
                    console.warn(`[PublishToPrintify] Placement "${placement}" has no image URL (field: ${urlField}) — skipping`);
                    continue;
                }
                const upload = await printifyClient.uploadImage(`${packetId}-${placement}.png`, imageUrl);
                console.log(`[PublishToPrintify] ${placement} image uploaded: ${upload.id}`);
                placeholders.push({
                    position: placement,
                    images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
                });
            }
            if (placeholders.length === 0) {
                res.status(400).json({ error: 'No placement images could be uploaded — check compositeUrl and placement fields' });
                return;
            }
            // ── 4. Create the Printify product ─────────────────────────────────────
            const productTitle = packet.productName || packet.title || 'QR Gear T-Shirt';
            const printifyProduct = await printifyClient.createProduct({
                title: productTitle,
                description: packet.productDescription || packet.description || '',
                blueprint_id: blueprintId,
                print_provider_id: printProviderId,
                variants: variantObjs,
                print_areas: [{ variant_ids: variantIds, placeholders }],
            });
            console.log(`[PublishToPrintify] Product created: ${printifyProduct.id} for packet ${packetId}`);
            // ── 5. Persist back to packet ──────────────────────────────────────────
            await core_1.db.collection('productPackets').doc(packetId).update({
                printifyProductId: printifyProduct.id,
                printProviderId,
                printifyVariantMap,
                printifyPublishedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            res.json({
                success: true,
                printifyProductId: printifyProduct.id,
                printProviderId,
                variantCount: variantObjs.length,
                printifyVariantMap,
            });
        }
        catch (err) {
            console.error('[PublishToPrintify] error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── Manual republish: re-push composite images to existing Printify product ─
    app.post('/admin/qrg/republish/:instanceId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { instanceId } = req.params;
            const { republishInstanceToPrintify } = await Promise.resolve().then(() => __importStar(require('../services/printify-republish')));
            const instanceDoc = await core_1.db.collection('admin_catalog_instances').doc(instanceId).get();
            if (!instanceDoc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            if (!instanceDoc.data().printifyProductId) {
                res.status(400).json({ error: 'Instance has no printifyProductId — publish it first via /admin/qrg/publish-to-printify/:packetId' });
                return;
            }
            await core_1.db.collection('admin_catalog_instances').doc(instanceId).update({
                publishStatus: 'pending',
            });
            const result = await republishInstanceToPrintify(instanceId);
            if (result.success) {
                res.json({ success: true, instanceId });
            }
            else {
                res.status(500).json({ error: result.error });
            }
        }
        catch (err) {
            console.error('[ManualRepublish] error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── QRG ID Allocation ─────────────────────────────────────────────────────
    app.post('/admin/qrg/allocate', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { source, blankCode } = req.body;
            if (!source || !blankCode) {
                res.status(400).json({ error: 'source and blankCode are required' });
                return;
            }
            const counterRef = core_1.db.collection(QRG_COUNTERS_COLLECTION).doc(`${source}-${blankCode}`);
            let buildNumber = 0;
            await core_1.db.runTransaction(async (tx) => {
                const snap = await tx.get(counterRef);
                if (!snap.exists) {
                    buildNumber = 1;
                    tx.set(counterRef, { lastBuildNumber: 1, source, blankCode, createdAt: firestore_1.FieldValue.serverTimestamp() });
                }
                else {
                    buildNumber = (snap.data().lastBuildNumber || 0) + 1;
                    tx.update(counterRef, { lastBuildNumber: buildNumber, updatedAt: firestore_1.FieldValue.serverTimestamp() });
                }
            });
            const buildStr = String(buildNumber).padStart(3, '0');
            const qrgId = `QRG-${source}-${blankCode}-${buildStr}`;
            res.json({ success: true, qrgId, source, blankCode, buildNumber });
        }
        catch (err) {
            console.error('[QRG] allocate error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
}
//# sourceMappingURL=admin-build-sessions.js.map