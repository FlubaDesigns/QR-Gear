import type { Express } from "express";
import { isAdmin } from "../../firebaseAuth";
import { fsQuery, fsInsert, fsUpdate } from "../../lib/firestore-crud";
import { uploadToFirebaseStorage, listFilesInFolder } from "../../lib/firebase-storage-service";
import JSZip from "jszip";

export function registerBackgroundAssetsRoutes(app: Express): void {

  app.get("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const typeFilter = (req.query.type as string) || 'source';
      const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
      
      if (!validTypes.includes(typeFilter)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }
      
      const assets = await fsQuery('library_assets', [['isActive', '==', true], ['assetType', '==', typeFilter]]);
      assets.sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      
      const assetsWithProxy = assets.map(asset => {
        const filename = (asset.storageUrl || '').split('/').pop() || '';
        return {
          ...asset,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
          publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
        };
      });
      
      res.json(assetsWithProxy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const { name, assetType, imageData, mimeType, sourceAssetId, cropData, tags } = req.body;
      
      if (!name || !assetType || !imageData) {
        return res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      }
      
      if (assetType !== 'source' && assetType !== 'cropped') {
        return res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      }
      
      const buffer = Buffer.from(imageData, 'base64');
      const isZip = mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed';
      
      if (isZip) {
        console.log(`[BackgroundAssets] Processing ZIP file: ${name}`);
        
        const zipFileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const zipUploadResult = await uploadToFirebaseStorage(
          buffer,
          zipFileName,
          mimeType,
          'library/backgrounds/zip'
        );
        console.log(`[BackgroundAssets] Saved ZIP to: ${zipUploadResult.storageUrl}`);
        
        const zip = await JSZip.loadAsync(buffer);
        const extractedAssets: any[] = [];
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
          if (!imageExtensions.includes(ext)) continue;
          
          if (filename.startsWith('__') || filename.includes('/.')) continue;
          
          try {
            const imageBuffer = await zipEntry.async('nodebuffer');
            const imageName = filename.split('/').pop() || filename;
            const sanitizedName = imageName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueName = `${Date.now()}-${sanitizedName}`;
            
            const mimeMap: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
            };
            const imageMimeType = mimeMap[ext] || 'image/png';
            
            const uploadResult = await uploadToFirebaseStorage(
              imageBuffer,
              uniqueName,
              imageMimeType,
              'library/backgrounds/raw'
            );
            
            const displayName = sanitizedName.replace(/\.[^/.]+$/, '');
            const zipActualFilename = (uploadResult.storageUrl || '').split('/').pop() || uniqueName;
            const proxyUrl = `/api/library-files/${encodeURIComponent(zipActualFilename)}`;
            
            const asset = await fsInsert('library_assets', {
              ownerType: 'admin',
              assetType: assetType,
              mediaType: 'image',
              name: displayName,
              fileName: zipActualFilename,
              originalName: imageName,
              mimeType: imageMimeType,
              sizeBytes: imageBuffer.length,
              storageUrl: uploadResult.storageUrl,
              publicUrl: proxyUrl,
              isActive: true,
            });
            
            extractedAssets.push({ ...asset, proxyUrl });
            
            console.log(`[BackgroundAssets] Extracted: ${imageName} -> ${uploadResult.storageUrl}`);
          } catch (extractError) {
            console.error(`[BackgroundAssets] Failed to extract ${filename}:`, extractError);
          }
        }
        
        console.log(`[BackgroundAssets] ZIP extraction complete: ${extractedAssets.length} images`);
        return res.json({
          zipStoragePath: zipUploadResult.storageUrl,
          extractedCount: extractedAssets.length,
          assets: extractedAssets,
        });
      }
      
      const folderPath = assetType === 'source' ? 'library/backgrounds/raw' : 'library/backgrounds/cropped';
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        name,
        mimeType || 'image/png',
        folderPath
      );
      
      const actualFilename = (uploadResult.storageUrl || '').split('/').pop() || '';
      const proxyUrl = `/api/library-files/${encodeURIComponent(actualFilename)}`;
      
      const asset = await fsInsert('library_assets', {
        ownerType: 'admin',
        assetType: assetType,
        mediaType: 'image',
        name,
        fileName: actualFilename,
        originalName: name,
        mimeType: mimeType || 'image/png',
        sizeBytes: buffer.length,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        isActive: true,
        ...(sourceAssetId ? { sourceAssetId } : {}),
      });
      
      if (assetType === 'cropped' && sourceAssetId) {
        try {
          await fsUpdate('library_assets', sourceAssetId, { assetType: 'background' });
          console.log(`[BackgroundAssets] Source ${sourceAssetId} moved to background after crop`);
        } catch (moveErr: any) {
          console.error(`[BackgroundAssets] Failed to move source to background:`, moveErr.message);
        }
      }
      
      res.json({ ...asset, proxyUrl: asset.publicUrl });
    } catch (error: any) {
      console.error("Error uploading background asset:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      const { name, isActive } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const updated = await fsUpdate('library_assets', req.params.id, updateData);
      
      res.json({ ...updated, proxyUrl: updated.publicUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      await fsUpdate('library_assets', req.params.id, { isActive: false });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets/migrate", isAdmin, async (req: any, res) => {
    try {
      const { migrateFilesToCanonicalFolder } = await import("../../lib/firebase-storage-service");
      const result = await migrateFilesToCanonicalFolder();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets/sync", isAdmin, async (req: any, res) => {
    try {
      const folder = 'library/backgrounds/raw';
      
      console.log(`[LibraryAssets] Syncing assets from: ${folder}`);
      
      const storageFiles = await listFilesInFolder(folder);
      console.log(`[LibraryAssets] Found ${storageFiles.length} files`);
      
      const existingAssets = await fsQuery('library_assets', [['isActive', '==', true], ['assetType', '==', 'background']]);
      const existingPaths = new Set(existingAssets.map((a: any) => a.storageUrl));
      
      const newFiles = storageFiles.filter(f => !existingPaths.has(f.fullPath));
      console.log(`[LibraryAssets] ${newFiles.length} files need database records`);
      
      const createdAssets: any[] = [];
      for (const file of newFiles) {
        if (!file.contentType.startsWith('image/')) continue;
        
        try {
          const displayName = file.name.replace(/\.[^/.]+$/, '');
          const proxyUrl = `/api/library-files/${encodeURIComponent(file.name)}`;
          
          const asset = await fsInsert('library_assets', {
            ownerType: 'admin',
            assetType: 'background',
            mediaType: 'image',
            name: displayName,
            fileName: file.name,
            originalName: file.name,
            mimeType: file.contentType,
            sizeBytes: file.size,
            storageUrl: file.fullPath,
            publicUrl: proxyUrl,
            isActive: true,
          });
          
          createdAssets.push({ ...asset, proxyUrl: asset.publicUrl });
          console.log(`[LibraryAssets] Created record for: ${file.name}`);
        } catch (err) {
          console.error(`[LibraryAssets] Failed to create record for ${file.name}:`, err);
        }
      }
      
      res.json({
        scanned: storageFiles.length,
        existing: existingAssets.length,
        created: createdAssets.length,
        assets: createdAssets,
      });
    } catch (error: any) {
      console.error("Error syncing library assets:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
