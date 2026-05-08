import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";
import { fsQuery, fsInsert, fsUpdate } from "../lib/firestore-crud";
import { uploadToFirebaseStorage, listFilesInFolder } from "../lib/firebase-storage-service";

const VALID_TYPES = ["source", "cropped", "background", "template", "design"] as const;
type ValidType = (typeof VALID_TYPES)[number];

function sanitizeFilename(name: string): string {
  return String(name || "file").replace(/[^a-zA-Z0-9.-]/g, "_");
}

export function registerBackgroundAssetsRoutes(app: Express): void {
  app.get("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const typeFilter = (req.query.type as string) || "source";
      if (!VALID_TYPES.includes(typeFilter as ValidType)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` });
      }

      const assets = await fsQuery("library_assets", [
        ["isActive", "==", true],
        ["assetType", "==", typeFilter],
      ]);

      assets.sort((a: any, b: any) => {
        const getTime = (val: any): number => {
          if (!val) return 0;
          if (typeof val === "string") return new Date(val).getTime() || 0;
          if (val.toDate) return val.toDate().getTime();
          if (val._seconds) return val._seconds * 1000;
          return 0;
        };
        return getTime(a.createdAt) - getTime(b.createdAt);
      });

      const assetsWithProxy = assets.map((asset: any) => {
        const filename = (asset.storageUrl || "").split("/").pop() || asset.fileName || "";
        const proxyUrl = `/api/library-files/${encodeURIComponent(filename)}`;
        return { ...asset, proxyUrl, publicUrl: proxyUrl };
      });

      res.json(assetsWithProxy);
    } catch (error: any) {
      console.error("[BackgroundAssets][GET] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const { name, assetType, imageData, mimeType, sourceAssetId } = req.body;

      if (!name || !assetType || !imageData) {
        return res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      }

      if (assetType !== "source" && assetType !== "cropped") {
        return res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      }

      const buffer = Buffer.from(imageData, "base64");

      const folderPath = assetType === "source" ? "library/backgrounds/raw" : "library/backgrounds/cropped";
      const safeName = sanitizeFilename(name);

      const uploadResult = await uploadToFirebaseStorage(buffer, safeName, mimeType || "image/png", folderPath);

      const actualFilename = (uploadResult.storageUrl || "").split("/").pop() || safeName;
      const proxyUrl = `/api/library-files/${encodeURIComponent(actualFilename)}`;

      const asset = await fsInsert("library_assets", {
        ownerType: "admin",
        assetType,
        mediaType: "image",
        name: safeName.replace(/\.[^/.]+$/, ""),
        fileName: actualFilename,
        originalName: safeName,
        mimeType: mimeType || "image/png",
        sizeBytes: buffer.length,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        isActive: true,
        ...(sourceAssetId ? { sourceAssetId } : {}),
      });

      if (assetType === "cropped" && sourceAssetId) {
        try {
          await fsUpdate("library_assets", sourceAssetId, { assetType: "background" });
          console.log(`[BackgroundAssets] Source ${sourceAssetId} moved to background after crop`);
        } catch (moveErr: any) {
          console.error(`[BackgroundAssets] Failed to move source to background:`, moveErr.message);
        }
      }

      res.json({ ...asset, proxyUrl });
    } catch (error: any) {
      console.error("[BackgroundAssets][POST] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      const { name, isActive } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await fsUpdate("library_assets", req.params.id, updateData);
      const filename = (updated.storageUrl || "").split("/").pop() || updated.fileName || "";
      const proxyUrl = `/api/library-files/${encodeURIComponent(filename)}`;

      res.json({ ...updated, proxyUrl, publicUrl: proxyUrl });
    } catch (error: any) {
      console.error("[BackgroundAssets][PUT] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      await fsUpdate("library_assets", req.params.id, { isActive: false });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[BackgroundAssets][DELETE] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets/sync", isAdmin, async (req: any, res) => {
    try {
      const folder = "library/backgrounds/raw";
      console.log(`[LibraryAssets][SYNC] Scanning: ${folder}`);

      const storageFiles = await listFilesInFolder(folder);

      const existingAssets = await fsQuery("library_assets", [
        ["isActive", "==", true],
        ["assetType", "==", "background"],
      ]);
      const existingPaths = new Set(existingAssets.map((a: any) => a.storageUrl));

      const newFiles = storageFiles.filter((f: any) => !existingPaths.has(f.fullPath));

      const createdAssets: any[] = [];
      for (const file of newFiles) {
        if (!String(file.contentType || "").startsWith("image/")) continue;

        try {
          const displayName = String(file.name || "").replace(/\.[^/.]+$/, "");
          const proxyUrl = `/api/library-files/${encodeURIComponent(file.name)}`;

          const asset = await fsInsert("library_assets", {
            ownerType: "admin",
            assetType: "background",
            mediaType: "image",
            name: displayName,
            fileName: file.name,
            originalName: file.name,
            mimeType: file.contentType,
            sizeBytes: file.size,
            storageUrl: file.fullPath,
            publicUrl: proxyUrl,
            isActive: true,
          });

          createdAssets.push({ ...asset, proxyUrl });
        } catch (err) {
          console.error(`[LibraryAssets][SYNC] Failed for ${file.name}:`, err);
        }
      }

      res.json({
        scanned: storageFiles.length,
        existing: existingAssets.length,
        created: createdAssets.length,
        assets: createdAssets,
      });
    } catch (error: any) {
      console.error("[LibraryAssets][SYNC] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
