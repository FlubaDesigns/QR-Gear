import type { Express } from "express";
import { storage } from "../../storage";
import { isAdmin } from "../../firebaseAuth";
import { STORE_PRODUCT_LINKS_COLLECTION } from "../../lib/constants";

export function registerStoreProductLinksRoutes(app: Express): void {

  app.get("/api/store-product-links", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const links = linksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      console.log(`[Store Links] Listed ${links.length} total links`);
      res.json({ success: true, links, count: links.length });
    } catch (error: any) {
      console.error("[Store Links] Error listing links:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/store-product-links", isAdmin, async (req: any, res) => {
    try {
      const { 
        storeId, storeName, channel, collection, packetId, templateId, graphicsId, 
        qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
        enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
        qrProductState, landingPageUrl, mockupUrl, assemblyId: bodyAssemblyId
      } = req.body;

      console.log("[Store Links] Creating link:", { storeId, channel, packetId, templateId, productName });

      if (!storeId || !channel) {
        return res.status(400).json({ error: "storeId and channel are required" });
      }
      
      if (!packetId && !templateId && !graphicsId) {
        return res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" });
      }

      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../../lib/firebase-admin")).getFirebaseAdmin();

      // ── Assembly guard: packet must be linked to an assembly before store assignment ──
      let resolvedAssemblyId: string | null = bodyAssemblyId || null;
      if (packetId) {
        const packetDoc = await firestoreDb.collection("productPackets").doc(packetId).get();
        if (!packetDoc.exists) {
          return res.status(404).json({ error: `Packet ${packetId} not found` });
        }
        const packetData = packetDoc.data() as any;
        resolvedAssemblyId = packetData.assemblyId || bodyAssemblyId || null;
        if (!resolvedAssemblyId) {
          return res.status(400).json({ error: "Cannot assign to store — packet is missing an assembly. Complete the QRG → BLD → GRF chain in the Library first." });
        }
      }
      // ── end assembly guard ────────────────────────────────────────────────────────────
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const linkData = {
        storeId,
        storeName: storeName || "",
        channel,
        collection: collection || null,
        packetId: packetId || null,
        templateId: templateId || null,
        graphicsId: graphicsId || null,
        qrContent: qrContent || null,
        productName: productName || null,
        compositeUrl: compositeUrl || null,
        qrOnlyUrl: qrOnlyUrl || null,
        pricing: pricing || null,
        enabledColors: enabledColors || [],
        enabledSizes: enabledSizes || [],
        selectedGraphicSize: selectedGraphicSize || null,
        defaultColor: defaultColor || null,
        qrProductState: qrProductState || null,
        landingPageUrl: landingPageUrl || null,
        mockupUrl: mockupUrl || null,
        assemblyId: resolvedAssemblyId,
        createdAt: now,
        updatedAt: now,
      };
      
      const linkRef = await firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION).add(linkData);
      
      console.log(`[Store Links] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);

      res.json({
        success: true,
        linkId: linkRef.id,
        message: `Product linked to ${storeName || storeId} / ${channel}`,
      });
    } catch (error: any) {
      console.error("[Store Links] Error creating link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mockup/priority", isAdmin, async (req: any, res) => {
    try {
      const {
        blueprintId, printProviderId, colorName, colorHex,
        placement, selectedPlacements,
        artworkUrl, qrSize = "medium",
        fulfillmentProvider = "printify"
      } = req.body;

      if (!blueprintId || !colorName || !artworkUrl) {
        return res.status(400).json({
          error: "Missing required fields: blueprintId, colorName, artworkUrl"
        });
      }

      // Support both legacy single `placement` and new `selectedPlacements` array
      const placementsToGenerate: string[] = Array.isArray(selectedPlacements) && selectedPlacements.length > 0
        ? selectedPlacements
        : [placement || 'front'];

      console.log(`[Priority Mockup] Generating for: ${colorName} @ [${placementsToGenerate.join(', ')}], provider: ${fulfillmentProvider}`);

      const { getMockupWithFallback } = await import("../../lib/mockup-service");
      const storage = (await import("../../storage")).storage;

      const placementResults: Record<string, { mockupUrl: string; lifestyleMockupUrl?: string | null }> = {};
      for (const canonicalPlacement of placementsToGenerate) {
        try {
          const result = await getMockupWithFallback({
            blueprintId: parseInt(blueprintId),
            printProviderId: parseInt(printProviderId) || 99,
            colorName,
            colorHex,
            canonicalPlacementId: canonicalPlacement,
            artworkUrl,
            artworkVariant: "black",
            qrSize: qrSize as 'small' | 'medium' | 'large',
            fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
          }, storage);
          console.log(`[Priority Mockup] Generated for ${canonicalPlacement}: ${result.mockupUrl} (cached: ${result.fromCache})`);
          placementResults[canonicalPlacement] = {
            mockupUrl: result.mockupUrl,
            lifestyleMockupUrl: result.lifestyleMockupUrl,
          };
        } catch (placementErr: any) {
          console.warn(`[Priority Mockup] Skipping placement ${canonicalPlacement}: ${placementErr.message}`);
        }
      }

      const primaryPlacement = placementsToGenerate.find(p => placementResults[p]) || Object.keys(placementResults)[0];
      const primaryResult = primaryPlacement ? placementResults[primaryPlacement] : null;

      if (!primaryResult?.mockupUrl) {
        throw new Error('Mockup generation failed for all placements');
      }

      const placementMockupUrls: Record<string, string> = {};
      for (const [p, r] of Object.entries(placementResults)) {
        if (r.mockupUrl) placementMockupUrls[p] = r.mockupUrl;
      }

      res.json({
        success: true,
        mockupUrl: primaryResult.mockupUrl,
        lifestyleMockupUrl: primaryResult.lifestyleMockupUrl,
        placementMockupUrls,
        fromCache: false,
      });
    } catch (error: any) {
      console.error("[Priority Mockup] Error:", error);
      res.json({
        success: false,
        error: error.message,
        mockupUrl: null,
        message: "Mockup generation in progress - check back shortly",
      });
    }
  });

  app.get("/api/admin/store-product-links", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const links = linksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      console.log(`[Store Links TEST] Listed ${links.length} total links`);
      res.json({ success: true, links, count: links.length });
    } catch (error: any) {
      console.error("[Store Links TEST] Error listing links:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/store-product-links", isAdmin, async (req: any, res) => {
    try {
      const { 
        storeId, storeName, channel, collection, packetId, templateId, graphicsId, 
        qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
        enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
        qrProductState, landingPageUrl, mockupUrl, assemblyId: bodyAssemblyId
      } = req.body;

      console.log("[Store Links TEST] Creating link:", { storeId, channel, packetId, templateId, productName });

      if (!storeId || !channel) {
        return res.status(400).json({ error: "storeId and channel are required" });
      }
      
      if (!packetId && !templateId && !graphicsId) {
        return res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" });
      }

      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../../lib/firebase-admin")).getFirebaseAdmin();

      // ── Assembly guard: packet must be linked to an assembly before store assignment ──
      let resolvedAssemblyId: string | null = bodyAssemblyId || null;
      if (packetId) {
        const packetDoc = await firestoreDb.collection("productPackets").doc(packetId).get();
        if (!packetDoc.exists) {
          return res.status(404).json({ error: `Packet ${packetId} not found` });
        }
        const packetData = packetDoc.data() as any;
        resolvedAssemblyId = packetData.assemblyId || bodyAssemblyId || null;
        if (!resolvedAssemblyId) {
          return res.status(400).json({ error: "Cannot assign to store — packet is missing an assembly. Complete the QRG → BLD → GRF chain in the Library first." });
        }
      }
      // ── end assembly guard ────────────────────────────────────────────────────────────
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const linkData = {
        storeId,
        storeName: storeName || "",
        channel,
        collection: collection || null,
        packetId: packetId || null,
        templateId: templateId || null,
        graphicsId: graphicsId || null,
        qrContent: qrContent || null,
        productName: productName || null,
        compositeUrl: compositeUrl || null,
        qrOnlyUrl: qrOnlyUrl || null,
        pricing: pricing || null,
        enabledColors: enabledColors || [],
        enabledSizes: enabledSizes || [],
        selectedGraphicSize: selectedGraphicSize || null,
        defaultColor: defaultColor || null,
        qrProductState: qrProductState || null,
        landingPageUrl: landingPageUrl || null,
        mockupUrl: mockupUrl || null,
        assemblyId: resolvedAssemblyId,
        createdAt: now,
        updatedAt: now,
      };
      
      const linkRef = await firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION).add(linkData);
      
      console.log(`[Store Links TEST] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);

      res.json({
        success: true,
        linkId: linkRef.id,
        message: `Product linked to ${storeName || storeId} / ${channel}`,
      });
    } catch (error: any) {
      console.error("[Store Links TEST] Error creating link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/stores/:storeId/channels/:channelId/products", isAdmin, async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION)
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .get();

      const products = linksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          linkId: doc.id,
          packetId: data.packetId || null,
          templateId: data.templateId || null,
          name: data.productName || "Untitled Product",
          imageUrl: data.compositeUrl || data.qrOnlyUrl || null,
          mockupUrl: data.mockupUrl || null,
          qrContent: data.qrContent || null,
          pricing: data.pricing || null,
          enabledColors: data.enabledColors || [],
          enabledSizes: data.enabledSizes || [],
          selectedGraphicSize: data.selectedGraphicSize || null,
          defaultColor: data.defaultColor || null,
          collection: data.collection || null,
          qrProductState: data.qrProductState || null,
          landingPageUrl: data.landingPageUrl || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      console.log(`[Store Links TEST] Found ${products.length} products for ${storeId}/${channelId}`);

      res.json(products);
    } catch (error: any) {
      console.error("[Store Links TEST] Error getting products:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/store-product-links/:linkId", isAdmin, async (req: any, res) => {
    try {
      const { linkId } = req.params;
      const updates = req.body;

      if (!linkId) {
        return res.status(400).json({ error: "linkId is required" });
      }

      const { getFirestoreDb, FieldValue } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION).doc(linkId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Link not found" });
      }

      await docRef.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`[Store Links PATCH] Updated link ${linkId}:`, Object.keys(updates));

      res.json({
        success: true,
        linkId,
        message: "Link updated",
      });
    } catch (error: any) {
      console.error("[Store Links PATCH] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/store-product-links/:linkId", isAdmin, async (req: any, res) => {
    try {
      const { linkId } = req.params;

      if (!linkId) {
        return res.status(400).json({ error: "linkId is required" });
      }

      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION).doc(linkId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Link not found" });
      }

      await docRef.delete();
      
      console.log(`[Store Links DELETE] Deleted link ${linkId}`);

      res.json({
        success: true,
        linkId,
        message: "Link deleted",
      });
    } catch (error: any) {
      console.error("[Store Links DELETE] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/store/products", async (req, res) => {
    try {
      const products = await storage.getEnabledProducts();
      const safeProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        imageUrl: p.imageUrl,
        manufacturer: p.manufacturer,
        madeInUSA: p.madeInUSA,
        availablePlacements: p.availablePlacements,
        availableColors: p.availableColors,
      }));
      res.json(safeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
