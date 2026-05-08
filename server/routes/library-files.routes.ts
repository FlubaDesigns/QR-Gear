/* =========================================================
   LIBRARY FILE SERVE — SINGLE SOURCE OF TRUTH
   All /api/library-files and /api/files routes live HERE.
   No other route file should register these paths.
   ========================================================= */

import type { Express } from "express";
import { downloadAndStreamFile } from "../lib/firebase-storage-service";
import { getStorageBucket } from "../lib/firebase-admin";

export function registerLibraryFileRoutes(app: Express): void {

  /* ── Simple filename routes ─────────────────────────────
     /api/library-files/:file
     /api/files/:file  (backward compat)
     These are public (whitelisted in firebaseAuth.ts).
     downloadAndStreamFile already searches multiple folders.
     ────────────────────────────────────────────────────── */

  app.get("/api/library-files/:file", async (req: any, res) => {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const file = String(req.params.file || "").trim();
      if (!file) return res.status(400).json({ error: "Missing filename" });

      const rootsToTry = [
        "library/backgrounds/raw",
        "library/backgrounds/cropped",
        "library/backgrounds/raw/zip",
        "library/backgrounds/zip",
        "library/templates",
        "library/designs",
        "custom-designs",
      ];

      for (const root of rootsToTry) {
        const ok = await downloadAndStreamFile(file, res, root, 3600);
        if (ok) return;
        if (res.headersSent) return;
      }

      if (!res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
    } catch (err: any) {
      console.error("[LibraryFiles] Serve error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Serve failed" });
      }
    }
  });

  app.get("/api/files/:file", async (req: any, res) => {
    try {
      const file = String(req.params.file || "").trim();
      if (!file) return res.status(400).json({ error: "Missing filename" });

      const ok = await downloadAndStreamFile(
        file,
        res,
        "custom-designs",
        31536000
      );

      if (!ok && !res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
    } catch (err: any) {
      console.error("[FilesAlias] Serve error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Serve failed" });
      }
    }
  });

  /* ── Structured path routes ─────────────────────────────
     /api/library-files/:storeType/:mediaType/:filename
     /api/library-files/member/:userId/:mediaType/:filename
     ────────────────────────────────────────────────────── */

  app.get("/api/library-files/member/:userId/:mediaType/:filename", async (req: any, res) => {
    try {
      const { userId, mediaType, filename } = req.params;
      const storagePath = `library/member/${userId}/${mediaType}/${filename}`;
      await streamFromStorage(req, res, storagePath);
    } catch (err: any) {
      console.error("[LibraryFiles] Member serve error:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  /* ── GRF asset serve ────────────────────────────────────
     /api/grf-files/:grfId/:filename
     Serves files stored under grf/{grfId}/{filename} in Storage.
     ────────────────────────────────────────────────────── */

  app.get("/api/grf-files/:grfId/:filename", async (req: any, res) => {
    try {
      const { grfId, filename } = req.params;
      const storagePath = `grf/${grfId}/${filename}`;
      await streamFromStorage(req, res, storagePath);
    } catch (err: any) {
      console.error("[GrfFiles] Serve error:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/library-files/:storeType/:mediaType/:filename", async (req: any, res) => {
    try {
      const { storeType, mediaType, filename } = req.params;

      if (storeType === "member") {
        return res.status(400).json({
          error: "Use /api/library-files/member/:userId/:mediaType/:filename for member files",
        });
      }

      const storagePath = `library/${storeType}/${mediaType}/${filename}`;
      await streamFromStorage(req, res, storagePath);
    } catch (err: any) {
      console.error("[LibraryFiles] Structured serve error:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });
}

/* ── Helper: stream with HTTP Range support (mobile video) ── */
async function streamFromStorage(req: any, res: any, storagePath: string) {
  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);

  const [exists] = await file.exists();
  if (!exists) {
    return res.status(404).json({ error: "File not found" });
  }

  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || "application/octet-stream";
  const fileSize = parseInt(metadata.size as string, 10);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=31536000");

  const rangeHeader = req.headers.range;
  if (rangeHeader && fileSize) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Content-Length", chunkSize);
    res.setHeader("Content-Type", contentType);

    file.createReadStream({ start, end }).pipe(res);
  } else {
    res.setHeader("Content-Type", contentType);
    if (fileSize) {
      res.setHeader("Content-Length", fileSize);
    }
    file.createReadStream().pipe(res);
  }
}
