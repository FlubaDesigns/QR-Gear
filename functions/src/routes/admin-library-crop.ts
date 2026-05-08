/**
 * functions/src/routes/admin-library-crop.ts
 *
 * Mirrors server/routes/library-crop.routes.ts for production Cloud Functions.
 *
 * POST /admin/library/crop-mint
 *   GRF params are pre-computed by the frontend using GRF_engine.buildCropTransition()
 *   — same pattern as save-grf. The server just mints sequences and builds IDs.
 */

import { Router, Request, Response } from 'express';
import { admin, db } from '../core';
import { requireAdmin } from '../middleware';
import {
  buildGrfId,
  parseGrfId,
  GRF_COUNTER_KEY,
} from '../../../shared/graphicCodes';
import { buildCropTransition } from '../../../shared/GRF_engine';

const router = Router();

async function mintGrfSequence(): Promise<number> {
  const counterRef = db.collection('grf_counters').doc(GRF_COUNTER_KEY);
  let seq = 0;
  await db.runTransaction(async (tx: any) => {
    const doc = await tx.get(counterRef);
    seq = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
    tx.set(counterRef, { count: seq, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  return seq;
}

router.post('/admin/library/crop-mint', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      croppedImageData,
      croppedMimeType,
      originalMimeType,
      originalPublicUrl,
      name,
      sourceGrfId,
    } = req.body;

    if (!croppedImageData || !croppedMimeType || !originalMimeType || !originalPublicUrl || !name) {
      res.status(400).json({
        error: 'Missing required fields: croppedImageData, croppedMimeType, originalMimeType, originalPublicUrl, name',
      });
      return;
    }

    const { cropped: croppedGrfParams, background: backgroundGrfParams } =
      buildCropTransition(originalMimeType, croppedMimeType);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const bucket = admin.storage().bucket();

    // ── 1. Cropped record ─────────────────────────────────────────────────────
    const croppedSeq    = await mintGrfSequence();
    const croppedGrfId  = buildGrfId({ ...croppedGrfParams, sequence: croppedSeq });
    const croppedParsed = parseGrfId(croppedGrfId);
    const croppedExt    = croppedMimeType.includes('png') ? 'png' : 'jpg';
    const croppedPath   = `grf/${croppedGrfId}/cropped.${croppedExt}`;

    const croppedBuffer = Buffer.from(croppedImageData, 'base64');
    const croppedFile   = bucket.file(croppedPath);
    await croppedFile.save(croppedBuffer, { metadata: { contentType: croppedMimeType } });
    await croppedFile.makePublic();
    const encodedCroppedPath = croppedPath.split('/').map(encodeURIComponent).join('/');
    const croppedPublicUrl   = `https://storage.googleapis.com/${bucket.name}/${encodedCroppedPath}`;

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
      name:           `cropped_${name}`,
      storagePath:    croppedPath,
      publicUrl:      croppedPublicUrl,
      sourceGrfId:    sourceGrfId || null,
      createdAt:      now,
      createdBy:      'admin',
      isActive:       true,
    });

    // ── 2. Background record ──────────────────────────────────────────────────
    const backgroundSeq    = await mintGrfSequence();
    const backgroundGrfId  = buildGrfId({ ...backgroundGrfParams, sequence: backgroundSeq });
    const backgroundParsed = parseGrfId(backgroundGrfId);

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
      name:           `background_${name}`,
      storagePath:    null,
      publicUrl:      originalPublicUrl,
      sourceGrfId:    sourceGrfId || null,
      createdAt:      now,
      createdBy:      'admin',
      isActive:       true,
    });

    console.log(`[CropMint] Minted ${croppedGrfId} (cropped) + ${backgroundGrfId} (background) for "${name}"`);

    res.json({ success: true, croppedGrfId, backgroundGrfId });
  } catch (error: any) {
    console.error('[CropMint] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export function registerAdminLibraryCrop(app: any): void {
  app.use(router);
}
