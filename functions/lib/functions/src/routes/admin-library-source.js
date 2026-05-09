"use strict";
/**
 * functions/src/routes/admin-library-source.ts
 *
 * Mirrors server/routes/library-source.routes.ts for production Cloud Functions.
 *
 * POST /admin/library/upload-source
 *   Mints a new source GRF asset (channel=4, purpose=1) from a raw upload.
 *   All GRF classification is handled here — the client sends only file data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminLibrarySource = registerAdminLibrarySource;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const GRF_engine_1 = require("../../../shared/GRF_engine");
function registerAdminLibrarySource(app) {
    app.post('/admin/library/upload-source', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { imageUrl, mimeType: rawMime, name, originalFilename } = req.body;
            if (!imageUrl || !rawMime) {
                res.status(400).json({ error: 'Missing required fields: imageUrl, mimeType' });
                return;
            }
            const mimeType = (0, GRF_engine_1.normalizeMimeType)(rawMime);
            const grfParams = (0, GRF_engine_1.originalGrfParams)(mimeType);
            const counterRef = core_1.db.collection('grf_counters').doc(GRF_engine_1.GRF_COUNTER_KEY);
            let newSeq = 0;
            await core_1.db.runTransaction(async (tx) => {
                const doc = await tx.get(counterRef);
                newSeq = (doc.exists ? doc.data().count : 0) + 1;
                tx.set(counterRef, { count: newSeq, updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp() });
            });
            const grfId = (0, GRF_engine_1.buildGrfId)({ ...grfParams, sequence: newSeq });
            const parsed = (0, GRF_engine_1.parseGrfId)(grfId);
            const existingAsset = await core_1.db.collection('grf_assets').doc(grfId).get();
            if (existingAsset.exists) {
                console.error(`[UploadSource] Counter integrity violation — ${grfId} already exists.`);
                res.status(500).json({ error: `GRF counter integrity error: ${grfId} was already assigned.` });
                return;
            }
            const storagePath = (0, GRF_engine_1.grfStoragePath)(grfId, originalFilename || undefined);
            const base64Data = imageUrl.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const bucket = (0, core_1.getStorageBucket)();
            const storageFile = bucket.file(storagePath);
            await storageFile.save(buffer, { metadata: { contentType: mimeType } });
            await storageFile.makePublic();
            const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
            const publicUrl = `https://storage.googleapis.com/${core_1.STORAGE_BUCKET_NAME}/${encodedPath}`;
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const displayName = name || originalFilename || grfId;
            await core_1.db.collection('grf_assets').doc(grfId).set({
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
                mimeType,
                name: displayName,
                originalFilename: originalFilename || null,
                storagePath,
                publicUrl,
                sourceGrfId: null,
                createdAt: now,
                createdBy: 'admin',
                isActive: true,
            });
            console.log(`[UploadSource] Minted ${grfId} — name="${displayName}"`);
            const doc = await core_1.db.collection('grf_assets').doc(grfId).get();
            const saved = doc.data();
            res.json({ success: true, grfId, asset: saved });
        }
        catch (error) {
            console.error('[UploadSource] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-library-source.js.map