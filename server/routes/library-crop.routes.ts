import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";
import { getFirestoreDb, getStorageBucket } from "../lib/firebase-admin";
import {
  buildGrfId, parseGrfId, GRF_COUNTER_KEY, GRF_FORMATS,
} from "@shared/graphicCodes";
import type { GrfAssetClass, GrfChannel, GrfMediaType } from "@shared/graphicCodes";

function mimeToFormatDigit(mimeType: string): string {
  const imageFormats = GRF_FORMATS['1' as GrfMediaType];
  const normalized = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
  for (const [digit, entry] of Object.entries(imageFormats)) {
    if (entry.mime === normalized) return digit;
  }
  return '2'; // fallback: JPEG
}

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
   * Mints two GRF IDs when a source image is cropped:
   *   1. Cropped result  → GRF-1142X-NNNNNN  (input · image · assets · cropped)
   *   2. Promoted original → GRF-1143X-NNNNNN (input · image · assets · background)
   *
   * Body:
   *   croppedImageData  — base64 encoded cropped image
   *   croppedMimeType   — MIME type of the crop (usually image/jpeg)
   *   originalPublicUrl — existing URL of the source image (becomes background's publicUrl)
   *   originalMimeType  — MIME type of the original
   *   name              — display name (original filename)
   */
  app.post("/api/admin/library/crop-mint", isAdmin, async (req: any, res) => {
    try {
      const {
        croppedImageData,
        croppedMimeType,
        originalPublicUrl,
        originalMimeType,
        name,
      } = req.body;

      if (!croppedImageData || !croppedMimeType || !originalPublicUrl || !originalMimeType || !name) {
        return res.status(400).json({
          error: "Missing required fields: croppedImageData, croppedMimeType, originalPublicUrl, originalMimeType, name",
        });
      }

      const db = getFirestoreDb();
      const bucket = getStorageBucket();
      const { FieldValue } = await import("firebase-admin/firestore");
      const now = FieldValue.serverTimestamp();

      const D1: GrfAssetClass = '1'; // input_build
      const D2: GrfMediaType  = '1'; // image
      const D3: GrfChannel    = '4'; // assets

      // ── 1. Mint GRF ID for cropped (D4=2) ──────────────────────────────────
      const croppedSeq    = await mintGrfSequence(db);
      const croppedFormat = mimeToFormatDigit(croppedMimeType);
      const croppedGrfId  = buildGrfId({
        assetClass: D1, mediaType: D2, channel: D3,
        purpose: '2', format: croppedFormat, sequence: croppedSeq,
      });
      const croppedParsed = parseGrfId(croppedGrfId);
      const croppedExt    = croppedMimeType.includes('png') ? 'png' : 'jpg';
      const croppedPath   = `grf/${croppedGrfId}/cropped.${croppedExt}`;

      // Upload cropped bytes to GRF storage path
      const croppedBuffer = Buffer.from(croppedImageData, 'base64');
      await bucket.file(croppedPath).save(croppedBuffer, {
        metadata: { contentType: croppedMimeType },
      });

      const croppedPublicUrl = `/api/grf-files/${croppedGrfId}/cropped.${croppedExt}`;

      // Write grf_assets record for cropped
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
        sourceGrfId:    null,
        createdAt:      now,
        createdBy:      'admin',
        isActive:       true,
      });

      // ── 2. Mint GRF ID for background (D4=3) ───────────────────────────────
      const backgroundSeq    = await mintGrfSequence(db);
      const backgroundFormat = mimeToFormatDigit(originalMimeType);
      const backgroundGrfId  = buildGrfId({
        assetClass: D1, mediaType: D2, channel: D3,
        purpose: '3', format: backgroundFormat, sequence: backgroundSeq,
      });
      const backgroundParsed = parseGrfId(backgroundGrfId);

      // Write grf_assets record for background (points to original file URL)
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
        mimeType:       originalMimeType,
        name:           `background_${name}`,
        storagePath:    null,
        publicUrl:      originalPublicUrl,
        sourceGrfId:    null,
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
      console.error("[CropMint] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
