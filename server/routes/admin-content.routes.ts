import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { fsGetAll, fsGet, fsInsert, fsUpdate, fsDelete, fsQuery } from "../lib/firestore-crud";
import { QR_DYNAMICS_INSTANCES_COLLECTION } from "../lib/constants";
import { registerAdminCatalogsShelfRoutes } from "./admin-catalogs-shelf.routes";
import {
  isValidGrfId, isValidGraphicId, buildGrfId, parseGrfId, grfStoragePath,
  GRF_COUNTER_KEY,
} from "../../shared/GRF_engine";
import type { GrfAssetClass, GrfMediaType, GrfChannel } from "../../shared/GRF_engine";

export function registerAdminContentRoutes(app: Express): void {
  registerAdminCatalogsShelfRoutes(app);

  app.get("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const storeProducts = await storage.getPartnerStoreProducts(req.params.id);
      
      const enrichedProducts = await Promise.all(
        storeProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          return {
            ...sp,
            availableSizes: product?.availableSizes || [],
            availableColors: product?.availableColors || [],
          };
        })
      );
      
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const { productIds } = req.body;
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ error: "productIds must be an array" });
      }
      await storage.syncPartnerStoreProducts(req.params.id, productIds);
      const products = await storage.getPartnerStoreProducts(req.params.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/partner-stores/:storeId/products/:productId", isAdmin, async (req: any, res) => {
    try {
      const { storeId, productId } = req.params;
      const { enabledSizes, enabledColors, defaultColor, kcPlacements, kcBusinessSlug, customPrice, customName, isEnabled } = req.body;
      
      const updated = await storage.updatePartnerStoreProductByIds(storeId, productId, {
        enabledSizes,
        enabledColors,
        defaultColor,
        kcPlacements,
        kcBusinessSlug,
        customPrice,
        customName,
        isEnabled,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Partner store product not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores/:storeId/products/:productId/generate-mockup", isAdmin, async (req: any, res) => {
    try {
      const { storeId, productId } = req.params;
      const { color, qrSize = 'medium' } = req.body;

      if (!color) {
        return res.status(400).json({ error: "color is required" });
      }

      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const blueprintId = product.blueprintId;
      const printProviderId = product.printProviderId;
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }

      // Resolve color hex and determine artwork variant (white QR on dark shirts)
      const { getProviderColorsWithFallback } = await import("../lib/printify");
      const colors = await getProviderColorsWithFallback(blueprintId, printProviderId, storage);
      const colorInfo = colors.find((c: any) => c.name?.toLowerCase() === color.toLowerCase());
      const colorHex = colorInfo?.hex || '#000000';
      const { isColorDark } = await import('../lib/composite-image-generator.js');
      const needsWhiteQR = isColorDark(colorHex);
      const artworkVariant: 'white' | 'black' = needsWhiteQR ? 'white' : 'black';

      // Map design placement keys to canonical placement IDs used by getMockupWithFallback
      const DESIGN_KEY_TO_CANONICAL: Record<string, string> = {
        'front': 'front',
        'front-chest': 'front',
        'front-chest-black': 'front',
        'back': 'back',
        'back-center': 'back',
        'left_sleeve': 'left_sleeve',
        'sleeve_left': 'left_sleeve',
        'right_sleeve': 'right_sleeve',
        'sleeve_right': 'right_sleeve',
      };

      // Build canonical placement → artwork URL map from the design's placementImages
      const placementArtworkMap: Record<string, string> = {};

      if (productId.startsWith('custom_')) {
        const designId = productId.replace('custom_', '');
        const design = await storage.getCustomDesign(designId);
        if (design) {
          let designPlacements: Record<string, string> = {};
          try {
            if (typeof design.placementImages === 'string') {
              designPlacements = JSON.parse(design.placementImages);
            } else if (design.placementImages && typeof design.placementImages === 'object') {
              designPlacements = design.placementImages as Record<string, string>;
            }
          } catch (e) {
            console.error('[PartnerMockup] Failed to parse placementImages:', e);
          }

          // Iterate non-white keys first to populate each canonical placement
          for (const [key, url] of Object.entries(designPlacements)) {
            if (key.includes('white') || !url) continue;
            const canonical = DESIGN_KEY_TO_CANONICAL[key];
            if (canonical && !placementArtworkMap[canonical]) {
              // If color is dark, prefer a white-QR variant for this placement if one exists
              if (needsWhiteQR) {
                const whiteUrl = designPlacements[`${key}-white`] || designPlacements[key.replace('black', 'white')];
                placementArtworkMap[canonical] = whiteUrl || url;
              } else {
                placementArtworkMap[canonical] = url;
              }
            }
          }

          // Handle explicit front-white key (common pattern)
          if (needsWhiteQR) {
            const explicitWhite = designPlacements['front-white'] || designPlacements['front-chest-white'];
            if (explicitWhite) placementArtworkMap['front'] = explicitWhite;
          }

          // Fallback: no recognized placements — use composite or first available artwork
          if (Object.keys(placementArtworkMap).length === 0) {
            const fallback = design.printifyCompositeUrl || (Object.values(designPlacements)[0] as string | undefined);
            if (fallback) placementArtworkMap['front'] = fallback;
          }
        }
      }

      if (Object.keys(placementArtworkMap).length === 0) {
        return res.status(400).json({ error: "No artwork found for this product" });
      }

      console.log(`[PartnerMockup] Generating for ${color} (${colorHex}), placements: [${Object.keys(placementArtworkMap).join(', ')}]`);

      // Generate via getMockupWithFallback — handles Printful mockup tasks, caching, permanent URLs
      const { getMockupWithFallback } = await import("../lib/mockup-service");
      const storageModule = (await import("../storage")).storage;
      const fulfillmentProvider = ((product as any).fulfillmentProvider || 'printify') as 'printify' | 'printful';

      const placementResults: Record<string, { mockupUrl: string; lifestyleMockupUrl?: string | null }> = {};
      for (const [canonicalPlacement, artworkUrl] of Object.entries(placementArtworkMap)) {
        try {
          const result = await getMockupWithFallback({
            blueprintId: parseInt(blueprintId as any),
            printProviderId: parseInt(printProviderId as any) || 99,
            colorName: color,
            colorHex,
            canonicalPlacementId: canonicalPlacement,
            artworkUrl,
            artworkVariant,
            qrSize: qrSize as 'small' | 'medium' | 'large',
            fulfillmentProvider,
          }, storageModule);
          console.log(`[PartnerMockup] ${canonicalPlacement} done: ${result.mockupUrl}`);
          placementResults[canonicalPlacement] = {
            mockupUrl: result.mockupUrl,
            lifestyleMockupUrl: result.lifestyleMockupUrl,
          };
        } catch (placementErr: any) {
          console.warn(`[PartnerMockup] Skipping ${canonicalPlacement}: ${placementErr.message}`);
        }
      }

      const primaryPlacement = ['front', ...Object.keys(placementResults)].find(p => placementResults[p]) || '';
      const primaryResult = primaryPlacement ? placementResults[primaryPlacement] : null;
      if (!primaryResult?.mockupUrl) {
        return res.status(500).json({ error: 'Mockup generation failed for all placements' });
      }

      const placementMockupUrls: Record<string, string> = {};
      for (const [p, r] of Object.entries(placementResults)) {
        if (r.mockupUrl) placementMockupUrls[p] = r.mockupUrl;
      }

      // Persist: update mockupsByColor with full placement data
      const storeProduct = await storage.getPartnerStoreProduct(storeId, productId);
      const existingMockups = (storeProduct?.mockupsByColor as Record<string, any>) || {};
      existingMockups[color] = {
        front: placementMockupUrls['front'] || null,
        back: placementMockupUrls['back'] || null,
        left_sleeve: placementMockupUrls['left_sleeve'] || null,
        right_sleeve: placementMockupUrls['right_sleeve'] || null,
        lifestyle: primaryResult.lifestyleMockupUrl || null,
        placementMockupUrls,
      };

      await storage.updatePartnerStoreProductByIds(storeId, productId, {
        mockupsByColor: existingMockups,
      });

      console.log(`[PartnerMockup] Saved ${Object.keys(placementMockupUrls).length} placement mockup(s) for ${color}`);
      res.json({
        success: true,
        color,
        mockupUrl: primaryResult.mockupUrl,
        lifestyleMockupUrl: primaryResult.lifestyleMockupUrl,
        placementMockupUrls,
        mockupsByColor: existingMockups,
      });
    } catch (error: any) {
      console.error("[PartnerMockup] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/published-compose-items", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('packets')
        .where('status', '==', 'published')
        .get();
      const items = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => ['qr-canvas', 'qr-play'].includes(p.packetType || p.type));
      res.json({ items });
    } catch (error: any) {
      console.error("[ComposeItems] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/compose/publish", isAdmin, async (req: any, res) => {
    try {
      const { composeItems, composeMode, composeHostingTerm, productId, blueprintId, color, colorHex } = req.body;
      if (!composeItems || !Array.isArray(composeItems) || composeItems.length === 0) {
        return res.status(400).json({ error: 'At least one compose item is required' });
      }
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const nowEpoch = Math.floor(Date.now() / 1000);
      const instanceData = {
        createdAt: nowEpoch,
        startTimestamp: nowEpoch,
        mode: composeMode || 'auto-rotate',
        hostingTerm: composeHostingTerm || '1-year',
        productId: productId || null,
        blueprintId: blueprintId || null,
        color: color || null,
        colorHex: colorHex || null,
        slots: composeItems.map((item: any, index: number) => ({
          slotId: item.slotId || `slot-${Date.now()}-${index}`,
          packetId: item.packetId || item.id,
          durationSeconds: item.durationSeconds || 86400,
          order: item.order ?? index + 1,
        })),
      };
      const docRef = await fsDb.collection(QR_DYNAMICS_INSTANCES_COLLECTION).add(instanceData);
      console.log(`[ComposePublish] Created instance ${docRef.id} with ${composeItems.length} slots`);
      res.json({ success: true, instanceId: docRef.id, composeInstanceId: docRef.id });
    } catch (error: any) {
      console.error("[ComposePublish] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── GRF asset routes (mirrors functions/src/routes/file-routes.ts) ──────────

  app.post("/api/admin/graphics/save-grf", isAdmin, async (req: any, res) => {
    try {
      const {
        assetClass, mediaType, channel, purpose, format,
        imageUrl, name, description, mimeType, storagePath,
        sourceGrfId, relatedPacketId, tags, originalFilename,
      } = req.body;

      if (!assetClass || !mediaType || !channel || !purpose || !format || !imageUrl) {
        return res.status(400).json({ error: "Missing required fields: assetClass, mediaType, channel, purpose, format, imageUrl" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const counterRef = db.collection("grf_counters").doc(GRF_COUNTER_KEY);
      let newSeq = 0;
      await db.runTransaction(async (tx: any) => {
        const doc = await tx.get(counterRef);
        newSeq = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
        tx.set(counterRef, { count: newSeq, updatedAt: FieldValue.serverTimestamp() });
      });

      let grfId: string;
      try {
        grfId = buildGrfId({
          assetClass: assetClass as GrfAssetClass,
          mediaType: mediaType as GrfMediaType,
          channel: channel as GrfChannel,
          purpose,
          format,
          sequence: newSeq,
        });
      } catch (e: any) {
        return res.status(400).json({ error: `Invalid GRF params: ${e.message}` });
      }

      const parsed = parseGrfId(grfId);

      const existingAsset = await db.collection("grf_assets").doc(grfId).get();
      if (existingAsset.exists) {
        console.error(`[GRF] Counter integrity violation — ${grfId} already exists.`);
        return res.status(500).json({ error: `GRF counter integrity error: ${grfId} was already assigned. Do not retry — contact admin to inspect grf_counters/${GRF_COUNTER_KEY}.` });
      }

      const now = FieldValue.serverTimestamp();
      const canonicalStoragePath = storagePath || grfStoragePath(grfId);

      // If imageUrl is a base64 data URI, upload to Firebase Storage and use the public GCS URL
      let publicUrl = imageUrl;
      if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
        const { getStorageBucket, getStorageBucketName } = await import("../lib/firebase-admin");
        const bucket = getStorageBucket();
        const bucketName = getStorageBucketName();
        const base64Data = imageUrl.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const storageFile = bucket.file(canonicalStoragePath);
        await storageFile.save(buffer, { metadata: { contentType: mimeType || 'image/jpeg' } });
        await storageFile.makePublic();
        const encodedPath = canonicalStoragePath.split('/').map(encodeURIComponent).join('/');
        publicUrl = `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
        console.log(`[GRF] Uploaded base64 → Storage: ${publicUrl}`);
      }

      const assetData: Record<string, any> = {
        grfId,
        assetClass:     parsed.assetClass,
        mediaType:      parsed.mediaType,
        channel:        parsed.channel,
        purpose:        parsed.purpose,
        format:         parsed.format,
        sequence:       parsed.sequence,
        assetClassName: parsed.assetClassName,
        mediaTypeName:  parsed.mediaTypeName,
        channelName:    parsed.channelName,
        purposeName:    parsed.purposeName,
        formatName:     parsed.formatName,
        mimeType:       mimeType || parsed.mimeType,
        name:           name || `${parsed.purposeName} ${grfId}`,
        description:    description || null,
        storagePath:    canonicalStoragePath,
        publicUrl,
        sourceGrfId:    sourceGrfId    || null,
        relatedPacketId: relatedPacketId || null,
        tags:           tags            || null,
        createdAt:      now,
        createdBy:      "admin",
        isActive:       true,
      };

      // Preserve original filename for assets-channel originals (D3=4, D4=1)
      if (parsed.channel === '4' && parsed.purpose === '1') {
        assetData.originalFilename = originalFilename || null;
      }

      await db.collection("grf_assets").doc(grfId).set(assetData);
      const doc = await db.collection("grf_assets").doc(grfId).get();
      const saved = { id: doc.id, ...doc.data() };

      console.log(`[GRF] Minted ${grfId} → grf_assets/${grfId}`);
      res.json({ success: true, grfId, asset: saved });
    } catch (error: any) {
      console.error("[GRF] Error saving graphic:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/graphics", isAdmin, async (req: any, res) => {
    try {
      const { assetClass, mediaType, channel, purpose, format } = req.query;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const snapshot = await db.collection("grf_assets").where("isActive", "==", true).get();
      const getTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val === "string") return new Date(val).getTime() || 0;
        if (val.toDate) return val.toDate().getTime();
        if (val._seconds) return val._seconds * 1000;
        return 0;
      };
      const assets = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((a: any) =>
          (!assetClass  || a.assetClass  === assetClass)  &&
          (!mediaType   || a.mediaType   === mediaType)   &&
          (!channel     || a.channel     === channel)     &&
          (!purpose     || a.purpose     === purpose)     &&
          (!format      || a.format      === format)
        )
        .sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt));

      res.json(assets);
    } catch (error: any) {
      console.error("[GRF] Error fetching graphics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/graphics/:grfId/archive", isAdmin, async (req: any, res) => {
    try {
      const { grfId } = req.params;
      if (!isValidGraphicId(grfId)) {
        return res.status(400).json({ error: `Invalid GRF ID format: ${grfId}` });
      }
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const docRef = db.collection("grf_assets").doc(grfId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: `GRF asset not found: ${grfId}` });
      }
      await docRef.update({ isActive: false, archivedAt: FieldValue.serverTimestamp() });
      console.log(`[GRF] Archived ${grfId}`);
      res.json({ success: true, grfId });
    } catch (error: any) {
      console.error("[GRF] Error archiving graphic:", error);
      res.status(500).json({ error: error.message });
    }
  });

}
