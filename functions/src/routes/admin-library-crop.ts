/**
 * functions/src/routes/admin-library-crop.ts
 *
 * Mirrors server/routes/library-crop.routes.ts for production Cloud Functions.
 *
 * POST /admin/library/crop-mint
 *   Mints two GRF asset records when a source image is cropped:
 *     1. Cropped result    → purpose '2' (cropped)
 *     2. Promoted original → purpose '3' (background)
 *   Cropped bytes are uploaded to Firebase Storage and made public.
 *   sourceGrfId is stored on both records.
 */

import { Router, Request, Response } from 'express';
import { admin, db } from '../core';
import { requireAdmin } from '../middleware';
import {
  buildGrfId,
  parseGrfId,
  GRF_COUNTER_KEY,
  GRF_FORMATS,
} from '../../../shared/graphicCodes';
import type { GrfAssetClass, GrfChannel, GrfMediaType } from '../../../shared/graphicCodes';

const router = Router();

function mimeToFormatDigit(mimeType: string): string {
  const imageFormats = GRF_FORMATS['1' as GrfMediaType];
  const normalized = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
  for (const [digit, entry] of Object.entries(imageFormats)) {
    if (entry.mime === normalized) return digit;
  }
  return '2'; // fallback: JPEG
}

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
      originalPublicUrl,
      originalMimeType,
      name,
      sourceGrfId,
    } = req.body;

    if (!croppedImageData || !croppedMimeType || !originalPublicUrl || !originalMimeType || !name) {
      res.status(400).json({
        error: 'Missing required fields: croppedImageData, croppedMimeType, originalPublicUrl, originalMimeType, name',
      });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const bucket = admin.storage().bucket();

    const D1: GrfAssetClass = '1';
    const D2: GrfMediaType  = '1';
    const D3: GrfChannel    = '4';

    // ── 1. Cropped record (purpose '2') ──────────────────────────────────────
    const croppedSeq    = await mintGrfSequence();
    const croppedFormat = mimeToFormatDigit(croppedMimeType);
    const croppedGrfId  = buildGrfId({
      assetClass: D1, mediaType: D2, channel: D3,
      purpose: '2', format: croppedFormat, sequence: croppedSeq,
    });
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

    // ── 2. Background record (purpose '3') ───────────────────────────────────
    const backgroundSeq    = await mintGrfSequence();
    const backgroundFormat = mimeToFormatDigit(originalMimeType);
    const backgroundGrfId  = buildGrfId({
      assetClass: D1, mediaType: D2, channel: D3,
      purpose: '3', format: backgroundFormat, sequence: backgroundSeq,
    });
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
      mimeType:       originalMimeType,
      name:           `background_${name}`,
      storagePath:    null,
      publicUrl:      originalPublicUrl,
      sourceGrfId:    sourceGrfId || null,
      createdAt:      now,
      createdBy:      'admin',
      isActive:       true,
    });

    console.log(`[CropMint] Minted ${croppedGrfId} (cropped) + ${backgroundGrfId} (background) for "${name}"`);

    res.json({
      success: true,
      croppedGrfId,
      backgroundGrfId,
    });
  } catch (error: any) {
    console.error('[CropMint] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export function registerAdminLibraryCrop(app: any): void {
  app.use(router);
}
