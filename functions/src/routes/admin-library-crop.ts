/**
 * functions/src/routes/admin-library-crop.ts
 *
 * Mirrors server/routes/library-crop.routes.ts for production Cloud Functions.
 *
 * POST /admin/library/crop-mint
 *   Source, cropped, and background share the SAME sequence number.
 *   Crop-mint derives it from sourceGrfId — no new counter allocation.
 */

import { Request, Response } from 'express';
import { admin, db, getStorageBucket, STORAGE_BUCKET_NAME } from '../core';
import { requireAdmin } from '../middleware';
import {
  buildGrfId,
  parseGrfId,
  grfStoragePath,
  buildCropTransition,
  normalizeMimeType,
} from '../../../shared/GRF_engine';

export function registerAdminLibraryCrop(app: any): void {

  app.post('/admin/library/crop-mint', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        croppedImageData,
        croppedMimeType,
        originalMimeType,
        originalPublicUrl,
        sourceGrfId,
      } = req.body;

      if (!croppedImageData || !croppedMimeType || !originalMimeType || !originalPublicUrl || !sourceGrfId) {
        res.status(400).json({
          error: 'Missing required fields: croppedImageData, croppedMimeType, originalMimeType, originalPublicUrl, sourceGrfId',
        });
        return;
      }

      const sourceParsed = parseGrfId(sourceGrfId);
      if (!sourceParsed.sequence) {
        res.status(400).json({ error: `Cannot parse sequence from sourceGrfId: ${sourceGrfId}` });
        return;
      }

      const safeOriginalMime = normalizeMimeType(originalMimeType);
      const safeCroppedMime  = normalizeMimeType(croppedMimeType);

      const { cropped: croppedGrfParams, background: backgroundGrfParams } =
        buildCropTransition(safeOriginalMime, safeCroppedMime);

      const sharedSeq = sourceParsed.sequence;

      const croppedGrfId    = buildGrfId({ ...croppedGrfParams,    sequence: sharedSeq });
      const backgroundGrfId = buildGrfId({ ...backgroundGrfParams, sequence: sharedSeq });
      const croppedParsed    = parseGrfId(croppedGrfId);
      const backgroundParsed = parseGrfId(backgroundGrfId);

      const now    = admin.firestore.FieldValue.serverTimestamp();
      const bucket = getStorageBucket();

      // ── 1. Upload + record cropped ───────────────────────────────────────────
      const croppedPath   = grfStoragePath(croppedGrfId);
      const croppedBuffer = Buffer.from(croppedImageData, 'base64');
      const croppedFile   = bucket.file(croppedPath);
      await croppedFile.save(croppedBuffer, { metadata: { contentType: croppedMimeType } });
      await croppedFile.makePublic();
      const encodedCroppedPath = croppedPath.split('/').map(encodeURIComponent).join('/');
      const croppedPublicUrl   = `https://storage.googleapis.com/${STORAGE_BUCKET_NAME}/${encodedCroppedPath}`;

      await db.collection('grf_assets').doc(croppedGrfId).set({
        grfId:          croppedGrfId,
        assetClass:     croppedParsed.assetClass,
        mediaType:      croppedParsed.mediaType,
        channel:        croppedParsed.channel,
        purpose:        croppedParsed.purpose,
        format:         croppedParsed.format,
        sequence:       croppedParsed.sequence,
        assetClassName: croppedParsed.assetClassName,
        mediaTypeName:  croppedParsed.mediaTypeName,
        channelName:    croppedParsed.channelName,
        purposeName:    croppedParsed.purposeName,
        formatName:     croppedParsed.formatName,
        mimeType:       croppedMimeType,
        name:           croppedGrfId,
        storagePath:    croppedPath,
        publicUrl:      croppedPublicUrl,
        sourceGrfId,
        createdAt:      now,
        createdBy:      'admin',
        isActive:       true,
      });

      // ── 2. Record background (metadata only — file is the original) ──────────
      await db.collection('grf_assets').doc(backgroundGrfId).set({
        grfId:          backgroundGrfId,
        assetClass:     backgroundParsed.assetClass,
        mediaType:      backgroundParsed.mediaType,
        channel:        backgroundParsed.channel,
        purpose:        backgroundParsed.purpose,
        format:         backgroundParsed.format,
        sequence:       backgroundParsed.sequence,
        assetClassName: backgroundParsed.assetClassName,
        mediaTypeName:  backgroundParsed.mediaTypeName,
        channelName:    backgroundParsed.channelName,
        purposeName:    backgroundParsed.purposeName,
        formatName:     backgroundParsed.formatName,
        mimeType:       backgroundParsed.mimeType,
        name:           backgroundGrfId,
        storagePath:    null,
        publicUrl:      originalPublicUrl,
        sourceGrfId,
        createdAt:      now,
        createdBy:      'admin',
        isActive:       true,
      });

      console.log(`[CropMint] seq=${sharedSeq} → source=${sourceGrfId} cropped=${croppedGrfId} background=${backgroundGrfId}`);

      res.json({ success: true, croppedGrfId, backgroundGrfId, croppedPublicUrl });
    } catch (error: any) {
      console.error('[CropMint] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

}
