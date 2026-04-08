import type { Express } from "express";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { MEMBER_PACKETS_COLLECTION } from "../lib/constants";

export function registerMemberCanvasRoutes(app: Express): void {
  app.post("/api/members/:memberId/packets", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      if (!background?.url) {
        return res.status(400).json({ error: "background.url is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetData = {
        packetId,
        memberId,
        kind: kind || 'qr_canvas',
        urlContent: urlContent || null,
        background: {
          url: background.url,
          crop: background.crop || null,
          assetId: background.assetId || null,
        },
        textLayers: textLayers || [],
        boundProduct: boundProduct || null,
        metadata: metadata || null,
        source: source || { entryPoint: 'wizard' },
        status: status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).set(packetData);
      
      console.log(`[MemberPackets] Created packet ${packetId} for member ${memberId}`);
      res.json({ packetId, success: true });
    } catch (error: any) {
      console.error('[MemberPackets] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/:memberId/media", async (req: any, res) => {
    try {
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
      console.log(`[MemberMedia] Starting media upload for member: ${userId}`);
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      
      if (!boundaryMatch) {
        return res.status(400).json({ error: "Invalid content type - expected multipart/form-data" });
      }
      
      const boundary = boundaryMatch[1];
      
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      console.log(`[MemberMedia] Received ${rawBody.length} bytes`);
      
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
      
      const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska", "image/gif", "image/webp", "image/png", "image/jpeg"];
      if (!allowedTypes.includes(mimeType) && !mimeType.startsWith("video/")) {
        return res.status(400).json({ error: `Invalid file type: ${mimeType}. Allowed: most video formats, GIF, WebP, PNG, JPEG` });
      }
      
      const mediaType = mimeType.startsWith("video/") ? "video" : "image";
      const uniqueFilename = `${Date.now()}-${fileName}`;
      const storagePath = `library/member/${userId}/${mediaType}/${uniqueFilename}`;
      const mediaUrl = `/api/library-files/member/${userId}/${mediaType}/${uniqueFilename}`;
      
      console.log(`[MemberMedia] Uploading ${fileName} (${mimeType}, ${fileBuffer.length} bytes) to ${storagePath}`);
      
      const bucket = (await import("../lib/firebase-admin")).getStorageBucket();
      const file = bucket.file(storagePath);
      
      await file.save(fileBuffer, {
        metadata: { contentType: mimeType },
      });
      
      console.log(`[MemberMedia] Upload complete: ${mediaUrl}`);
      
      res.json({
        url: mediaUrl,
        mimeType: mimeType,
        fileName: fileName,
        size: fileBuffer.length,
        storagePath: storagePath
      });
      
    } catch (error: any) {
      console.error("[MemberMedia] Error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  app.post("/api/member/packets", async (req: any, res) => {
    try {
      const { memberId, kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      if (!background?.url) {
        return res.status(400).json({ error: "background.url is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetData = {
        packetId,
        memberId,
        kind: kind || 'qr_canvas',
        urlContent: urlContent || null,
        background: {
          url: background.url,
          crop: background.crop || null,
          assetId: background.assetId || null,
        },
        textLayers: textLayers || [],
        boundProduct: boundProduct || null,
        metadata: metadata || null,
        source: source || { entryPoint: 'wizard' },
        status: status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).set(packetData);
      
      console.log(`[MemberPackets] Created packet ${packetId} for member ${memberId}`);
      res.json({ packetId, success: true });
    } catch (error: any) {
      console.error('[MemberPackets] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/member/packets", async (req: any, res) => {
    try {
      const { memberId } = req.query;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION)
        .where('memberId', '==', memberId)
        .limit(100)
        .get();
      
      const packets = snapshot.docs.map((doc: any) => doc.data());
      res.json({ packets });
    } catch (error: any) {
      console.error('[MemberPackets] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/member/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { memberId } = req.body;
      
      if (!packetId || !memberId) {
        return res.status(400).json({ error: "packetId and memberId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      if (doc.data()?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized to delete this packet" });
      }

      await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).delete();
      
      console.log(`[MemberPackets] Deleted packet ${packetId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[MemberPackets] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/members/:memberId/packets/:packetId", async (req: any, res) => {
    try {
      const { memberId, packetId } = req.params;
      const updates = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      if (doc.data()?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized to update this packet" });
      }

      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).update(updateData);
      
      console.log(`[MemberPackets] Updated packet ${packetId} for member ${memberId}`, Object.keys(updates));
      res.json({ success: true, packetId });
    } catch (error: any) {
      console.error('[MemberPackets] PATCH error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/member/graphics/create", async (req: any, res) => {
    try {
      const { memberId, packetId } = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb, getStorageBucket } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetDoc = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (!packet || packet.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const graphicsId = `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const compositeUrl = packet.background?.url || null;
      
      const graphicsData = {
        graphicsId,
        packetId,
        memberId,
        compositeUrl,
        qrOnlyUrl: null,
        status: 'generated',
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberGraphics').doc(graphicsId).set(graphicsData);
      
      await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).update({
        status: 'graphics_ready',
        graphicsId,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[MemberGraphics] Created graphics ${graphicsId} for packet ${packetId}`);
      res.json({ graphicsId, compositeUrl, qrOnlyUrl: null });
    } catch (error: any) {
      console.error('[MemberGraphics] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/member/templates/save", async (req: any, res) => {
    try {
      const { memberId, packetId, compositeUrl, titleText, descriptionText, kind, metadata } = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetDoc = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).get();
      const packetData = packetDoc.data() || {};
      
      const templateData = {
        templateId,
        packetId,
        memberId,
        kind: kind || packetData.kind || 'qr_canvas',
        compositeUrl: compositeUrl || null,
        titleText: titleText || '',
        descriptionText: descriptionText || '',
        background: packetData.background || null,
        textLayers: packetData.textLayers || [],
        metadata: metadata || null,
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberTemplates').doc(templateId).set(templateData);
      
      await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).update({
        templateId,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[MemberTemplates] Created template ${templateId} for packet ${packetId}`);
      res.json({ templateId });
    } catch (error: any) {
      console.error('[MemberTemplates] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/member/library-links", async (req: any, res) => {
    try {
      const { memberId, packetId, channelId, templateId, compositeUrl, qrOnlyUrl, boundProduct, metadata, status } = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const libraryLinkId = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const linkData = {
        libraryLinkId,
        packetId,
        channelId: channelId || null,
        storeId: memberId,
        templateId: templateId || null,
        memberId,
        compositeUrl: compositeUrl || null,
        qrOnlyUrl: qrOnlyUrl || null,
        boundProduct: boundProduct || null,
        metadata: metadata || null,
        status: status || 'active',
        shareUrl: `/share/${packetId}`,
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
      
      await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).update({
        status: 'published',
        libraryLinkId,
        updatedAt: new Date().toISOString(),
      });
      
      if (channelId) {
        const { upsertChannelItem, PLATFORM_STORE_ID } = await import("../lib/channelItemsService");
        await upsertChannelItem({
          storeId: PLATFORM_STORE_ID,
          channelId,
          packetId,
          title: metadata?.title || 'Untitled Item',
          description: metadata?.description,
          previewImageUrl: compositeUrl || metadata?.previewUrl,
          price: metadata?.price,
        });
        console.log(`[MemberLibrary] Also wrote to channel_items for channel ${channelId}`);
      }
      
      console.log(`[MemberLibrary] Created link ${libraryLinkId} for packet ${packetId}`);
      res.json({ libraryLinkId, shareUrl: `/share/${packetId}` });
    } catch (error: any) {
      console.error('[MemberLibrary] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/member/library-links", async (req: any, res) => {
    try {
      const { memberId } = req.query;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('memberLibraryLinks')
        .where('memberId', '==', memberId)
        .limit(100)
        .get();
      
      const items = snapshot.docs.map((doc: any) => doc.data());
      res.json({ items });
    } catch (error: any) {
      console.error('[MemberLibrary] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
