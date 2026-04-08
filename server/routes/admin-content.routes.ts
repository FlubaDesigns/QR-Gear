import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { fsGetAll, fsGet, fsInsert, fsUpdate, fsDelete, fsQuery } from "../lib/firestore-crud";
import { QR_DYNAMICS_INSTANCES_COLLECTION } from "../lib/constants";
import { registerAdminCatalogsShelfRoutes } from "./admin-catalogs-shelf.routes";

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
      const { color } = req.body;
      
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
      
      let artworkUrl: string | null = null;
      
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
            console.error('[Mockup] Failed to parse placementImages:', e);
          }
          
          const { getProviderColorsWithFallback } = await import("../lib/printify");
          const colors = await getProviderColorsWithFallback(blueprintId, printProviderId, storage);
          const colorInfo = colors.find(
            (c: any) => c.name?.toLowerCase() === color.toLowerCase()
          );
          const colorHex = colorInfo?.hex || null;
          
          const { isColorDark } = await import('../lib/composite-image-generator.js');
          
          const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
          
          const blackArtwork = designPlacements["front"] || designPlacements["front-chest"] || designPlacements["front-chest-black"];
          const whiteArtwork = designPlacements["front-white"] || designPlacements["front-chest-white"];
          
          if (needsWhiteQR && whiteArtwork) {
            artworkUrl = whiteArtwork;
            console.log(`[Mockup] Using WHITE artwork for dark shirt color: ${color} (${colorHex})`);
          } else if (blackArtwork) {
            artworkUrl = blackArtwork;
            console.log(`[Mockup] Using BLACK artwork for light shirt color: ${color} (${colorHex})`);
          } else {
            artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
          }
        }
      }
      
      if (!artworkUrl) {
        return res.status(400).json({ error: "No artwork found for this product" });
      }
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const absoluteArtworkUrl = artworkUrl.startsWith('http') ? artworkUrl : `${baseUrl}${artworkUrl}`;
      
      console.log(`[Mockup] Generating for product ${productId}, color ${color}`);
      console.log(`[Mockup] Blueprint: ${blueprintId}, Provider: ${printProviderId}`);
      console.log(`[Mockup] Artwork: ${absoluteArtworkUrl}`);
      
      const { printify: printifyClient, syncProductVariants: syncVariants, syncProductPlacements: syncPlacements } = await import("../lib/printify");
      
      const { variants } = await syncVariants(blueprintId, printProviderId);
      const colorVariants = variants.filter(v => 
        v.options?.color && v.options.color.toLowerCase() === color.toLowerCase()
      );
      
      if (colorVariants.length === 0) {
        return res.status(400).json({ error: `No variants found for color: ${color}` });
      }
      
      const variantIds = colorVariants.slice(0, 1).map(v => v.id);
      console.log(`[Mockup] Found ${colorVariants.length} variants for ${color}, using: ${variantIds[0]}`);
      
      const imageUpload = await printifyClient.uploadImage(absoluteArtworkUrl, `mockup-${productId}-${color}.png`);
      console.log(`[Mockup] Uploaded image ID: ${imageUpload.id}`);
      
      const { placements: providerPlacements } = await syncPlacements(blueprintId, printProviderId);
      const placement = providerPlacements[0]?.position || "front";
      
      const productData = {
        title: `Mockup - ${product.name} - ${color}`,
        description: `Mockup generation for ${color}`,
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: variantIds.map(vid => ({
          id: vid,
          price: 2500,
          is_enabled: true,
        })),
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{
            position: placement,
            images: [{
              id: imageUpload.id,
              x: 0.5,
              y: 0.5,
              scale: 1.0,
              angle: 0,
            }],
          }],
        }],
      };
      
      const printifyProduct = await printifyClient.createProduct(productData);
      console.log(`[Mockup] Created Printify product: ${printifyProduct.id}`);
      
      let attempts = 0;
      const maxAttempts = 10;
      let mockupUrl: string | null = null;
      
      while (attempts < maxAttempts && !mockupUrl) {
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
        
        const productDetails = await printifyClient.getProduct(printifyProduct.id);
        if (productDetails.images && productDetails.images.length > 0) {
          mockupUrl = productDetails.images[0].src;
          console.log(`[Mockup] Got mockup URL: ${mockupUrl}`);
        }
      }
      
      if (!mockupUrl) {
        await printifyClient.deleteProduct(printifyProduct.id).catch(() => {});
        return res.status(500).json({ error: "Mockup generation timed out" });
      }
      
      const storeProduct = await storage.getPartnerStoreProduct(storeId, productId);
      const existingMockups = (storeProduct?.mockupsByColor as Record<string, any>) || {};
      existingMockups[color] = { front: mockupUrl };
      
      await storage.updatePartnerStoreProductByIds(storeId, productId, {
        mockupsByColor: existingMockups,
      });
      
      await printifyClient.deleteProduct(printifyProduct.id).catch(() => {});
      
      console.log(`[Mockup] Saved mockup for ${color}`);
      res.json({ success: true, color, mockupUrl, mockupsByColor: existingMockups });
    } catch (error: any) {
      console.error("[Mockup] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/graphics/save", isAdmin, async (req, res) => {
    try {
      const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId, qrContent, pricing } = req.body;

      const baseMetadata: Record<string, any> = {};
      if (storeId) baseMetadata.storeId = storeId;
      if (channelId) baseMetadata.channelId = channelId;
      if (qrContent) baseMetadata.qrContent = qrContent;
      if (pricing) baseMetadata.pricing = pricing;

      let qrAsset = null;
      let compositeAsset = null;

      if (qrOnlyUrl) {
        qrAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - QR Only`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: qrOnlyUrl,
          storageUrl: qrOnlyUrl,
          thumbnailUrl: qrOnlyUrl,
          fileName: `qr-only-${Date.now()}.png`,
          originalName: `qr-only.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "qr-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isQrOnly: true },
        } as any);
      }

      if (compositeUrl) {
        compositeAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - Composite`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: compositeUrl,
          storageUrl: compositeUrl,
          thumbnailUrl: compositeUrl,
          fileName: `composite-${Date.now()}.png`,
          originalName: `composite.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "composite-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isComposite: true },
        } as any);
      }

      const savedParts = [qrAsset ? 'QR' : null, compositeAsset ? 'Composite' : null].filter(Boolean).join(' + ');
      console.log(`[Graphics] Saved graphics: ${savedParts}`);

      res.json({
        success: true,
        qrAsset,
        compositeAsset,
        qrAssetId: qrAsset?.id,
        compositeAssetId: compositeAsset?.id,
        message: "Graphics saved to library",
      });
    } catch (error: any) {
      console.error("[Graphics] Save error:", error);
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

}
