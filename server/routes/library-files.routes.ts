/* =========================================================
   LIBRARY FILE SERVE FIX
   Fixes broken images & dead Library page
   ========================================================= */

import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import { downloadAndStreamFile } from "../lib/firebase-storage-service";

export function registerLibraryFileRoutes(app: Express): void {

  /* PRIMARY ROUTE
     Serves files stored in Firebase Storage
     */
  app.get("/api/library-files/:file", isAuthenticated, async (req: any, res) => {
    try {
      const file = String(req.params.file || "").trim();
      if (!file) return res.status(400).json({ error: "Missing filename" });

      const ok = await downloadAndStreamFile(
        file,
        res,
        "library/backgrounds/raw",
        3600
      );

      if (!ok && !res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
    } catch (err: any) {
      console.error("[LibraryFiles] Serve error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Serve failed" });
      }
    }
  });

  /* BACKWARD COMPATIBILITY
     Some records use /api/files/<file>
     */
  app.get("/api/files/:file", isAuthenticated, async (req: any, res) => {
    try {
      const file = String(req.params.file || "").trim();

      const ok = await downloadAndStreamFile(
        file,
        res,
        "library/backgrounds/raw",
        3600
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
}
