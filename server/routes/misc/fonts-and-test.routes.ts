import type { Express } from "express";
import { storage } from "../../storage";
import { isAdmin } from "../../firebaseAuth";
import { fsCount, fsGetAll } from "../../lib/firestore-crud";
import { normalizePlacements } from '../../../shared/placements';
import { PRODUCT_PACKETS_COLLECTION } from "../../lib/constants";

export function registerFontsAndTestRoutes(app: Express): void {

  const DEFAULT_FONTS = [
    "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
    "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS", "Palatino Linotype",
  ];

  app.get("/api/fonts", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const doc = await fsDb.collection('settings').doc('fonts').get();
      if (doc.exists) {
        const data = doc.data();
        res.json({ fonts: data?.fonts || DEFAULT_FONTS });
      } else {
        res.json({ fonts: DEFAULT_FONTS });
      }
    } catch (error: any) {
      console.error('[Fonts] GET error:', error);
      res.json({ fonts: DEFAULT_FONTS });
    }
  });

  app.put("/api/admin/fonts", isAdmin, async (req: any, res) => {
    try {
      const { fonts } = req.body;
      if (!Array.isArray(fonts)) return res.status(400).json({ error: 'fonts must be an array' });
      const cleanFonts = fonts.filter((f: any) => typeof f === 'string' && f.trim()).map((f: string) => f.trim());
      if (cleanFonts.length === 0) return res.status(400).json({ error: 'At least one font is required' });
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('settings').doc('fonts').set({ fonts: cleanFonts, updatedAt: new Date().toISOString() });
      res.json({ success: true, fonts: cleanFonts });
    } catch (error: any) {
      console.error('[Fonts] PUT error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/provider-counts", isAdmin, async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET provider counts');
      
      const printifyCount = await fsCount('printify_print_providers');
      const printfulCount = await fsCount('printful_products');
      
      const counts = {
        printify: printifyCount,
        printful: printfulCount,
      };
      
      console.log(`[TestCatalog] Provider counts:`, counts);
      res.json(counts);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/sync-blueprints-to-firestore", isAdmin, async (req: any, res) => {
    try {
      console.log('[Sync] Starting blueprint sync to Firestore...');
      const FirestoreAdapter = (await import("../../lib/firestore-adapter")).FirestoreAdapter;
      
      const allBlueprints = await fsGetAll('printify_blueprints');
      console.log(`[Sync] Found ${allBlueprints.length} blueprints to sync`);
      
      const firestoreAdapter = new FirestoreAdapter();
      let synced = 0;
      let errors = 0;
      
      for (const blueprint of allBlueprints) {
        try {
          await firestoreAdapter.upsertPrintifyBlueprint({
            id: blueprint.id,
            title: blueprint.title,
            description: blueprint.description,
            brand: blueprint.brand,
            model: blueprint.model,
            images: blueprint.images,
            primaryImageUrl: blueprint.primaryImageUrl,
            category: blueprint.category,
          });
          synced++;
        } catch (e: any) {
          console.error(`[Sync] Error syncing blueprint ${blueprint.id}:`, e.message);
          errors++;
        }
      }
      
      console.log(`[Sync] Complete: ${synced} blueprints synced, ${errors} errors`);
      res.json({ success: true, synced, errors, total: allBlueprints.length });
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/sync-providers-to-firestore", isAdmin, async (req: any, res) => {
    try {
      console.log('[Sync] Starting provider sync to Firestore...');
      const FirestoreAdapter = (await import("../../lib/firestore-adapter")).FirestoreAdapter;
      
      const allProviders = await fsGetAll('printify_print_providers');
      console.log(`[Sync] Found ${allProviders.length} providers to sync`);
      
      const firestoreAdapter = new FirestoreAdapter();
      let synced = 0;
      let errors = 0;
      
      for (const provider of allProviders) {
        try {
          await firestoreAdapter.upsertPrintifyPrintProvider({
            ...provider,
            availableColors: provider.availableColors as any,
          });
          synced++;
        } catch (e: any) {
          console.error(`[Sync] Error syncing ${provider.blueprintId}/${provider.providerId}:`, e.message);
          errors++;
        }
      }
      
      console.log(`[Sync] Complete: ${synced} synced, ${errors} errors`);
      res.json({ success: true, synced, errors, total: allProviders.length });
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/product-configs", isAdmin, async (req: any, res) => {
    try {
      console.log('[TestProductConfigs] GET real product configs');
      
      const allProducts = await storage.getAllProducts();
      
      const enrichedProducts = await Promise.all(
        allProducts.filter(p => p.isEnabled).map(async (product) => {
          const assignments = await storage.getProductCategoryAssignments(product.id);
          
          let cachedMinCost: number | null = null;
          let cachedMaxCost: number | null = null;
          let providerColors: Array<{name: string; hex: string}> | null = null;
          let providerSizes: string[] | null = null;
          if (product.blueprintId && product.printProviderId) {
            const provider = await storage.getPrintifyPrintProvider(
              product.blueprintId,
              product.printProviderId
            );
            if (provider?.minCost) {
              cachedMinCost = Number(provider.minCost) / 100;
              cachedMaxCost = provider.maxCost ? Number(provider.maxCost) / 100 : cachedMinCost;
            }
            if (provider?.availableColors && Array.isArray(provider.availableColors)) {
              providerColors = provider.availableColors as Array<{name: string; hex: string}>;
            }
            if (provider?.availableSizes && Array.isArray(provider.availableSizes)) {
              providerSizes = provider.availableSizes as string[];
            }
          }
          
          const meta = product.metadata as Record<string, unknown> | null;
          const savedEnabledSizes = meta?.enabledSizes as string[] | undefined;
          const savedEnabledColors = meta?.enabledColors as string[] | undefined;
          const defaultColor = meta?.defaultColor as string | undefined;
          
          const finalColors = providerColors || (product.availableColors as Array<{name: string; hex: string}>) || [];
          const finalSizes = providerSizes || (product.availableSizes as string[]) || [];
          
          const mockupsByColor = (product as any).mockupsByColor as Record<string, { front?: string; lifestyle?: string }> | undefined;
          
          return {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            sizes: finalSizes,
            colors: finalColors,
            enabledSizes: savedEnabledSizes || finalSizes,
            enabledColors: savedEnabledColors || finalColors.map(c => c.name),
            defaultColor: defaultColor || (finalColors.length > 0 ? finalColors[0].name : null),
            mockupsByColor: mockupsByColor || {},
            categoryIds: assignments.map((a) => a.categoryId),
            cachedMinCost,
            cachedMaxCost,
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId,
          };
        })
      );
      
      console.log(`[TestProductConfigs] Returning ${enrichedProducts.length} enriched products`);
      res.json(enrichedProducts);
    } catch (error: any) {
      console.error('[TestProductConfigs] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/products/:id/options", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabledSizes, enabledColors, defaultColor } = req.body;
      
      console.log(`[TestProductOptions] PATCH ${id}:`, { enabledSizes, enabledColors, defaultColor });
      
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const existingMetadata = (currentProduct.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...existingMetadata,
        enabledSizes,
        enabledColors,
        defaultColor,
      };
      
      const product = await storage.updateProduct(id, { metadata: newMetadata });
      res.json(product);
    } catch (error: any) {
      console.error('[TestProductOptions] PATCH error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/:id/sync-printify", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing Printify blueprint or provider IDs" });
      }
      
      console.log(`[TestProductSync] Syncing product ${product.id}`);
      
      const { syncProductPlacements, syncProductVariants } = await import("../../lib/printify");
      
      const { placements, mockupImageUrl } = await syncProductPlacements(
        product.blueprintId,
        product.printProviderId
      );
      
      const { colors, sizes, variants } = await syncProductVariants(
        product.blueprintId,
        product.printProviderId
      );
      
      for (const variant of variants) {
        await storage.upsertProductVariant({
          productId: product.id,
          printifyVariantId: variant.id,
          title: variant.title,
          size: variant.options?.size || null,
          color: variant.options?.color || null,
          colorHex: variant.options?.color ? colors.find(c => c.name === variant.options?.color)?.hex || null : null,
          price: String((variant.price || 0) / 100),
          isEnabled: true,
          isInStock: variant.is_available ?? true,
        });
      }
      
      const updatedProduct = await storage.updateProduct(product.id, {
        availablePlacements: normalizePlacements('printify', placements.map(p => p.position)),
        availableColors: colors,
        availableSizes: sizes,
        imageUrl: mockupImageUrl || product.imageUrl,
        metadata: {
          ...(product.metadata as object || {}),
          placementDetails: placements,
          lastSyncedAt: new Date().toISOString(),
        },
      });
      
      res.json({
        success: true,
        product: updatedProduct,
        syncedData: { placements, colors, sizes, mockupImageUrl, variantsCount: variants.length },
      });
    } catch (error: any) {
      console.error('[TestProductSync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/mockup/priority", isAdmin, async (req: any, res) => {
    try {
      const { 
        blueprintId, printProviderId, colorName, colorHex, 
        placement, artworkUrl, qrSize = "medium",
        fulfillmentProvider = "printify"
      } = req.body;

      if (!blueprintId || !colorName || !artworkUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, colorName, artworkUrl" 
        });
      }

      console.log(`[Priority Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);

      const { getMockupWithFallback } = await import("../../lib/mockup-service");
      const { storage: storageInstance } = await import("../../storage");
      
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
      }, storageInstance);

      console.log(`[Priority Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);

      res.json({
        success: true,
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        fromCache: result.fromCache,
        generatedAt: result.generatedAt,
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

  app.post("/api/admin/content/upload", isAdmin, async (req: any, res) => {
    try {
      const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;

      if (!mode || !userId || !packetId || !base64Data) {
        return res.status(400).json({ 
          error: "mode, userId, packetId, and base64Data are required" 
        });
      }

      const validModes = ['canvas', 'play', 'dynamics', 'basics'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ 
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
        });
      }

      const { uploadCanvasComposite, uploadContent } = await import("../../lib/content-upload-service");
      
      let result;
      
      if (mode === 'canvas' || mode === 'basics') {
        result = await uploadCanvasComposite(base64Data, userId, packetId, fileName);
      } else {
        const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        const actualMimeType = base64Match?.[1] || mimeType || 'application/octet-stream';
        const actualBase64 = base64Match?.[2] || base64Data;
        
        console.log(`[Content Upload] Processing ${mode} upload: base64 length=${base64Data?.length || 0}, extracted length=${actualBase64?.length || 0}, mimeType=${actualMimeType}`);
        
        if (!actualBase64 || actualBase64.length === 0) {
          return res.status(400).json({ error: 'No file data received - base64 content is empty' });
        }
        
        const buffer = Buffer.from(actualBase64, 'base64');
        console.log(`[Content Upload] Decoded buffer size: ${buffer.length} bytes`);
        
        if (buffer.length === 0) {
          return res.status(400).json({ error: 'File data is empty after decoding' });
        }
        
        result = await uploadContent(
          buffer, 
          mode as any, 
          userId, 
          packetId, 
          actualMimeType, 
          fileName || 'upload'
        );
      }

      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };
      
      if (mode === 'canvas' || mode === 'basics') {
        updateData.compositeUrl = result.publicUrl;
      } else if (mode === 'play') {
        updateData.playMediaUrl = result.publicUrl;
        updateData.playMediaType = result.mimeType;
      } else if (mode === 'dynamics') {
        updateData.dynamicsMediaUrl = result.publicUrl;
        updateData.dynamicsMediaType = result.mimeType;
      }
      
      await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).update(updateData);

      console.log(`[Content Upload] Uploaded ${mode} content for packet ${packetId}`);

      res.json({
        success: true,
        ...result,
        message: `${mode} content uploaded successfully`,
      });
    } catch (error: any) {
      console.error("[Content Upload] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
