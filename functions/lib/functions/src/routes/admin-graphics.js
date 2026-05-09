"use strict";
/**
 * functions/src/routes/admin-graphics.ts
 *
 * GRF asset routes — single source of truth for all grf_assets operations.
 * Mirrors server/routes/admin-content.routes.ts exactly.
 *
 * GET  /admin/graphics                  — list active GRF assets (filterable)
 * POST /admin/graphics/save-grf         — mint a new GRF asset record
 * PATCH /admin/graphics/:grfId/archive  — soft-delete a GRF asset
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminGraphics = registerAdminGraphics;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const GRF_engine_1 = require("../../../shared/GRF_engine");
function registerAdminGraphics(app) {
    // ── GET /admin/graphics ──────────────────────────────────────────────────────
    app.get('/admin/graphics', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { assetClass, mediaType, channel, purpose, format } = req.query;
            const snapshot = await core_1.db.collection('grf_assets').where('isActive', '==', true).get();
            const getTime = (val) => {
                if (!val)
                    return 0;
                if (typeof val === 'string')
                    return new Date(val).getTime() || 0;
                if (val.toDate)
                    return val.toDate().getTime();
                if (val._seconds)
                    return val._seconds * 1000;
                return 0;
            };
            const assets = snapshot.docs
                .map((doc) => (0, core_1.docToObject)(doc))
                .filter((a) => (!assetClass || a.assetClass === assetClass) &&
                (!mediaType || a.mediaType === mediaType) &&
                (!channel || a.channel === channel) &&
                (!purpose || a.purpose === purpose) &&
                (!format || a.format === format))
                .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
            res.json(assets);
        }
        catch (error) {
            console.error('[GRF] Error fetching graphics:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ── POST /admin/graphics/save-grf ────────────────────────────────────────────
    app.post('/admin/graphics/save-grf', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { assetClass, mediaType, channel, purpose, format, imageUrl, name, description, mimeType, storagePath, sourceGrfId, relatedPacketId, tags, originalFilename, } = req.body;
            if (!assetClass || !mediaType || !channel || !purpose || !format || !imageUrl) {
                res.status(400).json({ error: 'Missing required fields: assetClass, mediaType, channel, purpose, format, imageUrl' });
                return;
            }
            const counterRef = core_1.db.collection('grf_counters').doc(GRF_engine_1.GRF_COUNTER_KEY);
            let newSeq = 0;
            await core_1.db.runTransaction(async (tx) => {
                const doc = await tx.get(counterRef);
                newSeq = (doc.exists ? doc.data().count : 0) + 1;
                tx.set(counterRef, { count: newSeq, updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp() });
            });
            let grfId;
            try {
                grfId = (0, GRF_engine_1.buildGrfId)({
                    assetClass: assetClass,
                    mediaType: mediaType,
                    channel: channel,
                    purpose,
                    format,
                    sequence: newSeq,
                });
            }
            catch (e) {
                res.status(400).json({ error: `Invalid GRF params: ${e.message}` });
                return;
            }
            const parsed = (0, GRF_engine_1.parseGrfId)(grfId);
            const existingAsset = await core_1.db.collection('grf_assets').doc(grfId).get();
            if (existingAsset.exists) {
                console.error(`[GRF] Counter integrity violation — ${grfId} already exists.`);
                res.status(500).json({ error: `GRF counter integrity error: ${grfId} was already assigned. Do not retry — contact admin to inspect grf_counters/${GRF_engine_1.GRF_COUNTER_KEY}.` });
                return;
            }
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const canonicalStoragePath = storagePath || (0, GRF_engine_1.grfStoragePath)(grfId, originalFilename || undefined);
            let publicUrl = imageUrl;
            if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
                const bucket = (0, core_1.getStorageBucket)();
                const base64Data = imageUrl.replace(/^data:[^;]+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const storageFile = bucket.file(canonicalStoragePath);
                await storageFile.save(buffer, { metadata: { contentType: mimeType || 'image/jpeg' } });
                await storageFile.makePublic();
                const encodedPath = canonicalStoragePath.split('/').map(encodeURIComponent).join('/');
                publicUrl = `https://storage.googleapis.com/${core_1.STORAGE_BUCKET_NAME}/${encodedPath}`;
                console.log(`[GRF] Uploaded base64 → Storage: ${publicUrl}`);
            }
            const assetData = {
                grfId,
                assetClass: parsed.assetClass,
                mediaType: parsed.mediaType,
                channel: parsed.channel,
                purpose: parsed.purpose,
                format: parsed.format,
                sequence: parsed.sequence,
                assetClassName: parsed.assetClassName,
                mediaTypeName: parsed.mediaTypeName,
                channelName: parsed.channelName,
                purposeName: parsed.purposeName,
                formatName: parsed.formatName,
                mimeType: mimeType || parsed.mimeType,
                name: name || originalFilename || grfId,
                description: description || null,
                storagePath: canonicalStoragePath,
                publicUrl,
                sourceGrfId: sourceGrfId || null,
                relatedPacketId: relatedPacketId || null,
                tags: tags || null,
                createdAt: now,
                createdBy: 'admin',
                isActive: true,
            };
            if (parsed.channel === '4' && parsed.purpose === '1') {
                assetData.originalFilename = originalFilename || null;
            }
            await core_1.db.collection('grf_assets').doc(grfId).set(assetData);
            const doc = await core_1.db.collection('grf_assets').doc(grfId).get();
            const saved = (0, core_1.docToObject)(doc);
            console.log(`[GRF] Minted ${grfId} → grf_assets/${grfId}`);
            res.json({ success: true, grfId, asset: saved });
        }
        catch (error) {
            console.error('[GRF] Error saving graphic:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ── PATCH /admin/graphics/:grfId/archive ─────────────────────────────────────
    app.patch('/admin/graphics/:grfId/archive', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { grfId } = req.params;
            if (!(0, GRF_engine_1.isValidGraphicId)(grfId)) {
                res.status(400).json({ error: `Invalid GRF ID format: ${grfId}` });
                return;
            }
            const docRef = core_1.db.collection('grf_assets').doc(grfId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: `GRF asset not found: ${grfId}` });
                return;
            }
            await docRef.update({
                isActive: false,
                archivedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[GRF] Archived ${grfId}`);
            res.json({ success: true, grfId });
        }
        catch (error) {
            console.error('[GRF] Error archiving graphic:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ── DELETE /admin/graphics/:grfId ─────────────────────────────────────────────
    app.delete('/admin/graphics/:grfId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { grfId } = req.params;
            if (!(0, GRF_engine_1.isValidGraphicId)(grfId)) {
                res.status(400).json({ error: `Invalid GRF ID format: ${grfId}` });
                return;
            }
            const docRef = core_1.db.collection('grf_assets').doc(grfId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: `GRF asset not found: ${grfId}` });
                return;
            }
            const storagePath = doc.data()?.storagePath;
            if (storagePath) {
                try {
                    const bucket = (0, core_1.getStorageBucket)();
                    await bucket.file(storagePath).delete();
                    console.log(`[GRF] Deleted Storage file: ${storagePath}`);
                }
                catch (storageErr) {
                    console.warn(`[GRF] Storage file not found or already deleted (${storagePath}): ${storageErr.message}`);
                }
            }
            await docRef.delete();
            console.log(`[GRF] Permanently deleted ${grfId}`);
            res.json({ success: true, grfId });
        }
        catch (error) {
            console.error('[GRF] Error deleting graphic:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-graphics.js.map