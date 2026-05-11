"use strict";
/**
 * functions/src/routes/admin-library-crop.ts
 *
 * Mirrors server/routes/library-crop.routes.ts for production Cloud Functions.
 *
 * POST /admin/library/crop-mint
 *   Source, cropped, and background share the SAME sequence number.
 *   Crop-mint derives it from sourceGrfId — no new counter allocation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminLibraryCrop = registerAdminLibraryCrop;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const GRF_engine_1 = require("../../../shared/GRF_engine");
function registerAdminLibraryCrop(app) {
    app.post('/admin/library/crop-mint', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { croppedImageData, croppedMimeType, originalMimeType, originalPublicUrl, sourceGrfId, } = req.body;
            if (!croppedImageData || !croppedMimeType || !originalMimeType || !originalPublicUrl || !sourceGrfId) {
                res.status(400).json({
                    error: 'Missing required fields: croppedImageData, croppedMimeType, originalMimeType, originalPublicUrl, sourceGrfId',
                });
                return;
            }
            const sourceParsed = (0, GRF_engine_1.parseGrfId)(sourceGrfId);
            if (!sourceParsed.sequence) {
                res.status(400).json({ error: `Cannot parse sequence from sourceGrfId: ${sourceGrfId}` });
                return;
            }
            const safeOriginalMime = (0, GRF_engine_1.normalizeMimeType)(originalMimeType);
            const safeCroppedMime = (0, GRF_engine_1.normalizeMimeType)(croppedMimeType);
            const { cropped: croppedGrfParams, background: backgroundGrfParams } = (0, GRF_engine_1.buildCropTransition)(safeOriginalMime, safeCroppedMime);
            const sharedSeq = sourceParsed.sequence;
            const croppedGrfId = (0, GRF_engine_1.buildGrfId)({ ...croppedGrfParams, sequence: sharedSeq });
            const backgroundGrfId = (0, GRF_engine_1.buildGrfId)({ ...backgroundGrfParams, sequence: sharedSeq });
            const croppedParsed = (0, GRF_engine_1.parseGrfId)(croppedGrfId);
            const backgroundParsed = (0, GRF_engine_1.parseGrfId)(backgroundGrfId);
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const bucket = (0, core_1.getStorageBucket)();
            // ── 1. Upload + record cropped ───────────────────────────────────────────
            const croppedPath = (0, GRF_engine_1.grfStoragePath)(croppedGrfId);
            const croppedBuffer = Buffer.from(croppedImageData, 'base64');
            const croppedFile = bucket.file(croppedPath);
            await croppedFile.save(croppedBuffer, { metadata: { contentType: croppedMimeType } });
            await croppedFile.makePublic();
            const encodedCroppedPath = croppedPath.split('/').map(encodeURIComponent).join('/');
            const croppedPublicUrl = `https://storage.googleapis.com/${core_1.STORAGE_BUCKET_NAME}/${encodedCroppedPath}`;
            await core_1.db.collection('grf_assets').doc(croppedGrfId).set({
                grfId: croppedGrfId,
                assetClass: croppedParsed.assetClass,
                mediaType: croppedParsed.mediaType,
                channel: croppedParsed.channel,
                purpose: croppedParsed.purpose,
                format: croppedParsed.format,
                sequence: croppedParsed.sequence,
                assetClassName: croppedParsed.assetClassName,
                mediaTypeName: croppedParsed.mediaTypeName,
                channelName: croppedParsed.channelName,
                purposeName: croppedParsed.purposeName,
                formatName: croppedParsed.formatName,
                mimeType: croppedMimeType,
                name: croppedGrfId,
                storagePath: croppedPath,
                publicUrl: croppedPublicUrl,
                sourceGrfId,
                createdAt: now,
                createdBy: 'admin',
                isActive: true,
            });
            // ── 2. Record background (metadata only — file is the original) ──────────
            await core_1.db.collection('grf_assets').doc(backgroundGrfId).set({
                grfId: backgroundGrfId,
                assetClass: backgroundParsed.assetClass,
                mediaType: backgroundParsed.mediaType,
                channel: backgroundParsed.channel,
                purpose: backgroundParsed.purpose,
                format: backgroundParsed.format,
                sequence: backgroundParsed.sequence,
                assetClassName: backgroundParsed.assetClassName,
                mediaTypeName: backgroundParsed.mediaTypeName,
                channelName: backgroundParsed.channelName,
                purposeName: backgroundParsed.purposeName,
                formatName: backgroundParsed.formatName,
                mimeType: backgroundParsed.mimeType,
                name: backgroundGrfId,
                storagePath: null,
                publicUrl: originalPublicUrl,
                sourceGrfId,
                createdAt: now,
                createdBy: 'admin',
                isActive: true,
            });
            console.log(`[CropMint] seq=${sharedSeq} → source=${sourceGrfId} cropped=${croppedGrfId} background=${backgroundGrfId}`);
            res.json({ success: true, croppedGrfId, backgroundGrfId, croppedPublicUrl });
        }
        catch (error) {
            console.error('[CropMint] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-library-crop.js.map