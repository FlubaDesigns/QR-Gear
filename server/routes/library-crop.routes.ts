import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";
import { getFirestoreDb, getStorageBucket, getStorageBucketName } from "../lib/firebase-admin";
import { buildGrfId, parseGrfId, GRF_COUNTER_KEY, buildCropTransition, normalizeMimeType } from "@shared/GRF_engine";

async function mintGrfSequence(db: FirebaseFirestore.Firestore): Promise<number> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const counterRef = db.collection("grf_counters").doc(GRF_COUNTER_KEY);
  let seq = 0;
  await db.runTransaction(async (tx: any) => {
    const doc = await tx.get(counterRef);
    seq = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
    tx.set(counterRef, { count: seq, updatedAt: FieldValue.serverTimestamp() });
  });
  return seq;
}

export function registerLibraryCropRoutes(app: Express): void {
  /**
   * POST /api/admin/library/crop-mint
   *
   * Mints two GRF IDs when a source image is cropped.
   * GRF params (assetClass, mediaType, channel, purpose, format) are pre-computed
   * by the frontend using GRF_engine.buildCropTransition() — same pattern as save-grf.
   *
   * Body:
   *   croppedImageData    — base64 encoded cropped image
   *   croppedMimeType     — MIME type of the crop (for Storage content-type)
   *   croppedGrfParams    — { assetClass, mediaType, channel, purpose, format }
   *   backgroundGrfParams — { assetClass, mediaType, channel, purpose, format }
   *   originalPublicUrl   — existing GCS URL of source image (becomes background publicUrl)
   *   name                — display name
   *   sourceGrfId         — grfId of the source image
   */
  app.post("/api/admin/library/crop-mint", isAdmin, async (req: any, res) => {
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
        return res.status(400).json({
          error: "Missing required fields: croppedImageData, croppedMimeType, originalMimeType, originalPublicUrl, name",
        });
      }

      const safeOriginalMime = normalizeMimeType(originalMimeType);
      const safeCroppedMime  = normalizeMimeType(croppedMimeType);

      const { cropped: croppedGrfParams, background: backgroundGrfParams } =
        buildCropTransition(safeOriginalMime, safeCroppedMime);

      const db = getFirestoreDb();
      const bucket = getStorageBucket();
      const bucketName = getStorageBucketName();
      const { FieldValue } = await import("firebase-admin/firestore");
      const now = FieldValue.serverTimestamp();

      // ── 1. Mint GRF ID for cropped ──────────────────────────────────────────
      const croppedSeq   = await mintGrfSequence(db);
      const croppedGrfId = buildGrfId({ ...croppedGrfParams, sequence: croppedSeq });
      const croppedParsed = parseGrfId(croppedGrfId);
      const croppedExt   = croppedMimeType.includes('png') ? 'png' : 'jpg';
      const croppedPath  = `grf/${croppedGrfId}/cropped.${croppedExt}`;

      const croppedBuffer = Buffer.from(croppedImageData, 'base64');
      const croppedFile   = bucket.file(croppedPath);
      await croppedFile.save(croppedBuffer, { metadata: { contentType: croppedMimeType } });
      await croppedFile.makePublic();
      const encodedCroppedPath = croppedPath.split('/').map(encodeURIComponent).join('/');
      const croppedPublicUrl   = `https://storage.googleapis.com/${bucketName}/${encodedCroppedPath}`;

      await db.collection("grf_assets").doc(croppedGrfId).set({
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

      // ── 2. Mint GRF ID for background ───────────────────────────────────────
      const backgroundSeq    = await mintGrfSequence(db);
      const backgroundGrfId  = buildGrfId({ ...backgroundGrfParams, sequence: backgroundSeq });
      const backgroundParsed = parseGrfId(backgroundGrfId);

      await db.collection("grf_assets").doc(backgroundGrfId).set({
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
      console.error("[CropMint] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
