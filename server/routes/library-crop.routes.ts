import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";
import { getFirestoreDb, getStorageBucket, getStorageBucketName } from "../lib/firebase-admin";
import { buildGrfId, parseGrfId, grfStoragePath, buildCropTransition, normalizeMimeType } from "@shared/GRF_engine";

export function registerLibraryCropRoutes(app: Express): void {
  /**
   * POST /api/admin/library/crop-mint
   *
   * Mints cropped + background GRF records for an existing source image.
   * All three (source, cropped, background) share the SAME sequence number —
   * they are the same object expressed at different purposes.
   *
   * Body:
   *   croppedImageData  — base64 encoded cropped image
   *   croppedMimeType   — MIME type of the crop
   *   originalMimeType  — MIME type of the source
   *   originalPublicUrl — existing GCS URL of source image (becomes background publicUrl)
   *   sourceGrfId       — grfId of the source image (sequence is reused)
   */
  app.post("/api/admin/library/crop-mint", isAdmin, async (req: any, res) => {
    try {
      const {
        croppedImageData,
        croppedMimeType,
        originalMimeType,
        originalPublicUrl,
        sourceGrfId,
      } = req.body;

      if (!croppedImageData || !croppedMimeType || !originalMimeType || !originalPublicUrl || !sourceGrfId) {
        return res.status(400).json({
          error: "Missing required fields: croppedImageData, croppedMimeType, originalMimeType, originalPublicUrl, sourceGrfId",
        });
      }

      const sourceParsed = parseGrfId(sourceGrfId);
      if (!sourceParsed.sequence) {
        return res.status(400).json({ error: `Cannot parse sequence from sourceGrfId: ${sourceGrfId}` });
      }

      const safeOriginalMime = normalizeMimeType(originalMimeType);
      const safeCroppedMime  = normalizeMimeType(croppedMimeType);

      const { cropped: croppedGrfParams, background: backgroundGrfParams } =
        buildCropTransition(safeOriginalMime, safeCroppedMime);

      // All three records share the same sequence — same object, different purposes
      const sharedSeq = sourceParsed.sequence;

      const croppedGrfId    = buildGrfId({ ...croppedGrfParams,    sequence: sharedSeq });
      const backgroundGrfId = buildGrfId({ ...backgroundGrfParams, sequence: sharedSeq });
      const croppedParsed    = parseGrfId(croppedGrfId);
      const backgroundParsed = parseGrfId(backgroundGrfId);

      const db         = getFirestoreDb();
      const bucket     = getStorageBucket();
      const bucketName = getStorageBucketName();
      const { FieldValue } = await import("firebase-admin/firestore");
      const now = FieldValue.serverTimestamp();

      // ── 1. Upload + record cropped ───────────────────────────────────────────
      const croppedPath   = grfStoragePath(croppedGrfId);
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
        name:           croppedGrfId,
        storagePath:    croppedPath,
        publicUrl:      croppedPublicUrl,
        sourceGrfId:    sourceGrfId,
        createdAt:      now,
        createdBy:      'admin',
        isActive:       true,
      });

      // ── 2. Record background (metadata only — file is the original) ──────────
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
        name:           backgroundGrfId,
        storagePath:    null,
        publicUrl:      originalPublicUrl,
        sourceGrfId:    sourceGrfId,
        createdAt:      now,
        createdBy:      'admin',
        isActive:       true,
      });

      console.log(`[CropMint] seq=${sharedSeq} → source=${sourceGrfId} cropped=${croppedGrfId} background=${backgroundGrfId}`);

      res.json({ success: true, croppedGrfId, backgroundGrfId });
    } catch (error: any) {
      console.error("[CropMint] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
