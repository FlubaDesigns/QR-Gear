import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { insertProductSchema } from "@shared/schema";
import { autoSyncVariantsFromLocalCatalog } from "./route-helpers";

export function registerAdminProductsCrudRoutes(app: Express): void {
  app.get("/api/admin/products", isAdmin, async (req: any, res) => {
    try {
      const provider = (req.query.provider as string) || "printify";

      if (provider === "printful") {
        const printfulProducts = await storage.getAllPrintfulProducts();
        const printfulVariants = await storage.getAllPrintfulVariants();

        const products = printfulProducts.map((pf: any) => {
          const variants = printfulVariants.filter((v: any) => v.productId === pf.id);
          const colorSet = new Map<string, string>();
          const sizeSet = new Set<string>();
          for (const v of variants) {
            if (v.color && v.colorCode) colorSet.set(v.color, v.colorCode);
            if (v.size) sizeSet.add(v.size);
          }
          const colors = Array.from(colorSet.entries()).map(([name, hex]) => ({ name, hex }));
          const sizes = Array.from(sizeSet);
          const minPrice = pf.minPrice ? parseFloat(pf.minPrice) : null;
          const maxPrice = pf.maxPrice ? parseFloat(pf.maxPrice) : null;

          return {
            id: String(pf.id),
            name: pf.title,
            description: pf.description || "",
            imageUrl: pf.image || "",
            brand: pf.brand || "",
            category: pf.typeName || pf.type || "",
            isEnabled: !pf.isDiscontinued,
            availableColors: colors,
            availableSizes: sizes,
            metadata: {
              cachedMinCost: minPrice ? Math.round(minPrice * 100) : null,
              originCountry: pf.originCountry || "",
              madeInUSA: pf.originCountry === "US" || pf.originCountry === "USA",
              fulfillmentProvider: "printful",
            },
            customerPrice: null,
            cachedMinCost: minPrice,
            cachedMaxCost: maxPrice,
          };
        });
        return res.json(products);
      }

      const blueprints = await storage.getPrintifyBlueprints();
      const allProviders = await storage.getAllPrintifyProviders();

      const products = blueprints.map((bp) => {
        const providers = allProviders.filter((p) => p.blueprintId === bp.id);
        const usaProvider = providers.find((p) => p.isUSA) || providers[0];
        let minCost: number | null = null;
        let maxCost: number | null = null;
        let colors: Array<{ name: string; hex: string }> = [];
        let sizes: string[] = [];

        if (usaProvider) {
          minCost = usaProvider.minCost ? Number(usaProvider.minCost) / 100 : null;
          maxCost = usaProvider.maxCost ? Number(usaProvider.maxCost) / 100 : minCost;
          colors = Array.isArray(usaProvider.availableColors)
            ? (usaProvider.availableColors as Array<{ name: string; hex: string }>)
            : [];
          sizes = Array.isArray(usaProvider.availableSizes)
            ? (usaProvider.availableSizes as string[])
            : [];
        }

        return {
          id: String(bp.id),
          name: bp.title,
          description: bp.description || "",
          imageUrl: bp.primaryImageUrl || (bp.images?.[0] ?? ""),
          brand: bp.brand || "",
          category: bp.category || "",
          isEnabled: true,
          availableColors: colors,
          availableSizes: sizes,
          metadata: {
            cachedMinCost: usaProvider?.minCost || null,
            originCountry: usaProvider?.isUSA ? "US" : usaProvider?.country || "",
            madeInUSA: usaProvider?.isUSA || false,
            fulfillmentProvider: "printify",
            providerId: usaProvider?.providerId || null,
            providerTitle: usaProvider?.title || "",
          },
          customerPrice: null,
          cachedMinCost: minCost,
          cachedMaxCost: maxCost,
        };
      });

      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/backfill-provider-locations", isAdmin, async (req: any, res) => {
    try {
      const { printify } = await import("../lib/printify");
      const allProvidersList = await printify.getAllPrintProviders();
      const providerLocationMap = new Map<number, { country: string; isUSA: boolean }>();
      for (const p of allProvidersList) {
        const country = p.location?.country || '';
        providerLocationMap.set(p.id, {
          country,
          isUSA: country === 'US' || country === 'USA',
        });
      }

      const existingProviders = await storage.getAllPrintifyProviders();
      let updated = 0;
      for (const provider of existingProviders) {
        const loc = providerLocationMap.get(provider.providerId);
        if (loc && (provider.country !== loc.country || provider.isUSA !== loc.isUSA)) {
          await storage.upsertPrintifyPrintProvider({
            blueprintId: provider.blueprintId,
            providerId: provider.providerId,
            title: provider.title,
            country: loc.country,
            isUSA: loc.isUSA,
          });
          updated++;
        }
      }

      res.json({ 
        success: true, 
        totalProviders: existingProviders.length,
        locationsMapped: providerLocationMap.size,
        usaProviders: Array.from(providerLocationMap.values()).filter(v => v.isUSA).length,
        updated 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/products/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const product = await storage.toggleProductEnabled(id, enabled);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/products/:id/options", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabledSizes, enabledColors } = req.body;
      
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const existingMetadata = (currentProduct.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...existingMetadata,
        enabledSizes,
        enabledColors,
      };
      
      const product = await storage.updateProduct(id, { metadata: newMetadata });
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validated);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validated);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/:id/regenerate-mockups", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or provider info" });
      }
      
      const metadata = product.metadata as { customDesignId?: string } | null;
      const designId = metadata?.customDesignId;
      if (!designId) {
        return res.status(400).json({ error: "Product has no custom design associated" });
      }
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      
      const placementImages = design.placementImages as Record<string, string>;
      const artworkBlackUrl = placementImages?.["front"] || placementImages?.["front-center"] || placementImages?.["front-chest"];
      const artworkWhiteUrl = placementImages?.["front-white"] || placementImages?.["front-center-white"] || placementImages?.["front-chest-white"];
      
      if (!artworkBlackUrl) {
        return res.status(400).json({ error: "No artwork found for this design" });
      }
      
      const { generateAllColorMockups } = await import("../lib/local-mockup-generator");
      
      const colors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
      
      console.log(`[Admin] Regenerating mockups for ${product.name} with ${colors.length} colors`);
      
      const mockupsByColor = await generateAllColorMockups(
        product.blueprintId,
        product.printProviderId,
        colors,
        artworkBlackUrl,
        artworkWhiteUrl || artworkBlackUrl
      );
      
      await storage.updateProduct(id, { mockupsByColor });
      
      try {
        const { getFirestoreDb } = await import("../lib/firebase-admin");
        const firestoreDb = getFirestoreDb();
        const cacheSnap = await firestoreDb.collection('mockup_cache')
          .where('blueprintId', '==', product.blueprintId)
          .where('printProviderId', '==', product.printProviderId)
          .get();
        const batch = firestoreDb.batch();
        cacheSnap.docs.forEach(doc => batch.delete(doc.ref));
        if (cacheSnap.size > 0) await batch.commit();
      } catch (e) {
        console.log('[Admin] Mockup cache clear (non-critical):', e);
      }
      
      res.json({
        success: true,
        message: `Regenerated mockups for ${Object.keys(mockupsByColor).length} colors`,
        mockupsByColor
      });
    } catch (error: any) {
      console.error("[Admin] Failed to regenerate mockups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/:id/generate-all-mockups", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId) {
        return res.status(400).json({ error: "Product missing blueprint info" });
      }
      
      const metadata = product.metadata as { customDesignId?: string } | null;
      const designId = metadata?.customDesignId || id.replace('custom_', '');
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      
      const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
      
      if (allColors.length === 0) {
        return res.status(400).json({ error: "No colors available for this product" });
      }
      
      console.log(`[Admin] Generating Printful mockups for ${product.name} - ${allColors.length} colors`);
      
      let designPlacements: Record<string, string> = {};
      try {
        if (typeof design.placementImages === 'string') {
          designPlacements = JSON.parse(design.placementImages);
        } else if (design.placementImages && typeof design.placementImages === 'object') {
          designPlacements = design.placementImages as Record<string, string>;
        }
      } catch (e) {
        console.error('[Admin] Failed to parse placementImages:', e);
      }
      
      const blackArtwork = designPlacements["front"] || 
                           designPlacements["front-chest"] || 
                           designPlacements["front-center"];
      const whiteArtwork = designPlacements["front-white"] || 
                           designPlacements["front-chest-white"] || 
                           designPlacements["front-center-white"];
      
      if (!blackArtwork) {
        return res.status(400).json({ error: "No artwork found for this design" });
      }
      
      const { getMockupWithFallback, isColorDark } = await import('../lib/mockup-service.js');
      
      const results: { color: string; success: boolean; mockupUrl?: string; lifestyleUrl?: string; error?: string }[] = [];
      const mockupsByColor: Record<string, { front?: string; lifestyle?: string }> = {};
      
      for (const colorInfo of allColors) {
        const color = colorInfo.name;
        const colorHex = colorInfo.hex;
        
        try {
          const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
          const artworkUrl = (needsWhiteQR && whiteArtwork) ? whiteArtwork : blackArtwork;
          const artworkVariant = (needsWhiteQR && whiteArtwork) ? "white" as const : "black" as const;
          
          console.log(`[Admin] Generating mockup for ${color} (${artworkVariant} QR)...`);
          
          const result = await getMockupWithFallback({
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId || 0,
            colorName: color,
            colorHex,
            canonicalPlacementId: "front",
            artworkUrl,
            artworkVariant,
          }, storage);
          
          mockupsByColor[color] = {
            front: result.mockupUrl,
            lifestyle: result.lifestyleMockupUrl || undefined,
          };
          
          results.push({
            color,
            success: true,
            mockupUrl: result.mockupUrl,
            lifestyleUrl: result.lifestyleMockupUrl || undefined,
          });
          
          console.log(`[Admin] ✓ ${color} mockup generated (lifestyle: ${!!result.lifestyleMockupUrl})`);
          
          if (allColors.indexOf(colorInfo) < allColors.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error: any) {
          console.error(`[Admin] ✗ ${color} mockup failed:`, error.message);
          results.push({
            color,
            success: false,
            error: error.message,
          });
        }
      }
      
      await storage.updateProduct(id, { mockupsByColor });
      
      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        message: `Generated ${successCount}/${allColors.length} mockups`,
        results,
        mockupsByColor,
      });
    } catch (error: any) {
      console.error("[Admin] Failed to generate all mockups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/apply-costs", isAdmin, async (req: any, res) => {
    try {
      const products = await storage.getAllProducts();
      const settings = await storage.getAdminSettings();
      
      const markupPercent = settings?.globalMarkupPercent ? parseFloat(settings.globalMarkupPercent) : 25;
      const markupFixed = settings?.globalMarkupFixed ? parseFloat(settings.globalMarkupFixed) : 0;
      const qrCost = settings?.globalQrProductionCost ? parseFloat(settings.globalQrProductionCost) : 2;
      
      let updated = 0;
      let skipped = 0;
      const results: { productId: string; name: string; cost: number; price: number }[] = [];
      
      for (const product of products) {
        if (!product.blueprintId || !product.printProviderId) {
          skipped++;
          continue;
        }
        
        const provider = await storage.getPrintifyPrintProvider(
          product.blueprintId,
          product.printProviderId
        );
        
        if (!provider?.minCost) {
          skipped++;
          continue;
        }
        
        const productionCost = Number(provider.minCost) / 100;
        
        const totalCost = productionCost + qrCost + markupFixed;
        const retailPrice = Math.ceil((totalCost * (1 + markupPercent / 100)) * 100) / 100;
        
        await storage.updateProduct(product.id, { 
          basePrice: retailPrice.toFixed(2),
          qrProductionCost: qrCost.toFixed(2)
        });
        
        updated++;
        results.push({
          productId: product.id,
          name: product.name,
          cost: productionCost,
          price: retailPrice
        });
      }
      
      res.json({ 
        success: true, 
        updated, 
        skipped,
        markupPercent,
        markupFixed,
        qrCost,
        results: results.slice(0, 20)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/products/:id/variants", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const variants = await storage.getProductVariants(id);
      res.json(variants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/variants/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const variant = await storage.toggleVariantEnabled(id, enabled);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.json(variant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
