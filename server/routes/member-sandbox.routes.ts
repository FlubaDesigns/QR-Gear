import { catalogTierProducts } from "../../functions/src/services/catalog-tier-products";
import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { verifyMemberAuth } from "./member-auth";
import { normalizePlacement } from '../../shared/placements';

export function registerMemberSandboxRoutes(app: Express): void {
  app.post("/api/members/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fullName, storeName, creatorSlug, country, useCase, productInterests, socialSurfaces, primarySocial, socialHandle, attributionSource } = req.body;

      if (!fullName || !storeName || !creatorSlug) {
        return res.status(400).json({ error: "fullName, storeName, and creatorSlug are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const profileData = {
        userId,
        fullName,
        storeName,
        creatorSlug,
        country: country || '',
        useCase: useCase || '',
        productInterests: productInterests || [],
        socialSurfaces: socialSurfaces || [],
        primarySocial: primarySocial || '',
        socialHandle: socialHandle || '',
        attributionSource: attributionSource || '',
        isMember: true,
        memberSince: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('member_profiles').doc(userId).set(profileData, { merge: true });
      console.log(`[MemberProfile] Created/updated profile for ${userId}: ${storeName}`);
      res.json({ success: true, profile: profileData });
    } catch (error: any) {
      console.error('[MemberProfile] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const doc = await db.collection('member_profiles').doc(userId).get();
      if (!doc.exists) {
        return res.json({ isMember: false });
      }
      res.json({ isMember: true, profile: doc.data() });
    } catch (error: any) {
      console.error('[MemberProfile] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/check-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const doc = await db.collection('member_profiles').doc(userId).get();
      res.json({ isMember: doc.exists && doc.data()?.isMember === true });
    } catch (error: any) {
      res.json({ isMember: false });
    }
  });

  app.get("/api/members/:memberId/graphics", async (req: any, res) => {
    try {
      const { memberId } = req.params;

      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      
      const auth = await verifyMemberAuth(req, memberId);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error });
      }

      const images = await storage.getHostedImagesByUser(memberId);
      
      const graphicSets = [{
        id: 'my-uploads',
        name: 'My Uploads',
        thumbnailUrl: images[0]?.storageUrl || '',
        imageCount: images.length,
        images: images.map(img => ({
          id: img.id,
          url: img.storageUrl,
          name: img.fileName,
          createdAt: img.createdAt
        }))
      }];

      res.json(graphicSets);
    } catch (error: any) {
      console.error("[Member Graphics] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/:memberId/channels", async (req: any, res) => {
    try {
      const { memberId } = req.params;

      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      
      const auth = await verifyMemberAuth(req, memberId);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("channels")
        .where("ownerId", "==", memberId)
        .get();

      const channels = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json(channels);
    } catch (error: any) {
      console.error("[Member Channels] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/mockup/priority", isAuthenticated, async (req: any, res) => {
    try {
      const { 
        blueprintId, printProviderId, colorName, colorHex, 
        placement, artworkUrl, qrSize = "medium",
        fulfillmentProvider = "printify",
        packetId,
      } = req.body;

      if (!blueprintId || !colorName || !artworkUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, colorName, artworkUrl" 
        });
      }

      console.log(`[Member Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);

      const { getMockupWithFallback } = await import("../lib/mockup-service");
      
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex,
        canonicalPlacementId: placement || "front",
        artworkUrl,
        artworkVariant: "black",
        qrSize: qrSize as 'small' | 'medium' | 'large',
        fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      }, storage);

      console.log(`[Member Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);

      // Write-back: save mockup URL to the packet so it persists for gallery display
      if (packetId && result.mockupUrl) {
        try {
          const { getFirestoreDb } = await import("../lib/firebase-admin");
          const firestoreDb = getFirestoreDb();
          const updateData: Record<string, any> = { mockupUrl: result.mockupUrl };
          if (result.lifestyleMockupUrl) updateData.lifestyleMockupUrl = result.lifestyleMockupUrl;
          // Try productPackets first (admin-created packets assigned to members)
          const pRef = firestoreDb.collection('productPackets').doc(packetId);
          const pDoc = await pRef.get();
          if (pDoc.exists) {
            await pRef.update(updateData);
          } else {
            const { MEMBER_PACKETS_COLLECTION } = await import("../lib/constants");
            await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).update(updateData);
          }
          console.log(`[Member Mockup] Saved mockupUrl to packet ${packetId}`);
        } catch (writeErr) {
          console.warn(`[Member Mockup] Failed to write mockupUrl to packet ${packetId}:`, writeErr);
        }
      }

      res.json({
        success: true,
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        fromCache: result.fromCache,
        generatedAt: result.generatedAt,
      });
    } catch (error: any) {
      console.error("[Member Mockup] Error:", error);
      res.json({
        success: false,
        error: error.message,
        mockupUrl: null,
        message: "Mockup generation in progress - check back shortly",
      });
    }
  });

  app.post("/api/members/generate-product-graphic", isAuthenticated, async (req: any, res) => {
    try {
      const { 
        qrUrl,
        headerStyle,
        footerStyle,
        textLayoutChoice,
        qrColor = 'black'
      } = req.body;

      if (!qrUrl) {
        return res.status(400).json({ error: "Missing required field: qrUrl" });
      }

      console.log(`[ProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
      console.log(`[ProductGraphic] headerStyle:`, JSON.stringify(headerStyle));
      console.log(`[ProductGraphic] footerStyle:`, JSON.stringify(footerStyle));
      console.log(`[ProductGraphic] qrUrl:`, qrUrl);

      const { generatePrintifyComposite } = await import("../lib/composite-image-generator");
      
      const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
      const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
      
      console.log(`[ProductGraphic] showHeader: ${showHeader}, showFooter: ${showFooter}`);
      console.log(`[ProductGraphic] headerStyle?.text: "${headerStyle?.text || ''}", footerStyle?.text: "${footerStyle?.text || ''}"`);
      
      const topText = showHeader && (headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl)) ? {
        text: headerStyle.text || '',
        fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48',
        color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0,
        warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor,
        strokeWidth: headerStyle.strokeWidth,
        mode: headerStyle.mode,
        imageUrl: headerStyle.imageUrl,
        verticalOffset: headerStyle.verticalOffset,
        horizontalOffset: headerStyle.horizontalOffset,
        imageScale: headerStyle.imageScale,
      } : null;
      
      const bottomText = showFooter && (footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl)) ? {
        text: footerStyle.text || '',
        fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48',
        color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0,
        warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor,
        strokeWidth: footerStyle.strokeWidth,
        mode: footerStyle.mode,
        imageUrl: footerStyle.imageUrl,
        verticalOffset: footerStyle.verticalOffset,
        horizontalOffset: footerStyle.horizontalOffset,
        imageScale: footerStyle.imageScale,
      } : null;
      
      console.log(`[ProductGraphic] topText:`, topText ? JSON.stringify(topText) : 'null');
      console.log(`[ProductGraphic] bottomText:`, bottomText ? JSON.stringify(bottomText) : 'null');

      const productGraphicDataUrl = await generatePrintifyComposite(
        qrUrl,
        topText,
        bottomText,
        1200,
        1800,
        qrColor as 'black' | 'white'
      );

      console.log(`[ProductGraphic] Generated composite, length: ${productGraphicDataUrl.length}`);

      const { uploadToFirebasePublic } = await import("../lib/firebase-storage-service");
      const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URL format from composite generator");
      }
      
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const uploadResult = await uploadToFirebasePublic(buffer, mimeType, 'member-graphics');
      
      console.log(`[ProductGraphic] Uploaded to Firebase: ${uploadResult.publicUrl}`);

      res.json({
        success: true,
        productGraphic: uploadResult.publicUrl,
      });
    } catch (error: any) {
      console.error("[ProductGraphic] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.post("/api/public/generate-product-graphic", async (req: any, res) => {
    try {
      const { 
        qrUrl,
        headerStyle,
        footerStyle,
        textLayoutChoice,
        qrColor = 'black'
      } = req.body;

      if (!qrUrl) {
        return res.status(400).json({ error: "Missing required field: qrUrl" });
      }

      console.log(`[PublicProductGraphic] Generating composite with layout: ${textLayoutChoice}`);

      const { generatePrintifyComposite } = await import("../lib/composite-image-generator");
      
      const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
      const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
      
      const topText = showHeader && (headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl)) ? {
        text: headerStyle.text || '',
        fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48',
        color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0,
        warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor,
        strokeWidth: headerStyle.strokeWidth,
        mode: headerStyle.mode,
        imageUrl: headerStyle.imageUrl,
        verticalOffset: headerStyle.verticalOffset,
        horizontalOffset: headerStyle.horizontalOffset,
        imageScale: headerStyle.imageScale,
      } : null;
      
      const bottomText = showFooter && (footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl)) ? {
        text: footerStyle.text || '',
        fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48',
        color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0,
        warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor,
        strokeWidth: footerStyle.strokeWidth,
        mode: footerStyle.mode,
        imageUrl: footerStyle.imageUrl,
        verticalOffset: footerStyle.verticalOffset,
        horizontalOffset: footerStyle.horizontalOffset,
        imageScale: footerStyle.imageScale,
      } : null;

      const productGraphicDataUrl = await generatePrintifyComposite(
        qrUrl,
        topText,
        bottomText,
        1200,
        1800,
        qrColor as 'black' | 'white'
      );

      const { uploadToFirebasePublic } = await import("../lib/firebase-storage-service");
      const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URL format from composite generator");
      }
      
      const buffer = Buffer.from(match[2], 'base64');
      const uploadResult = await uploadToFirebasePublic(buffer, match[1], 'public-graphics');
      
      console.log(`[PublicProductGraphic] Uploaded to Firebase: ${uploadResult.publicUrl}`);

      res.json({
        success: true,
        productGraphic: uploadResult.publicUrl,
      });
    } catch (error: any) {
      console.error("[PublicProductGraphic] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });



  app.get("/api/members/tier-products", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      res.json(await catalogTierProducts(getFirestoreDb(), String(req.query.section || 'member')));
    } catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
  });

  app.post("/api/members/:memberId/library", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { publicUrl, storageUrl, assetType, mediaType, name, fileName } = req.body;
      if (!publicUrl) return res.status(400).json({ error: "publicUrl is required" });
      const { fsInsert } = await import("../lib/firestore-crud");
      const asset = await fsInsert("memberLibrary", {
        memberId,
        publicUrl,
        storageUrl: storageUrl || publicUrl,
        assetType: assetType || "graphic",
        mediaType: mediaType || "image",
        name: name || "Untitled",
        fileName: fileName || "untitled.png",
        isActive: true,
      });
      res.json(asset);
    } catch (error: any) {
      console.error("[MemberLibrary] Save error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
