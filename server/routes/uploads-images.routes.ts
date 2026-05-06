import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { fsInsert, fsQuery } from "../lib/firestore-crud";
import { isAuthenticated, isAdmin } from "../firebaseAuth";
import { uploadImage, uploadImageFromBuffer, getImageBuffer, deleteImage } from "../lib/image-upload";
import { downloadAndStreamFile, uploadToFirebaseStorage } from "../lib/firebase-storage-service";
import { verifyFirebaseToken } from "../lib/firebase-admin";

export function registerUploadsImagesRoutes(app: Express): void {
  app.post("/api/upload", async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      let fileName = "upload";
      let mimeType = "image/png";
      let boundary = "";
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (boundaryMatch) {
        boundary = boundaryMatch[1];
      }
      
      // Collect raw body data
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      // Parse multipart form data manually
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts = [];
      let start = 0;
      
      while (true) {
        const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        if (start > 0) {
          parts.push(rawBody.slice(start, boundaryIndex - 2)); // -2 for CRLF
        }
        start = boundaryIndex + boundaryBuffer.length + 2; // +2 for CRLF
      }
      
      let fileBuffer: Buffer | null = null;
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (filenameMatch) {
          fileName = filenameMatch[1];
          if (contentTypeMatch) {
            mimeType = contentTypeMatch[1].trim();
          }
          fileBuffer = body;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const uploadResult = await uploadImageFromBuffer(fileBuffer, fileName, mimeType);
      
      res.json({ url: uploadResult.publicUrl });
    } catch (error: any) {
      console.error("File upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Media upload API for Play content (videos/animated images)
  // Uploads directly to Firebase Storage with progress support
  // Part of test API umbrella - requires Firebase authentication
  app.post("/api/admin/upload-media", isAdmin, async (req, res) => {
    try {
      // Verify Firebase authentication
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const idToken = authHeader.substring(7);
      const decodedToken = await verifyFirebaseToken(idToken);
      if (!decodedToken) {
        return res.status(401).json({ error: "Invalid authentication token" });
      }
      
      const userId = decodedToken.uid;
      console.log(`[MediaUpload] Starting media upload for user: ${userId}`);
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      
      if (!boundaryMatch) {
        return res.status(400).json({ error: "Invalid content type - expected multipart/form-data" });
      }
      
      const boundary = boundaryMatch[1];
      
      // Collect raw body data
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      console.log(`[MediaUpload] Received ${rawBody.length} bytes`);
      
      // Parse multipart form data manually
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts: Buffer[] = [];
      let start = 0;
      
      while (true) {
        const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        if (start > 0) {
          parts.push(rawBody.slice(start, boundaryIndex - 2));
        }
        start = boundaryIndex + boundaryBuffer.length + 2;
      }
      
      let fileBuffer: Buffer | null = null;
      let fileName = `media-${Date.now()}`;
      let mimeType = "video/mp4";
      let storeType = "internal";
      let clientUserId = "";
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        // Check if this is the storeType field
        if (headers.includes('name="storeType"')) {
          storeType = body.toString().trim();
          continue;
        }
        
        // Check if this is the userId field
        if (headers.includes('name="userId"')) {
          clientUserId = body.toString().trim();
          continue;
        }
        
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (filenameMatch) {
          fileName = filenameMatch[1];
          if (contentTypeMatch) {
            mimeType = contentTypeMatch[1].trim();
          }
          fileBuffer = body;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Validate store type
      const validStoreTypes = ["internal", "external", "member"];
      if (!validStoreTypes.includes(storeType)) {
        storeType = "internal";
      }
      
      // Validate mime type for media
      const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska", "image/gif", "image/webp", "image/png", "image/jpeg"];
      if (!allowedTypes.includes(mimeType) && !mimeType.startsWith("video/")) {
        return res.status(400).json({ error: `Invalid file type: ${mimeType}. Allowed: most video formats, GIF, WebP, PNG, JPEG` });
      }
      
      // Determine media type from mime
      const mediaType = mimeType.startsWith("video/") ? "video" : "image";
      
      // Build storage path based on store type
      // - internal/external: library/{storeType}/{mediaType}/{filename}
      // - member: library/member/{userId}/{mediaType}/{filename}
      const uniqueFilename = `${Date.now()}-${fileName}`;
      let storagePath: string;
      let mediaUrl: string;
      
      if (storeType === "member") {
        // For member uploads, use the authenticated userId (not client-provided for security)
        storagePath = `library/member/${userId}/${mediaType}/${uniqueFilename}`;
        mediaUrl = `/api/library-files/member/${userId}/${mediaType}/${uniqueFilename}`;
      } else {
        storagePath = `library/${storeType}/${mediaType}/${uniqueFilename}`;
        mediaUrl = `/api/library-files/${storeType}/${mediaType}/${uniqueFilename}`;
      }
      
      console.log(`[MediaUpload] Uploading ${fileName} (${mimeType}, ${fileBuffer.length} bytes) to ${storagePath}`);
      
      // Upload directly to Firebase Storage with custom path
      const bucket = (await import("../lib/firebase-admin")).getStorageBucket();
      const file = bucket.file(storagePath);
      
      await file.save(fileBuffer, {
        metadata: { contentType: mimeType },
      });
      
      console.log(`[MediaUpload] Upload complete: ${mediaUrl}`);
      
      res.json({
        url: mediaUrl,
        mimeType: mimeType,
        fileName: fileName,
        size: fileBuffer.length,
        storagePath: storagePath
      });
      
    } catch (error: any) {
      console.error("[MediaUpload] Error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // ============ FILE SERVING ============
  // All /api/files and /api/library-files routes are in library-files.routes.ts

  // Serve media files from uploads folder in Firebase Storage
  app.get("/api/media-files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      const served = await downloadAndStreamFile(filename, res, 'uploads', 31536000);
      if (served) {
        return;
      }
      
      return res.status(404).json({ error: "Media file not found" });
    } catch (error: any) {
      console.error("Media file serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST UPLOAD ENDPOINTS ============

  // PUBLIC test endpoint for upload (no auth - for testing only)
  app.post("/api/admin/upload", isAdmin, async (req: any, res) => {
    try {
      const { name, assetType, imageData, mimeType } = req.body;
      
      console.log("[TestUpload] Received request:", { name, assetType, mimeType, dataLength: imageData?.length });
      
      if (!name || !assetType || !imageData) {
        return res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      }
      
      if (assetType !== 'source' && assetType !== 'cropped') {
        return res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      }
      
      const buffer = Buffer.from(imageData, 'base64');
      const isZip = mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed';
      // Handle ZIP file
      if (isZip) {
        console.log(`[TestUpload] Processing ZIP file: ${name}`);
        
        // 1. Save original zip to library/backgrounds/zip/
        const zipFileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const zipUploadResult = await uploadToFirebaseStorage(
          buffer,
          zipFileName,
          mimeType,
          'library/backgrounds/zip'
        );
        console.log(`[TestUpload] Saved ZIP to: ${zipUploadResult.storageUrl}`);
        
        // 2. Extract and upload each image to library/backgrounds/raw/
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        
        const uploadedAssets: any[] = [];
        let imageCount = 0;
        
        for (const [filename, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          
          const ext = filename.toLowerCase().split('.').pop();
          if (!['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext || '')) continue;
          
          imageCount++;
          const imageBuffer = await entry.async('nodebuffer');
          const imageName = filename.split('/').pop() || filename;
          const sanitizedName = `${Date.now()}-${imageName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const imageMime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          
          console.log(`[TestUpload] Extracting image ${imageCount}: ${imageName}`);
          
          const uploadResult = await uploadToFirebaseStorage(
            imageBuffer,
            sanitizedName,
            imageMime,
            'library/backgrounds/raw'
          );
          
          const displayName = imageName.replace(/\.[^/.]+$/, '');
          const proxyUrl = `/api/library-files/${encodeURIComponent(sanitizedName)}`;
          
          const asset = await fsInsert('library_assets', {
            ownerType: 'admin',
            assetType: assetType,
            mediaType: 'image',
            name: displayName,
            fileName: sanitizedName,
            originalName: imageName,
            storageUrl: uploadResult.storageUrl,
            publicUrl: proxyUrl,
            mimeType: imageMime,
            sizeBytes: imageBuffer.length,
            isActive: true,
          });
          
          uploadedAssets.push({ ...asset, proxyUrl });
        }
        
        console.log(`[TestUpload] ZIP complete: ${uploadedAssets.length} images extracted`);
        return res.json({ 
          success: true, 
          type: 'zip',
          zipStorageUrl: zipUploadResult.storageUrl,
          extractedCount: uploadedAssets.length,
          assets: uploadedAssets 
        });
      }
      
      // Handle single image
      console.log(`[TestUpload] Processing single image: ${name}`);
      
      const sanitizedName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${mimeType?.split('/')[1] || 'png'}`;
      const folder = assetType === 'source' ? 'library/backgrounds/raw' : 'library/backgrounds/cropped';
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType || 'image/png',
        folder
      );
      
      console.log(`[TestUpload] Uploaded to: ${uploadResult.storageUrl}`);
      
      const proxyUrl = `/api/library-files/${encodeURIComponent(sanitizedName)}`;
      
      const asset = await fsInsert('library_assets', {
        ownerType: 'admin',
        assetType: assetType,
        mediaType: 'image',
        name: name,
        fileName: sanitizedName,
        originalName: name,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType: mimeType || 'image/png',
        sizeBytes: buffer.length,
        isActive: true,
      });
      
      console.log(`[TestUpload] Created asset: ${asset.id}`);
      
      return res.json({ 
        success: true, 
        type: 'single',
        asset: { ...asset, proxyUrl }
      });
      
    } catch (error: any) {
      console.error('[TestUpload] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Admin image library — list ─────────────────────────────────────────────
  app.get("/api/admin/images", isAdmin, async (req: any, res) => {
    try {
      const folder = (req.query.folder as string) || '';
      const { getFirestoreDb, getStorageBucketName } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const snap = await db.collection('admin_images').get();
      const bucketName = getStorageBucketName();
      const images = snap.docs
        .map((doc: any) => {
          const data = doc.data();
          const gcsUrl = data.storageUrl
            ? `https://storage.googleapis.com/${bucketName}/${data.storageUrl}`
            : (data.publicUrl || '');
          return {
            id: doc.id,
            ...data,
            proxyUrl: `/api/admin/images/${doc.id}/file`,
            publicUrl: gcsUrl,
          };
        })
        .filter((img: any) => img.isActive !== false)
        .filter((img: any) => !folder || img.folder === folder)
        .sort((a: any, b: any) => {
          const getTime = (val: any): number => {
            if (!val) return 0;
            if (val._seconds) return val._seconds * 1000;
            if (val.toDate) return val.toDate().getTime();
            if (typeof val === 'string') return new Date(val).getTime() || 0;
            return 0;
          };
          return getTime(b.createdAt) - getTime(a.createdAt);
        });
      res.json(images);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Admin image library — list folders ─────────────────────────────────────
  app.get("/api/admin/images/folders", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const [imgSnap, folderSnap] = await Promise.all([
        db.collection('admin_images').get(),
        db.collection('admin_image_folders').get(),
      ]);
      const folderSet = new Set<string>();
      folderSnap.docs.forEach((doc: any) => {
        const name = doc.data().name;
        if (name) folderSet.add(name);
      });
      imgSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.isActive === false) return;
        const f = data.folder;
        if (f) folderSet.add(f);
      });
      res.json(Array.from(folderSet).sort());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Admin image library — serve by Firestore doc ID ───────────────────────
  app.get("/api/admin/images/:id/file", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { getFirestoreDb, getStorageBucket } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const doc = await db.collection('admin_images').doc(id).get();
      if (!doc.exists) { return res.status(404).json({ error: 'Image not found' }); }
      const data = doc.data() as any;
      if (data.isActive === false) { return res.status(404).json({ error: 'Image not active' }); }
      const storageUrl: string = data.storageUrl;
      if (!storageUrl) { return res.status(404).json({ error: 'No storage path on record' }); }
      const bucket = getStorageBucket();
      const file = bucket.file(storageUrl);
      const contentType: string = data.mimeType || 'image/png';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      file.createReadStream().pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Admin image library — upload ───────────────────────────────────────────
  app.post("/api/admin/images", isAdmin, async (req: any, res) => {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (!boundaryMatch) { return res.status(400).json({ error: 'Expected multipart/form-data' }); }
      const boundary = boundaryMatch[1];
      const rawBody: Buffer = await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
      if (!rawBody || rawBody.length === 0) { return res.status(400).json({ error: 'No request body' }); }
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts: Buffer[] = [];
      let start = 0;
      while (true) {
        const idx = rawBody.indexOf(boundaryBuffer, start);
        if (idx === -1) break;
        if (start > 0) parts.push(rawBody.slice(start, idx - 2));
        start = idx + boundaryBuffer.length + 2;
      }
      let fileBuffer: Buffer | null = null;
      let fileMimeType = 'image/png';
      let fieldName = '';
      let fieldFolder = 'general';
      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const hdrs = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        const filenameMatch = hdrs.match(/filename="([^"]+)"/);
        const ctMatch = hdrs.match(/Content-Type:\s*([^\r\n]+)/i);
        const nameMatch = hdrs.match(/name="([^"]+)"/);
        if (filenameMatch) {
          fileBuffer = body;
          if (ctMatch) fileMimeType = ctMatch[1].trim();
        } else if (nameMatch) {
          const val = body.toString().trim();
          if (nameMatch[1] === 'name') fieldName = val;
          if (nameMatch[1] === 'folder') fieldFolder = val;
        }
      }
      if (!fileBuffer || fileBuffer.length === 0) { return res.status(400).json({ error: 'No file in upload' }); }
      const name = fieldName || `image-${Date.now()}`;
      const folder = fieldFolder || 'general';
      const { getFirestoreDb, getStorageBucket, getStorageBucketName } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();
      const bucket = getStorageBucket();
      const bucketName = getStorageBucketName();
      const ext = fileMimeType.split('/')[1] || 'png';
      const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fullPath = `library/images/${folder}/${Date.now()}-${safeName}.${ext}`;
      const file = bucket.file(fullPath);
      await file.save(fileBuffer, { metadata: { contentType: fileMimeType } });
      await file.makePublic();
      const publicGcsUrl = `https://storage.googleapis.com/${bucketName}/${fullPath}`;
      const docRef = await db.collection('admin_images').add({
        name, folder, mimeType: fileMimeType, sizeBytes: fileBuffer.length,
        storageUrl: fullPath, publicUrl: publicGcsUrl, isActive: true,
        createdAt: FieldValue.serverTimestamp(),
      });
      const doc = await docRef.get();
      res.json({ id: doc.id, ...doc.data(), proxyUrl: `/api/admin/images/${docRef.id}/file`, publicUrl: publicGcsUrl });
    } catch (error: any) {
      console.error('[AdminImages] Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Admin image library — create folder ───────────────────────────────────
  app.post("/api/admin/images/folders", isAdmin, async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Folder name is required' });
      }
      const trimmed = name.trim().replace(/\s{2,}/g, ' ');
      if (trimmed.length > 80) { return res.status(400).json({ error: 'Folder name must be 80 characters or less' }); }
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const normalizedName = trimmed.toLowerCase();
      const allFolders = await db.collection('admin_image_folders').get();
      const match = allFolders.docs.find((doc: any) => (doc.data().name || '').trim().toLowerCase() === normalizedName);
      if (match) {
        return res.json({ ok: true, folder: match.data().name, created: false });
      }
      await db.collection('admin_image_folders').add({ name: trimmed, normalizedName, createdAt: new Date().toISOString() });
      res.json({ ok: true, folder: trimmed, created: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Image proxy endpoint for CORS-blocked images (used by AR demo)
  app.get("/api/proxy-image", async (req: any, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).json({ error: "Missing url parameter" });
      }
      
      // Only allow certain domains for security
      const allowedDomains = [
        "images.printify.com",
        "images-api.printify.com",
        "printful.com",
        "files.cdn.printful.com",
      ];
      
      const url = new URL(imageUrl);
      if (!allowedDomains.some(d => url.hostname.includes(d))) {
        return res.status(403).json({ error: "Domain not allowed" });
      }
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch image" });
      }
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());
      
      res.set("Content-Type", contentType);
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (error: any) {
      console.error("[ProxyImage] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ HOSTED IMAGES API ============

  app.post("/api/images/upload", async (req, res) => {
    try {
      const { imageData, originalName, mimeType, title, description, businessName, businessLogo, userId } = req.body;

      if (!imageData || !originalName || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: imageData, originalName, mimeType" });
      }

      const uploadResult = await uploadImage(imageData, originalName, mimeType);

      const hostedImage = await storage.createHostedImage({
        userId: userId || null,
        fileName: uploadResult.fileName,
        originalName,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        storageUrl: uploadResult.storageUrl,
        publicUrl: uploadResult.publicUrl,
        title: title || null,
        description: description || null,
        businessName: businessName || null,
        businessLogo: businessLogo || null,
        isActive: true,
        expiresAt: null,
      });

      res.json({
        id: hostedImage.id,
        publicUrl: `/view/${hostedImage.id}`,
        directUrl: uploadResult.publicUrl,
        landingUrl: `/view/${hostedImage.id}`,
      });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      
      const images = await storage.getHostedImagesByUser("");
      const allImages = images.length > 0 ? images : [];
      
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage) {
        const fileName = `hosted-images/${imageId}.jpeg`;
        const imageBuffer = await getImageBuffer(fileName);
        
        if (!imageBuffer) {
          const pngFileName = `hosted-images/${imageId}.png`;
          const pngBuffer = await getImageBuffer(pngFileName);
          
          if (!pngBuffer) {
            return res.status(404).json({ error: "Image not found" });
          }
          
          res.setHeader("Content-Type", pngBuffer.mimeType);
          res.setHeader("Cache-Control", "public, max-age=31536000");
          return res.send(pngBuffer.buffer);
        }
        
        res.setHeader("Content-Type", imageBuffer.mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000");
        return res.send(imageBuffer.buffer);
      }

      const imageBuffer = await getImageBuffer(hostedImage.storageUrl);
      
      if (!imageBuffer) {
        return res.status(404).json({ error: "Image file not found" });
      }

      await storage.incrementImageViews(imageId);

      res.setHeader("Content-Type", imageBuffer.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.send(imageBuffer.buffer);
    } catch (error: any) {
      console.error("Image serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/info/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage || !hostedImage.isActive) {
        return res.status(404).json({ error: "Image not found" });
      }

      res.json({
        id: hostedImage.id,
        title: hostedImage.title,
        description: hostedImage.description,
        businessName: hostedImage.businessName,
        businessLogo: hostedImage.businessLogo,
        views: hostedImage.views,
        createdAt: hostedImage.createdAt,
      });
    } catch (error: any) {
      console.error("Image info error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const images = await storage.getHostedImagesByUser(userId);
      res.json(images);
    } catch (error: any) {
      console.error("User images error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage) {
        return res.status(404).json({ error: "Image not found" });
      }

      await deleteImage(hostedImage.storageUrl);
      await storage.deleteHostedImage(imageId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Image delete error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CART ============
}
