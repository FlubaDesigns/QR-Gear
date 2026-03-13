import type { Express } from "express";
import { uploadToFirebaseStorage } from "../lib/firebase-storage-service";

export function registerMemberLibraryRoutes(app: Express): void {
  app.get("/api/members/common-library", async (req: any, res) => {
    try {
      const { assetType = 'background' } = req.query;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      let commonQuery = firestoreDb.collection('commonLibrary')
        .where('isActive', '==', true);
      if (assetType) {
        commonQuery = commonQuery.where('assetType', '==', assetType);
      }
      
      let adminQuery = firestoreDb.collection('libraryAssets')
        .where('ownerType', '==', 'admin');
      
      const [commonSnapshot, adminSnapshot] = await Promise.all([
        commonQuery.orderBy('createdAt', 'desc').get(),
        adminQuery.get(),
      ]);
      
      const mapAsset = (doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          assetType: data.assetType,
          mediaType: data.mediaType || 'image',
          thumbnailUrl: data.thumbnailUrl || data.publicUrl || data.storageUrl,
          publicUrl: data.publicUrl || data.storageUrl,
          width: data.width,
          height: data.height,
          category: data.category,
        };
      };
      
      const commonAssets = commonSnapshot.docs.map(mapAsset);
      const adminAssets = adminSnapshot.docs.map(mapAsset).filter((a: any) => a.assetType === assetType);
      
      const seenIds = new Set<string>();
      const assets = [...commonAssets, ...adminAssets].filter(a => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });
      
      console.log(`[Member Common Library] Found ${assets.length} ${assetType} assets (${commonAssets.length} common + ${adminAssets.length} admin)`);
      res.json({ assets });
    } catch (error: any) {
      console.error("[Member Common Library] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/:memberId/library", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { assetType } = req.query;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      let query = firestoreDb.collection('memberLibrary')
        .where('memberId', '==', memberId)
        .where('isActive', '==', true);
      
      if (assetType) {
        query = query.where('assetType', '==', assetType);
      }
      
      const snapshot = await query.orderBy('createdAt', 'desc').get();
      
      const assets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          assetType: data.assetType,
          mediaType: data.mediaType || 'image',
          thumbnailUrl: data.thumbnailUrl || data.publicUrl,
          publicUrl: data.publicUrl,
          width: data.width,
          height: data.height,
          sourceAssetId: data.sourceAssetId,
          isCropped: data.isCropped || false,
          originalAssetId: data.originalAssetId,
        };
      });
      
      console.log(`[Member Personal Library] Found ${assets.length} assets for member ${memberId}`);
      res.json({ assets });
    } catch (error: any) {
      console.error("[Member Personal Library] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/:memberId/library/upload", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { 
        assetType = 'background', 
        name, 
        imageData, 
        mimeType: inputMimeType, 
        originalName: inputOriginalName,
        isCropped = false,
        originalAssetId
      } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: "No imageData provided" });
      }
      
      const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = inputMimeType || 'image/png';
      const originalName = inputOriginalName || `upload-${Date.now()}.png`;
      const displayName = name || originalName;
      
      const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
      
      const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const folder = isCropped 
        ? `members/${memberId}/library/cropped` 
        : mediaType === 'video'
          ? `members/${memberId}/library/videos`
          : `members/${memberId}/library/backgrounds`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType,
        folder
      );
      
      const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const assetData: any = {
        memberId,
        assetType,
        mediaType,
        name: displayName,
        fileName: sanitizedName,
        originalName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType,
        sizeBytes: buffer.length,
        isActive: true,
        isCropped: isCropped,
        createdAt: new Date().toISOString(),
      };
      
      if (originalAssetId) {
        assetData.originalAssetId = originalAssetId;
      }
      
      const assetDoc = await firestoreDb.collection('memberLibrary').add(assetData);
      
      console.log(`[Member Upload] Created ${assetType} asset ${assetDoc.id} for member ${memberId}`);
      
      res.json({ 
        success: true, 
        asset: {
          id: assetDoc.id,
          name: displayName,
          publicUrl: proxyUrl,
          assetType,
          mediaType,
          isCropped: isCropped,
        }
      });
    } catch (error: any) {
      console.error("[Member Upload] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/:memberId/library/crop", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { sourceAssetId, name, cropData, imageData } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: "No imageData provided" });
      }
      
      const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = 'image/png';
      
      const sanitizedName = `${Date.now()}-cropped-${sourceAssetId}.png`;
      const folder = `members/${memberId}/library/cropped`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType,
        folder
      );
      
      const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const assetDoc = await firestoreDb.collection('memberLibrary').add({
        memberId,
        assetType: 'cropped',
        mediaType: 'image',
        name: name || 'Cropped Image',
        fileName: sanitizedName,
        originalName: `cropped-${sourceAssetId}`,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType,
        sizeBytes: buffer.length,
        sourceAssetId,
        cropData: cropData ? JSON.parse(cropData) : null,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`[Member Crop] Created cropped asset ${assetDoc.id} from ${sourceAssetId} for member ${memberId}`);
      
      res.json({ 
        success: true, 
        asset: {
          id: assetDoc.id,
          name: name || 'Cropped Image',
          publicUrl: proxyUrl,
          sourceAssetId,
        }
      });
    } catch (error: any) {
      console.error("[Member Crop] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/:memberId/videos/upload", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { videoData, mimeType: inputMimeType, fileName: inputFileName } = req.body;
      
      if (!videoData) {
        return res.status(400).json({ error: "No videoData provided" });
      }
      
      const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      const mimeType = inputMimeType || 'video/mp4';
      if (!allowedVideoTypes.includes(mimeType)) {
        return res.status(400).json({ error: "Invalid video type. Allowed: MP4, WebM, MOV" });
      }
      
      const base64Data = videoData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const maxSize = 100 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return res.status(400).json({ error: "Video exceeds 100MB limit" });
      }
      
      const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/webm' ? 'webm' : 'mov';
      const originalName = inputFileName || `video-${Date.now()}.${ext}`;
      const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const folder = `members/${memberId}/library/videos`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType,
        folder
      );
      
      const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const assetDoc = await firestoreDb.collection('memberLibrary').add({
        memberId,
        assetType: 'video',
        mediaType: 'video',
        name: originalName,
        fileName: sanitizedName,
        originalName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType,
        sizeBytes: buffer.length,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`[Member Video Upload] Created video asset ${assetDoc.id} for member ${memberId}, size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
      
      res.json({ 
        success: true, 
        videoUrl: proxyUrl,
        assetId: assetDoc.id,
        fileName: sanitizedName,
      });
    } catch (error: any) {
      console.error("[Member Video Upload] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/member/play-packets", async (req: any, res) => {
    try {
      const { memberId, videoSource, textLayers, textBackdrop, playSettings, metadata, source, status } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      if (!videoSource?.type) {
        return res.status(400).json({ error: "videoSource is required" });
      }
      if (videoSource.type === 'upload' && !videoSource.videoUrl) {
        return res.status(400).json({ error: "videoUrl is required for uploaded videos" });
      }
      if (videoSource.type === 'external' && !videoSource.externalUrl) {
        return res.status(400).json({ error: "externalUrl is required for external videos" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetId = `play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetData = {
        packetId,
        memberId,
        kind: 'qr_play',
        videoSource: {
          type: videoSource.type,
          videoUrl: videoSource.videoUrl || null,
          externalUrl: videoSource.externalUrl || null,
          posterUrl: videoSource.posterUrl || null,
          duration: videoSource.duration || null,
          platform: videoSource.platform || null,
          mimeType: videoSource.mimeType || null,
          fileName: videoSource.fileName || null,
        },
        textLayers: textLayers || [],
        textBackdrop: textBackdrop || 'off',
        playSettings: {
          muted: playSettings?.muted ?? true,
          loop: playSettings?.loop ?? true,
          controls: playSettings?.controls ?? 'minimal',
        },
        metadata: metadata || null,
        source: source || { entryPoint: 'wizard' },
        status: status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberPackets').doc(packetId).set(packetData);
      
      console.log(`[QR Play] Created play packet ${packetId} for member ${memberId}`);
      res.json({ packetId, success: true });
    } catch (error: any) {
      console.error('[QR Play] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/member/play-packets/:packetId/share-card", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { memberId } = req.body;
      
      if (!packetId || !memberId) {
        return res.status(400).json({ error: "packetId and memberId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (packet?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const shareCardUrl = packet?.videoSource?.posterUrl || null;
      
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        shareCardUrl,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[QR Play] Generated share card for ${packetId}`);
      res.json({ shareCardUrl, success: true });
    } catch (error: any) {
      console.error('[QR Play Share Card] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/member/play-packets/:packetId/publish", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { memberId, channelId, metadata } = req.body;
      
      if (!packetId || !memberId) {
        return res.status(400).json({ error: "packetId and memberId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (packet?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const libraryLinkId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const titleLayer = packet?.textLayers?.find((l: any) => l.id === 'title' || l.label?.toLowerCase() === 'title');
      
      const linkData = {
        libraryLinkId,
        packetId,
        channelId: channelId || null,
        storeId: memberId,
        memberId,
        kind: 'qr_play',
        videoSource: packet?.videoSource || null,
        shareCardUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
        titleText: titleLayer?.text || 'Untitled Video',
        textLayers: packet?.textLayers || [],
        textBackdrop: packet?.textBackdrop || 'off',
        playSettings: packet?.playSettings || {},
        metadata: metadata || packet?.metadata || null,
        status: 'active',
        shareUrl: `/play/${packetId}`,
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
      
      await firestoreDb.collection('memberPackets').doc(packetId).update({
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
          title: titleLayer?.text || 'Untitled Video',
          description: metadata?.description,
          previewImageUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl,
          price: metadata?.price,
        });
        console.log(`[QR Play] Also wrote to channel_items for channel ${channelId}`);
      }
      
      console.log(`[QR Play] Published packet ${packetId} as ${libraryLinkId}`);
      res.json({ libraryLinkId, shareUrl: `/play/${packetId}`, success: true });
    } catch (error: any) {
      console.error('[QR Play Publish] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/member-files/:memberId/:filename", async (req: any, res) => {
    try {
      const { memberId, filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const { getStorageBucket, getFirestoreDb } = await import("../lib/firebase-admin");
      const bucket = getStorageBucket();
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('memberLibrary')
        .where('memberId', '==', memberId)
        .where('fileName', '==', decodedFilename)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (data.storageUrl) {
          let storagePath = data.storageUrl;
          if (storagePath.startsWith('gs://')) {
            storagePath = storagePath.replace(/^gs:\/\/[^\/]+\//, '');
          }
          
          const file = bucket.file(storagePath);
          const [exists] = await file.exists();
          
          if (exists) {
            const [metadata] = await file.getMetadata();
            res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            
            const stream = file.createReadStream();
            stream.pipe(res);
            return;
          }
        }
      }
      
      const possiblePaths = [
        `members/${memberId}/library/backgrounds/${decodedFilename}`,
        `members/${memberId}/library/cropped/${decodedFilename}`,
        `members/${memberId}/library/videos/${decodedFilename}`,
        `members/${memberId}/backgrounds/${decodedFilename}`,
        `members/${memberId}/videos/${decodedFilename}`,
        `members/${memberId}/cropped/${decodedFilename}`,
      ];
      
      for (const path of possiblePaths) {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        
        if (exists) {
          const [metadata] = await file.getMetadata();
          res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          
          const stream = file.createReadStream();
          stream.pipe(res);
          return;
        }
      }
      
      console.log(`[Member Files] File not found: ${memberId}/${decodedFilename}`);
      res.status(404).json({ error: "File not found" });
    } catch (error: any) {
      console.error("[Member Files] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
