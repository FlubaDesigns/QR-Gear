/**
 * functions/src/routes/admin-library-source.ts
 *
 * Mirrors server/routes/library-source.routes.ts for production Cloud Functions.
 *
 * POST /admin/library/upload-source
 *   Mints a new source GRF asset (channel=4, purpose=1) from a raw upload.
 *   All GRF classification is handled here — the client sends only file data.
 */

import { Request, Response } from 'express';
import { admin, db, getStorageBucket, STORAGE_BUCKET_NAME } from '../core';
import { requireAdmin } from '../middleware';
import {
  originalGrfParams,
  normalizeMimeType,
  buildGrfId,
  parseGrfId,
  grfStoragePath,
  GRF_COUNTER_KEY,
} from '../../../shared/GRF_engine';

export function registerAdminLibrarySource(app: any): void {

  app.post('/admin/library/upload-source', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { imageUrl, mimeType: rawMime, name, originalFilename } = req.body;

      if (!imageUrl || !rawMime) {
        res.status(400).json({ error: 'Missing required fields: imageUrl, mimeType' });
        return;
      }

      const mimeType  = normalizeMimeType(rawMime);
      const grfParams = originalGrfParams(mimeType);

      const counterRef = db.collection('grf_counters').doc(GRF_COUNTER_KEY);
      let newSeq = 0;
      await db.runTransaction(async (tx: any) => {
        const doc = await tx.get(counterRef);
        newSeq = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
        tx.set(counterRef, { count: newSeq, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });

      const grfId  = buildGrfId({ ...grfParams, sequence: newSeq });
      const parsed = parseGrfId(grfId);

      const existingAsset = await db.collection('grf_assets').doc(grfId).get();
      if (existingAsset.exists) {
        console.error(`[UploadSource] Counter integrity violation — ${grfId} already exists.`);
        res.status(500).json({ error: `GRF counter integrity error: ${grfId} was already assigned.` });
        return;
      }

      const storagePath = grfStoragePath(grfId, originalFilename || undefined);
      const base64Data  = imageUrl.replace(/^data:[^;]+;base64,/, '');
      const buffer      = Buffer.from(base64Data, 'base64');
      const bucket      = getStorageBucket();
      const storageFile = bucket.file(storagePath);
      await storageFile.save(buffer, { metadata: { contentType: mimeType } });
      await storageFile.makePublic();
      const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
      const publicUrl   = `https://storage.googleapis.com/${STORAGE_BUCKET_NAME}/${encodedPath}`;

      const now         = admin.firestore.FieldValue.serverTimestamp();
      const displayName = name || originalFilename || grfId;

      await db.collection('grf_assets').doc(grfId).set({
        grfId,
        assetClass:     parsed.assetClass,
        mediaType:      parsed.mediaType,
        channel:        parsed.channel,
        purpose:        parsed.purpose,
        format:         parsed.format,
        sequence:       parsed.sequence,
        assetClassName: parsed.assetClassName,
        mediaTypeName:  parsed.mediaTypeName,
        channelName:    parsed.channelName,
        purposeName:    parsed.purposeName,
        formatName:     parsed.formatName,
        mimeType,
        name:           displayName,
        originalFilename: originalFilename || null,
        storagePath,
        publicUrl,
        sourceGrfId:    null,
        createdAt:      now,
        createdBy:      'admin',
        isActive:       true,
      });

      console.log(`[UploadSource] Minted ${grfId} — name="${displayName}"`);

      const doc   = await db.collection('grf_assets').doc(grfId).get();
      const saved = doc.data();
      res.json({ success: true, grfId, asset: saved });
    } catch (error: any) {
      console.error('[UploadSource] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

}
