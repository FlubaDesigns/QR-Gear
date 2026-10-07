import { createAdminImageLibrary } from '../../functions/src/services/admin-image-library';
import { registerAdminImageRoutes } from '../../functions/src/services/admin-image-routes';
import { getFirestoreDb, getStorageBucket } from '../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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

  // Legacy library_assets upload — removed. Use POST /api/admin/graphics/save-grf.
  app.post("/api/admin/upload", isAdmin, (_req: any, res: any) => {
    res.status(410).json({ error: "Removed. Use POST /api/admin/graphics/save-grf instead." });
  });

  registerAdminImageRoutes(app, '/api/admin', isAdmin, createAdminImageLibrary({
    db: { collection: (name: string) => getFirestoreDb().collection(name), runTransaction: (fn: any) => getFirestoreDb().runTransaction(fn) },
    bucket: getStorageBucket, now: () => FieldValue.serverTimestamp(),
  }));

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
