import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";
import { getFirestoreDb, getStorageBucket, getStorageBucketName } from "../lib/firebase-admin";
import {
  originalGrfParams,
  normalizeMimeType,
  buildGrfId,
  parseGrfId,
  grfStoragePath,
  GRF_COUNTER_KEY,
} from "@shared/GRF_engine";

export function registerLibrarySourceRoutes(app: Express): void {
  /**
   * POST /api/admin/library/upload-source
   *
   * Mints a new source GRF asset (channel=4, purpose=1) from a raw upload.
   * All GRF classification is handled here — the client sends only file data.
   *
   * Body:
   *   imageUrl         — base64 data URI (data:image/jpeg;base64,...)
   *   mimeType         — raw MIME type from the browser
   *   name             — display name (original filename)
   *   originalFilename — original filename with extension
   */
  app.post("/api/admin/library/upload-source", isAdmin, async (req: any, res) => {
    try {
      const { imageUrl, mimeType: rawMime, name, originalFilename } = req.body;

      if (!imageUrl || !rawMime) {
        return res.status(400).json({ error: "Missing required fields: imageUrl, mimeType" });
      }

      const mimeType   = normalizeMimeType(rawMime);
      const grfParams  = originalGrfParams(mimeType);

      const db         = getFirestoreDb();
      const bucket     = getStorageBucket();
      const bucketName = getStorageBucketName();
      const { FieldValue } = await import("firebase-admin/firestore");

      const counterRef = db.collection("grf_counters").doc(GRF_COUNTER_KEY);
      let newSeq = 0;
      await db.runTransaction(async (tx: any) => {
        const doc = await tx.get(counterRef);
        newSeq = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
        tx.set(counterRef, { count: newSeq, updatedAt: FieldValue.serverTimestamp() });
      });

      let grfId  = buildGrfId({ ...grfParams, sequence: newSeq });
      let parsed = parseGrfId(grfId);

      // Advance past any legacy docs that already occupy this sequence slot.
      const MAX_RETRIES = 10;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const existing = await db.collection("grf_assets").doc(grfId).get();
        if (!existing.exists) break;
        console.warn(`[UploadSource] Sequence collision at ${grfId} (attempt ${attempt + 1}) — advancing counter`);
        if (attempt === MAX_RETRIES - 1) {
          return res.status(500).json({ error: `GRF counter exhausted: could not find free slot after ${MAX_RETRIES} attempts.` });
        }
        await db.runTransaction(async (tx: any) => {
          const doc = await tx.get(counterRef);
          newSeq = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
          tx.set(counterRef, { count: newSeq, updatedAt: FieldValue.serverTimestamp() });
        });
        grfId  = buildGrfId({ ...grfParams, sequence: newSeq });
        parsed = parseGrfId(grfId);
      }

      const storagePath   = grfStoragePath(grfId, originalFilename || undefined);
      const base64Data    = imageUrl.replace(/^data:[^;]+;base64,/, "");
      const buffer        = Buffer.from(base64Data, "base64");
      const storageFile   = bucket.file(storagePath);
      await storageFile.save(buffer, { metadata: { contentType: mimeType } });
      await storageFile.makePublic();
      const encodedPath   = storagePath.split("/").map(encodeURIComponent).join("/");
      const publicUrl     = `https://storage.googleapis.com/${bucketName}/${encodedPath}`;

      const now = FieldValue.serverTimestamp();
      await db.collection("grf_assets").doc(grfId).set({
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
        name:             grfId,
        originalFilename: originalFilename || name || null,
        storagePath,
        publicUrl,
        sourceGrfId:    null,
        createdAt:      now,
        createdBy:      "admin",
        isActive:       true,
      });

      console.log(`[UploadSource] Minted ${grfId} (originalFilename="${originalFilename || name || null}")`);

      const doc   = await db.collection("grf_assets").doc(grfId).get();
      const saved = doc.data();
      res.json({ success: true, grfId, asset: saved });
    } catch (error: any) {
      console.error("[UploadSource] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
