import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { insertPricingRuleSchema, insertAdminSettingsSchema, insertProductSchema, mockupCache } from "@shared/schema";
import { printify, syncProductPlacements, syncProductVariants, detectCategory } from "../lib/printify";
import { startCostSync, getCostSyncStatus, cancelCostSync, isCostSyncRunning } from "../lib/printify-cost-sync";
import { checkProviderHealth, autoSyncVariantsFromLocalCatalog } from "./route-helpers";

const USA_MADE_BRANDS = [
  'american apparel',
  'royal apparel',
  'bayside',
  'los angeles apparel',
  'bella+canvas',
  'bella canvas',
  'lane seven',
  'cotton heritage',
  'shaka wear',
  'backpacks usa',
  'american giant',
  'next level',
];

function categorizeProduct(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) {
    return "T-Shirts & Tops";
  } else if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) {
    return "Sweatshirts & Hoodies";
  } else if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) {
    return "Hats & Caps";
  } else if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) {
    return "Drinkware";
  } else if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) {
    return "Bags & Accessories";
  } else if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) {
    return "Phone Cases & Tech";
  } else if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) {
    return "Stickers & Magnets";
  } else if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) {
    return "Wall Art & Posters";
  } else if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) {
    return "Home & Living";
  } else if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) {
    return "Stationery & Paper";
  } else if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe')) {
    return "Activewear & Specialty";
  } else if (t.includes('pet') || t.includes('dog')) {
    return "Pet Products";
  } else if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake')) {
    return "Holiday & Seasonal";
  } else if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie')) {
    return "Accessories";
  } else {
    return "Other";
  }
}

export function registerAdminRoutes(app: Express): void {
  // ============ ADMIN ROUTES ============

  // Admin: Get fulfillment provider status (which providers are configured)
  app.get("/api/admin/fulfillment-providers", isAdmin, async (req: any, res) => {
    try {
      const printifyKey = process.env.PRINTIFY_API_KEY;
      const printfulKey = process.env.PRINTFUL_API_KEY;
      const apliiqKey = process.env.APLIIQ_API_KEY;
      
      const providers = [
        { 
          id: "printify", 
          name: "Printify", 
          configured: !!printifyKey && printifyKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printify network"
        },
        { 
          id: "printful", 
          name: "Printful", 
          configured: !!printfulKey && printfulKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printful"
        },
        { 
          id: "apliiq", 
          name: "Apliiq", 
          configured: !!apliiqKey && apliiqKey.length > 10,
          role: "fulfillment",
          description: "Custom apparel via Apliiq"
        },
      ];
      
      console.log(`[FulfillmentProviders] Admin returning ${providers.filter(p => p.configured).length} configured providers`);
      res.json(providers);
    } catch (error: any) {
      console.error('[FulfillmentProviders] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Settings
  app.get("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      let settings = await storage.getAdminSettings();
      if (!settings) {
        settings = await storage.upsertAdminSettings({});
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      const validated = insertAdminSettingsSchema.partial().parse(req.body);
      const settings = await storage.upsertAdminSettings(validated);
      res.json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Pricing Rules
  app.get("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
    try {
      const validated = insertPricingRuleSchema.parse(req.body);
      const rule = await storage.createPricingRule(validated);
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertPricingRuleSchema.partial().parse(req.body);
      const rule = await storage.updatePricingRule(id, validated);
      if (!rule) {
        return res.status(404).json({ error: "Pricing rule not found" });
      }
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePricingRule(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Products - Get all products with admin fields and cached costs
  app.get("/api/admin/products", isAdmin, async (req: any, res) => {
    try {
      const products = await storage.getAllProducts();
      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
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
          
          let qrProductType: string | null = null;
          const meta = product.metadata as Record<string, unknown> | null;
          if (meta?.customDesignId) {
            const design = await storage.getCustomDesign(meta.customDesignId as string);
            if (design) {
              const hasTopText = design.topText && typeof design.topText === 'object' && (design.topText as any).text;
              const hasBottomText = design.bottomText && typeof design.bottomText === 'object' && (design.bottomText as any).text;
              const hasBackground = !!design.backgroundImageUrl;
              const hasVideo = !!(design as any).videoUrl;
              const overlay = design.landingOverlay as any;
              const hasLandingOverlay = overlay?.enabled;
              
              if (design.templateVariant === "plain-text") {
                qrProductType = "qr-basics";
              } else if (design.templateVariant === "dynamics") {
                qrProductType = "qr-dynamics";
              } else if (design.templateVariant === "external-url") {
                qrProductType = "qr-basics";
              } else if (design.templateVariant === "url") {
                if (hasVideo) {
                  qrProductType = "qr-play";
                } else if (hasBackground || hasLandingOverlay) {
                  qrProductType = "qr-canvas";
                } else if (hasTopText || hasBottomText) {
                  qrProductType = "qr-plus";
                } else {
                  qrProductType = "qr-canvas";
                }
              }
            }
          }
          
          const finalColors = providerColors || (product.availableColors as Array<{name: string; hex: string}>) || [];
          const finalSizes = providerSizes || (product.availableSizes as string[]) || [];
          
          return {
            ...product,
            availableColors: finalColors,
            availableSizes: finalSizes,
            categoryIds: assignments.map((a) => a.categoryId),
            cachedMinCost,
            cachedMaxCost,
            qrProductType,
          };
        })
      );
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle product enabled/disabled
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

  // Update product size/color options (stored in metadata)
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

  // Update product admin settings (markup, production cost, etc.)
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

  // Delete product from catalog
  app.delete("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate mockups for a product using local generator
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
      const artworkBlackUrl = placementImages?.["front-center"] || placementImages?.["front-chest"];
      const artworkWhiteUrl = placementImages?.["front-center-white"] || placementImages?.["front-chest-white"];
      
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
      
      await db.delete(mockupCache).where(
        and(
          eq(mockupCache.blueprintId, product.blueprintId),
          eq(mockupCache.printProviderId, product.printProviderId)
        )
      );
      
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

  // Generate ALL color mockups for a product using Printful (admin-created products)
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
      
      const blackArtwork = designPlacements["front-chest"] || 
                           designPlacements["front-center"] ||
                           designPlacements["front"];
      const whiteArtwork = designPlacements["front-chest-white"] || 
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
            canonicalPlacementId: "FRONT_CHEST",
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

  // Apply synced costs to product prices
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

  // Get product variants
  app.get("/api/admin/products/:id/variants", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const variants = await storage.getProductVariants(id);
      res.json(variants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle variant enabled/disabled
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

  // Printify Catalog Browsing - Get blueprints
  app.get("/api/admin/printify/blueprints", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const blueprints = await printify.getCatalogBlueprints();
      res.json(blueprints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/printify/catalog", isAdmin, async (req: any, res) => {
    try {
      const providerFilter = (req.query.provider as string) || 'all';
      
      const categories: Record<string, any[]> = {};

      const localBlueprints = await storage.getPrintifyBlueprints();
      let allPrintifyBlueprints: any[] = [];
      if (localBlueprints.length > 0) {
        allPrintifyBlueprints = localBlueprints.map(bp => ({
          id: bp.id,
          title: bp.title,
          brand: bp.brand,
          model: bp.model,
          images: bp.images || [],
        }));
      } else if (printify) {
        allPrintifyBlueprints = await printify.getCatalogBlueprints();
      }

      const { printfulProducts: printfulTable } = await import('@shared/schema');
      const allPrintfulRows = await db.select().from(printfulTable);

      let matchedModels: Set<string> | null = null;
      if (providerFilter === 'matched') {
        const printifyModels = new Set(
          allPrintifyBlueprints
            .filter(bp => bp.model && bp.model.trim() !== '')
            .map(bp => bp.model.trim().toLowerCase())
        );
        const printfulModels = new Set(
          allPrintfulRows
            .filter(pf => pf.model && pf.model.trim() !== '')
            .map(pf => pf.model!.trim().toLowerCase())
        );
        matchedModels = new Set([...printifyModels].filter(m => printfulModels.has(m)));
      }

      if (providerFilter === 'all' || providerFilter === 'printify' || providerFilter === 'matched') {
        let blueprints = allPrintifyBlueprints;
        if (providerFilter === 'matched') {
          blueprints = blueprints.filter(bp => bp.model && matchedModels!.has(bp.model.trim().toLowerCase()));
        }
        
        for (const bp of blueprints) {
          const brandLower = (bp.brand || '').toLowerCase();
          const isUSABrand = USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
          const category = categorizeProduct(bp.title);
          if (!categories[category]) categories[category] = [];
          
          const modelLower = (bp.model || '').trim().toLowerCase();
          const matchedPrintful = modelLower ? allPrintfulRows.find(pf => (pf.model || '').trim().toLowerCase() === modelLower) : null;
          
          categories[category].push({
            id: `printify-${bp.id}`,
            rawId: bp.id,
            title: bp.title,
            brand: bp.brand,
            model: bp.model,
            imageUrl: bp.images?.[0] || null,
            madeInUSA: isUSABrand,
            provider: 'printify',
            dualProvider: !!matchedPrintful,
            matchedProviderId: matchedPrintful ? `printful-${matchedPrintful.id}` : null,
          });
        }
      }

      if (providerFilter === 'all' || providerFilter === 'printful' || providerFilter === 'matched') {
        let printfulRows = allPrintfulRows;
        if (providerFilter === 'matched') {
          printfulRows = printfulRows.filter(pf => pf.model && matchedModels!.has(pf.model.trim().toLowerCase()));
        }
        
        for (const pf of printfulRows) {
          const isUSA = (pf.originCountry || '').toUpperCase() === 'USA' || (pf.originCountry || '').toUpperCase() === 'US';
          const brandLower = (pf.brand || '').toLowerCase();
          const isUSABrand = isUSA || USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
          const category = categorizeProduct(pf.title);
          if (!categories[category]) categories[category] = [];
          
          const modelLower = (pf.model || '').trim().toLowerCase();
          const matchedPrintify = modelLower ? allPrintifyBlueprints.find(bp => (bp.model || '').trim().toLowerCase() === modelLower) : null;
          
          categories[category].push({
            id: `printful-${pf.id}`,
            rawId: pf.id,
            title: pf.title,
            brand: pf.brand || '',
            model: pf.model || '',
            imageUrl: pf.image || null,
            madeInUSA: isUSABrand,
            provider: 'printful',
            dualProvider: !!matchedPrintify,
            matchedProviderId: matchedPrintify ? `printify-${matchedPrintify.id}` : null,
          });
        }
      }
      
      const sortedCategories = [
        "T-Shirts & Tops", "Sweatshirts & Hoodies", "Hats & Caps", "Drinkware",
        "Bags & Accessories", "Phone Cases & Tech", "Stickers & Magnets", 
        "Wall Art & Posters", "Home & Living", "Stationery & Paper",
        "Activewear & Specialty", "Accessories", "Pet Products", 
        "Holiday & Seasonal", "Other"
      ];

      const result = sortedCategories
        .filter(name => categories[name] && categories[name].length > 0)
        .map(name => ({
          name,
          items: categories[name].sort((a: any, b: any) => a.title.localeCompare(b.title)),
          count: categories[name].length,
          usaCount: categories[name].filter((i: any) => i.madeInUSA).length,
          printifyCount: categories[name].filter((i: any) => i.provider === 'printify').length,
          printfulCount: categories[name].filter((i: any) => i.provider === 'printful').length,
        }));

      const extraCategories = Object.entries(categories)
        .filter(([name]) => !sortedCategories.includes(name))
        .filter(([_, items]) => items.length > 0)
        .map(([name, items]) => ({
          name,
          items: items.sort((a: any, b: any) => a.title.localeCompare(b.title)),
          count: items.length,
          usaCount: items.filter((i: any) => i.madeInUSA).length,
          printifyCount: items.filter((i: any) => i.provider === 'printify').length,
          printfulCount: items.filter((i: any) => i.provider === 'printful').length,
        }));
      
      res.json([...result, ...extraCategories]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get full catalog item details with USA providers and pricing
  app.get("/api/admin/printify/catalog/:blueprintId", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      
      const [blueprint, providers] = await Promise.all([
        printify.getBlueprintDetails(blueprintId),
        printify.getPrintProviders(blueprintId),
      ]);
      
      const usaProviders = providers.filter(p => 
        p.location?.country === 'US' || p.location?.country === 'USA'
      );
      
      let variants: any[] = [];
      let selectedProvider = usaProviders[0] || providers[0];
      
      if (selectedProvider) {
        const variantData = await printify.getVariants(blueprintId, selectedProvider.id);
        variants = variantData.variants || [];
      }
      
      const colors = Array.from(new Set(variants.map(v => v.options?.color).filter(Boolean)));
      const sizes = Array.from(new Set(variants.map(v => v.options?.size).filter(Boolean)));
      
      let basePrice = 0;
      let maxPrice = 0;
      let costsFromDatabase = false;
      let cachedColors: any[] | null = null;
      let cachedSizes: string[] | null = null;
      
      if (selectedProvider) {
        const storedProvider = await storage.getPrintifyPrintProvider(blueprintId, selectedProvider.id);
        if (storedProvider?.minCost && storedProvider.minCost > 0) {
          basePrice = storedProvider.minCost / 100;
          maxPrice = (storedProvider.maxCost || storedProvider.minCost) / 100;
          costsFromDatabase = true;
        }
        if (storedProvider?.availableColors && Array.isArray(storedProvider.availableColors)) {
          cachedColors = storedProvider.availableColors as any[];
        }
        if (storedProvider?.availableSizes && Array.isArray(storedProvider.availableSizes)) {
          cachedSizes = storedProvider.availableSizes as string[];
        }
      }
      
      if (basePrice === 0) {
        const costs = variants.map(v => v.cost || v.price || 0).filter((c: number) => c > 0);
        basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
        maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
      }
      
      const finalColors = cachedColors || colors;
      const finalSizes = cachedSizes || sizes;
      
      const responseData = {
        blueprint,
        providers: usaProviders.length > 0 ? usaProviders : providers,
        selectedProvider,
        madeInUSA: usaProviders.length > 0,
        variants,
        colors: finalColors,
        sizes: finalSizes,
        basePrice,
        maxPrice,
        costsFromDatabase,
        colorsFromDatabase: cachedColors !== null,
        sizesFromDatabase: cachedSizes !== null,
        costsAvailable: basePrice > 0,
        imageUrl: blueprint.images?.[0] || null,
      };
      
      res.json(responseData);
    } catch (error: any) {
      console.error(`Printify API error for blueprint ${req.params.blueprintId}:`, error.message);
      res.status(500).json({ error: `Printify API error: ${error.message}` });
    }
  });

  // Batch fetch blueprint details (for efficient loading)
  app.post("/api/admin/printify/catalog/batch-details", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      const { blueprintIds } = req.body;
      if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) {
        return res.status(400).json({ error: "blueprintIds array required" });
      }
      
      const limitedIds = blueprintIds.slice(0, 20);
      const results: Record<number, any> = {};
      
      for (const blueprintId of limitedIds) {
        try {
          const [blueprint, providers] = await Promise.all([
            printify.getBlueprintDetails(blueprintId),
            printify.getPrintProviders(blueprintId),
          ]);
          
          const usaProviders = providers.filter((p: any) => 
            p.location?.country === 'US' || p.location?.country === 'USA'
          );
          
          let variants: any[] = [];
          const selectedProvider = usaProviders[0] || providers[0];
          
          if (selectedProvider) {
            try {
              const variantData = await printify.getVariants(blueprintId, selectedProvider.id);
              variants = variantData.variants || [];
            } catch {
            }
          }
          
          const liveColors = Array.from(new Set(variants.map((v: any) => v.options?.color).filter(Boolean)));
          const liveSizes = Array.from(new Set(variants.map((v: any) => v.options?.size).filter(Boolean)));
          
          let basePrice = 0;
          let maxPrice = 0;
          let costsFromDatabase = false;
          let cachedColors: any[] | null = null;
          let cachedSizes: string[] | null = null;
          
          if (selectedProvider) {
            const storedProvider = await storage.getPrintifyPrintProvider(blueprintId, selectedProvider.id);
            if (storedProvider?.minCost && storedProvider.minCost > 0) {
              basePrice = storedProvider.minCost / 100;
              maxPrice = (storedProvider.maxCost || storedProvider.minCost) / 100;
              costsFromDatabase = true;
            }
            if (storedProvider?.availableColors && Array.isArray(storedProvider.availableColors)) {
              cachedColors = storedProvider.availableColors as any[];
            }
            if (storedProvider?.availableSizes && Array.isArray(storedProvider.availableSizes)) {
              cachedSizes = storedProvider.availableSizes as string[];
            }
          }
          
          if (basePrice === 0) {
            const costs = variants.map((v: any) => v.cost || 0).filter((c: number) => c > 0);
            basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
            maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
          }
          
          const finalColors = cachedColors || liveColors;
          const finalSizes = cachedSizes || liveSizes;
          
          const data = {
            blueprintId,
            basePrice,
            maxPrice,
            costsAvailable: basePrice > 0,
            costsFromDatabase,
            colors: finalColors,
            sizes: finalSizes,
            colorsFromDatabase: cachedColors !== null,
            sizesFromDatabase: cachedSizes !== null,
            madeInUSA: usaProviders.length > 0,
            providerId: selectedProvider?.id,
            providerName: selectedProvider?.title,
          };
          
          results[blueprintId] = data;
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          results[blueprintId] = { 
            blueprintId, 
            error: true, 
            message: err.message || "Failed to fetch details" 
          };
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get print providers for a blueprint
  app.get("/api/admin/printify/blueprints/:id/providers", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const { id } = req.params;
      const providers = await printify.getPrintProviders(parseInt(id));
      res.json(providers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get variants for a blueprint + provider combination
  app.get("/api/admin/printify/blueprints/:blueprintId/providers/:providerId/variants", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const { blueprintId, providerId } = req.params;
      const variants = await printify.getVariants(parseInt(blueprintId), parseInt(providerId));
      res.json(variants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // LOCAL CATALOG SYNC ENDPOINTS
  // ========================================

  // Get local catalog blueprints (fast, from database)
  app.get("/api/admin/catalog/blueprints", isAdmin, async (req: any, res) => {
    try {
      const blueprints = await storage.getPrintifyBlueprints();
      const usaFilter = req.query.usaOnly === 'true';
      const category = req.query.category as string | undefined;
      
      let filteredBlueprints = blueprints;
      
      if (category) {
        filteredBlueprints = filteredBlueprints.filter(bp => bp.category === category);
      }
      
      if (usaFilter) {
        const blueprintIds = new Set<number>();
        for (const bp of filteredBlueprints) {
          const providers = await storage.getPrintifyPrintProviders(bp.id);
          if (providers.some(p => p.isUSA)) {
            blueprintIds.add(bp.id);
          }
        }
        filteredBlueprints = filteredBlueprints.filter(bp => blueprintIds.has(bp.id));
      }
      
      res.json({
        blueprints: filteredBlueprints,
        total: filteredBlueprints.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get local catalog blueprint details
  app.get("/api/admin/catalog/blueprints/:id", isAdmin, async (req: any, res) => {
    try {
      const blueprintId = parseInt(req.params.id);
      const blueprint = await storage.getPrintifyBlueprint(blueprintId);
      
      if (!blueprint) {
        return res.status(404).json({ error: "Blueprint not found in local catalog" });
      }
      
      const providers = await storage.getPrintifyPrintProviders(blueprintId);
      const usaProviders = providers.filter(p => p.isUSA);
      
      const selectedProvider = usaProviders[0] || providers[0];
      let colors: any[] = [];
      let sizes: string[] = [];
      let basePrice = 0;
      let maxPrice = 0;
      
      if (selectedProvider) {
        if (selectedProvider.availableColors && Array.isArray(selectedProvider.availableColors)) {
          colors = selectedProvider.availableColors as any[];
        }
        if (selectedProvider.availableSizes && Array.isArray(selectedProvider.availableSizes)) {
          sizes = selectedProvider.availableSizes as string[];
        }
        if (selectedProvider.minCost) {
          basePrice = selectedProvider.minCost / 100;
          maxPrice = (selectedProvider.maxCost || selectedProvider.minCost) / 100;
        }
      }
      
      res.json({
        ...blueprint,
        providers,
        usaProviders,
        selectedProvider,
        colors,
        sizes,
        basePrice,
        maxPrice,
        costsAvailable: basePrice > 0,
        colorsFromDatabase: colors.length > 0,
        sizesFromDatabase: sizes.length > 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get provider details with colors/sizes from local cache
  app.get("/api/admin/catalog/providers/:blueprintId/:providerId", isAdmin, async (req: any, res) => {
    try {
      const blueprintId = parseInt(req.params.blueprintId);
      const providerId = parseInt(req.params.providerId);
      
      const provider = await storage.getPrintifyPrintProvider(blueprintId, providerId);
      
      if (!provider) {
        return res.status(404).json({ error: "Provider not found in local catalog" });
      }
      
      const colors = provider.availableColors && Array.isArray(provider.availableColors) 
        ? provider.availableColors as any[] 
        : [];
      const sizes = provider.availableSizes && Array.isArray(provider.availableSizes) 
        ? provider.availableSizes as string[] 
        : [];
      
      res.json({
        ...provider,
        colors,
        sizes,
        basePrice: provider.minCost ? provider.minCost / 100 : 0,
        maxPrice: provider.maxCost ? provider.maxCost / 100 : (provider.minCost ? provider.minCost / 100 : 0),
        costsAvailable: provider.minCost !== null && provider.minCost > 0,
        colorsFromDatabase: colors.length > 0,
        sizesFromDatabase: sizes.length > 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get catalog sync status
  app.get("/api/admin/catalog/sync-status", isAdmin, async (req: any, res) => {
    try {
      const latestSync = await storage.getLatestCatalogSync();
      const totalBlueprints = (await storage.getPrintifyBlueprints()).length;
      
      res.json({
        latestSync,
        totalBlueprints,
        isConfigured: printify?.isConfigured || false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get catalog sync history
  app.get("/api/admin/catalog/sync-history", isAdmin, async (req: any, res) => {
    try {
      const history = await storage.getCatalogSyncHistory();
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start catalog sync from Printify
  app.post("/api/admin/catalog/sync", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      const latestSync = await storage.getLatestCatalogSync();
      if (latestSync?.status === 'running') {
        return res.status(409).json({ error: "Sync already in progress" });
      }
      
      const syncRecord = await storage.createCatalogSync({
        syncType: 'full',
        status: 'running',
        blueprintsCount: 0,
        providersCount: 0,
      });
      
      res.json({ syncId: syncRecord.id, status: 'started' });
      
      (async () => {
        try {
          console.log('[Catalog Sync] Starting full catalog sync...');
          
          const blueprints = await printify.getCatalogBlueprints();
          console.log(`[Catalog Sync] Found ${blueprints.length} blueprints`);
          
          let blueprintsCount = 0;
          let providersCount = 0;
          
          for (const bp of blueprints) {
            try {
              await storage.upsertPrintifyBlueprint({
                id: bp.id,
                title: bp.title,
                description: bp.description || null,
                brand: bp.brand || null,
                model: bp.model || null,
                images: bp.images || null,
                primaryImageUrl: bp.images?.[0] || null,
                category: detectCategory(bp.title, bp.brand || ''),
              });
              blueprintsCount++;
              
              const providers = await printify.getPrintProviders(bp.id);
              
              for (const provider of providers) {
                const isUSA = provider.location?.country === 'US' || 
                              provider.location?.country === 'USA';
                
                await storage.upsertPrintifyPrintProvider({
                  blueprintId: bp.id,
                  providerId: provider.id,
                  title: provider.title,
                  country: provider.location?.country || null,
                  isUSA,
                });
                providersCount++;
              }
              
              await new Promise(r => setTimeout(r, 100));
              
            } catch (bpError: any) {
              console.error(`[Catalog Sync] Error syncing blueprint ${bp.id}:`, bpError.message);
            }
          }
          
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'completed',
            blueprintsCount,
            providersCount,
            completedAt: new Date(),
          });
          
          console.log(`[Catalog Sync] Completed. ${blueprintsCount} blueprints, ${providersCount} providers`);
          
        } catch (error: any) {
          console.error('[Catalog Sync] Error:', error.message);
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date(),
          });
        }
      })();
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear local catalog (for testing/reset)
  app.delete("/api/admin/catalog/clear", isAdmin, async (req: any, res) => {
    try {
      await storage.clearPrintifyPrintProviders();
      await storage.clearPrintifyBlueprints();
      res.json({ success: true, message: "Local catalog cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch production costs for a specific blueprint/provider combo
  app.post("/api/admin/catalog/fetch-costs", isAdmin, async (req: any, res) => {
    try {
      const { blueprintId, providerId, deleteAfter = true } = req.body;
      
      if (!blueprintId || !providerId) {
        return res.status(400).json({ error: "blueprintId and providerId are required" });
      }
      
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      console.log(`[Cost Fetch] Fetching costs for blueprint ${blueprintId}, provider ${providerId}...`);
      
      const variantsResult = await printify.getVariants(blueprintId, providerId);
      const variantIds = variantsResult.variants.map(v => v.id);
      
      if (variantIds.length === 0) {
        return res.status(404).json({ error: "No variants found for this blueprint/provider combo" });
      }
      
      const { placement, variantIds: compatibleVariantIds } = await printify.getCommonPlacement(blueprintId, providerId);
      console.log(`[Cost Fetch] Using placement '${placement}' with ${compatibleVariantIds.length} compatible variants`);
      
      const imageId = await printify.getOrCreatePlaceholderImage();
      console.log(`[Cost Fetch] Using placeholder image: ${imageId}`);
      
      const placeholderProduct = await printify.createPlaceholderProduct(
        blueprintId,
        providerId,
        compatibleVariantIds,
        imageId,
        placement
      );
      
      console.log(`[Cost Fetch] Created placeholder product ${placeholderProduct.id}, extracting costs...`);
      
      const costs = printify.extractCostsFromProduct(placeholderProduct);
      
      console.log(`[Cost Fetch] Extracted costs: min=$${(costs.minCost / 100).toFixed(2)}, max=$${(costs.maxCost / 100).toFixed(2)}`);
      
      const updatedProvider = await storage.updatePrintifyProviderCosts(
        blueprintId,
        providerId,
        {
          minCost: costs.minCost,
          maxCost: costs.maxCost,
          placeholderProductId: deleteAfter ? undefined : placeholderProduct.id,
        }
      );
      
      if (deleteAfter) {
        try {
          await printify.deleteProduct(placeholderProduct.id);
          console.log(`[Cost Fetch] Deleted placeholder product ${placeholderProduct.id}`);
        } catch (deleteError: any) {
          console.warn(`[Cost Fetch] Could not delete placeholder product: ${deleteError.message}`);
        }
      }
      
      res.json({
        success: true,
        blueprintId,
        providerId,
        placement,
        minCost: costs.minCost,
        maxCost: costs.maxCost,
        minCostFormatted: `$${(costs.minCost / 100).toFixed(2)}`,
        maxCostFormatted: `$${(costs.maxCost / 100).toFixed(2)}`,
        variantsChecked: compatibleVariantIds.length,
        placeholderDeleted: deleteAfter,
        note: `Cost includes: blank item + one print on '${placement}' position`,
      });
      
    } catch (error: any) {
      console.error('[Cost Fetch] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync ALL costs in background
  app.post("/api/admin/catalog/sync-all-costs", isAdmin, async (req: any, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify API not configured" });
      }

      if (isCostSyncRunning()) {
        return res.status(409).json({ error: "Cost sync already in progress" });
      }

      const forceRefresh = req.body?.forceRefresh === true;
      const costSync = await startCostSync({ forceRefresh });

      if (!costSync) {
        return res.status(400).json({ error: "Failed to start cost sync. Check that catalog is synced first." });
      }

      res.json({ 
        success: true, 
        message: "Cost sync started in background",
        syncId: costSync.id,
        totalProviders: costSync.totalProviders,
      });
      
    } catch (error: any) {
      console.error('[Cost Sync] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get cost sync status
  app.get("/api/admin/catalog/cost-sync-status", isAdmin, async (req: any, res) => {
    try {
      const status = await getCostSyncStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel running cost sync
  app.post("/api/admin/catalog/cancel-cost-sync", isAdmin, async (req: any, res) => {
    try {
      cancelCostSync();
      res.json({ success: true, message: "Cost sync cancellation requested" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Refresh color hex values for all providers
  app.post("/api/admin/catalog/refresh-color-hex", isAdmin, async (req: any, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify API not configured" });
      }

      const allProviders = await storage.getAllPrintifyProviders();
      const providersNeedingHex = allProviders.filter(p => {
        if (!p.availableColors || !Array.isArray(p.availableColors)) return false;
        return (p.availableColors as any[]).some(c => !c.hex);
      });

      console.log(`[Color Hex Refresh] Found ${providersNeedingHex.length} providers needing hex values`);

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const provider of providersNeedingHex) {
        try {
          const catalogData = await syncProductVariants(provider.blueprintId, provider.providerId);
          
          await storage.updatePrintifyProviderCosts(provider.blueprintId, provider.providerId, {
            minCost: 0,
            maxCost: 0,
            availableColors: catalogData.colors,
            availableSizes: catalogData.sizes,
          });

          successCount++;
          console.log(`[Color Hex Refresh] Updated ${provider.blueprintId}/${provider.providerId} with ${catalogData.colors.length} colors`);
          
          await new Promise(r => setTimeout(r, 1000));
        } catch (err: any) {
          failedCount++;
          errors.push(`${provider.blueprintId}/${provider.providerId}: ${err.message}`);
        }
      }

      res.json({
        success: true,
        message: `Color hex refresh complete`,
        totalProcessed: providersNeedingHex.length,
        successCount,
        failedCount,
        errors: errors.slice(0, 10),
      });

    } catch (error: any) {
      console.error('[Color Hex Refresh] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // PRINTFUL CATALOG SYNC ENDPOINTS
  // ========================================

  // Sync Printful catalog to local database
  app.post("/api/admin/catalog/sync-printful", isAdmin, async (req: any, res) => {
    try {
      const { syncPrintfulCatalog, printfulClient } = await import("../lib/printful");
      
      if (!printfulClient.isConfigured) {
        return res.status(503).json({ error: "Printful API key not configured" });
      }

      const productIds = req.body?.productIds;
      
      res.json({ 
        success: true, 
        message: "Printful catalog sync started in background",
        productIds: productIds || "all",
      });

      try {
        const result = await syncPrintfulCatalog(db, productIds ? { productIds } : undefined);
        console.log('[Printful Sync] Background sync complete:', result);
      } catch (syncError: any) {
        console.error('[Printful Sync] Background sync error:', syncError.message);
      }
      
    } catch (error: any) {
      console.error('[Printful Sync] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Printful catalog status
  app.get("/api/admin/catalog/printful-status", isAdmin, async (req: any, res) => {
    try {
      const { printfulClient } = await import("../lib/printful");
      const { printfulProducts, printfulVariants } = await import("@shared/schema");
      const { count } = await import("drizzle-orm");
      
      const [productCount] = await db.select({ count: count() }).from(printfulProducts);
      const [variantCount] = await db.select({ count: count() }).from(printfulVariants);
      
      const isConfigured = printfulClient.isConfigured;
      console.log('[Printful Status] isConfigured:', isConfigured);
      
      res.json({
        isConfigured,
        productCount: productCount?.count || 0,
        variantCount: variantCount?.count || 0,
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Printful products list
  app.get("/api/admin/catalog/printful-products", isAdmin, async (req: any, res) => {
    try {
      const { printfulProducts } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const products = await db.select().from(printfulProducts).orderBy(desc(printfulProducts.lastSyncedAt));
      res.json(products);
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // END LOCAL CATALOG SYNC ENDPOINTS
  // ========================================

  // Add product from Printify catalog
  app.post("/api/admin/products/from-printify", isAdmin, async (req: any, res) => {
    try {
      const { blueprintId, printProviderId, name, description, category, basePrice, imageUrl, manufacturer, madeInUSA, availablePlacements, availableColors, metadata } = req.body;
      
      const productId = `printify_${blueprintId}_${printProviderId}_${Date.now()}`;
      
      const product = await storage.createProduct({
        id: productId,
        printifyId: null,
        blueprintId,
        printProviderId,
        name,
        description,
        category,
        basePrice: basePrice.toString(),
        imageUrl,
        manufacturer,
        madeInUSA: madeInUSA || false,
        availablePlacements,
        availableColors,
        metadata,
        isEnabled: false,
        markupPercent: "0",
        markupFixed: "0",
        qrProductionCost: "0",
        sortOrder: 0,
      });
      
      const { variantsSeeded, syncWarning } = await autoSyncVariantsFromLocalCatalog(
        product.id,
        blueprintId,
        printProviderId,
        basePrice.toString(),
        metadata || {}
      );
      
      if (category === "Kingdom Connects" && metadata?.kcPlacements?.length > 0) {
        const partnerStores = await storage.getPartnerStores();
        const kcStore = partnerStores.find(p => p.slug === "kingdom-connects");
        
        if (kcStore) {
          await storage.addPartnerStoreProduct({
            partnerStoreId: kcStore.id,
            productId: product.id,
            kcPlacements: metadata.kcPlacements,
            kcBusinessSlug: metadata.kcBusinessSlug || null,
            sortOrder: 0,
            isEnabled: true,
          });
        }
      }
      
      res.json({ 
        ...product, 
        variantsSeeded,
        syncWarning 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync product placements and data from Printify
  app.post("/api/admin/products/:id/sync-printify", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing Printify blueprint or provider IDs" });
      }
      
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
        availablePlacements: placements.map(p => p.position),
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
      console.error("Product sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRODUCT CATEGORIES ENDPOINTS ============

  // Admin: Get ALL product categories (including inactive)
  app.get("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const categories = await storage.getAllProductCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/product-categories", async (req, res) => {
    try {
      const taxonomyType = req.query.taxonomy as string | undefined;
      let categories;
      if (taxonomyType) {
        categories = await storage.getProductCategoriesByTaxonomy(taxonomyType);
      } else {
        categories = await storage.getActiveProductCategories();
      }
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get products by category (public)
  app.get("/api/product-categories/:id/products", async (req, res) => {
    try {
      const products = await storage.getProductsByCategory(req.params.id);
      const enabledProducts = products.filter(p => p.isEnabled);
      res.json(enabledProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get category assignments for a product
  app.get("/api/products/:id/categories", async (req, res) => {
    try {
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create a category
  app.post("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const { name, slug, description, taxonomyType, icon, parentId, sortOrder, isActive } = req.body;
      const category = await storage.createProductCategory({
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        taxonomyType,
        icon,
        parentId,
        sortOrder,
        isActive,
      });
      res.status(201).json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update a category
  app.put("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateProductCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete a category
  app.delete("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteProductCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Assign categories to a product
  app.post("/api/admin/products/:id/categories", isAdmin, async (req: any, res) => {
    try {
      const { categoryIds } = req.body;
      await storage.syncProductCategories(req.params.id, categoryIds || []);
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Seed default categories
  app.post("/api/admin/product-categories/seed", isAdmin, async (req: any, res) => {
    try {
      const defaultCategories = [
        { name: "Spring", slug: "spring", taxonomyType: "season", icon: "Flower2", sortOrder: 1 },
        { name: "Summer", slug: "summer", taxonomyType: "season", icon: "Sun", sortOrder: 2 },
        { name: "Fall", slug: "fall", taxonomyType: "season", icon: "Leaf", sortOrder: 3 },
        { name: "Winter", slug: "winter", taxonomyType: "season", icon: "Snowflake", sortOrder: 4 },
        { name: "Christmas", slug: "christmas", taxonomyType: "holiday", icon: "Gift", sortOrder: 1 },
        { name: "Easter", slug: "easter", taxonomyType: "holiday", icon: "Egg", sortOrder: 2 },
        { name: "Valentine's Day", slug: "valentines", taxonomyType: "holiday", icon: "Heart", sortOrder: 3 },
        { name: "Halloween", slug: "halloween", taxonomyType: "holiday", icon: "Ghost", sortOrder: 4 },
        { name: "Thanksgiving", slug: "thanksgiving", taxonomyType: "holiday", icon: "Utensils", sortOrder: 5 },
        { name: "Fourth of July", slug: "july-4th", taxonomyType: "holiday", icon: "Flag", sortOrder: 6 },
        { name: "Mother's Day", slug: "mothers-day", taxonomyType: "holiday", icon: "Heart", sortOrder: 7 },
        { name: "Father's Day", slug: "fathers-day", taxonomyType: "holiday", icon: "Trophy", sortOrder: 8 },
        { name: "Birthday", slug: "birthday", taxonomyType: "occasion", icon: "Cake", sortOrder: 1 },
        { name: "Anniversary", slug: "anniversary", taxonomyType: "occasion", icon: "HeartHandshake", sortOrder: 2 },
        { name: "Graduation", slug: "graduation", taxonomyType: "occasion", icon: "GraduationCap", sortOrder: 3 },
        { name: "Wedding", slug: "wedding", taxonomyType: "occasion", icon: "Gem", sortOrder: 4 },
        { name: "Baby Shower", slug: "baby-shower", taxonomyType: "occasion", icon: "Baby", sortOrder: 5 },
        { name: "Religious", slug: "religious", taxonomyType: "other", icon: "Church", sortOrder: 1 },
        { name: "Sports", slug: "sports", taxonomyType: "other", icon: "Trophy", sortOrder: 2 },
        { name: "Business", slug: "business", taxonomyType: "other", icon: "Briefcase", sortOrder: 3 },
        { name: "Patriotic", slug: "patriotic", taxonomyType: "other", icon: "Flag", sortOrder: 4 },
      ];

      const created = [];
      for (const cat of defaultCategories) {
        try {
          const category = await storage.createProductCategory({
            ...cat,
            isActive: true,
          });
          created.push(category);
        } catch (e) {
        }
      }
      res.json({ created: created.length, categories: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ DASHBOARD & ANALYTICS ENDPOINTS ============

  // Get dashboard metrics (admin only)
  app.get("/api/admin/dashboard/metrics", isAdmin, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      let todayRevenue = 0;
      let weekRevenue = 0;
      let monthRevenue = 0;
      let pendingOrders = 0;
      let inProductionOrders = 0;
      let shippedOrders = 0;

      for (const order of orders) {
        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        const amount = parseFloat(order.total || "0");
        
        if (orderDate && orderDate >= today) todayRevenue += amount;
        if (orderDate && orderDate >= weekAgo) weekRevenue += amount;
        if (orderDate && orderDate >= monthAgo) monthRevenue += amount;
        
        if (order.status === "pending") pendingOrders++;
        if (order.status === "in_production") inProductionOrders++;
        if (order.status === "shipped") shippedOrders++;
      }

      const users = await storage.getUsers();
      const newUsersThisWeek = users.filter(u => {
        const created = u.createdAt ? new Date(u.createdAt) : null;
        return created && created >= weekAgo;
      }).length;

      const products = await storage.getProducts();
      const activeProducts = products.filter(p => p.isEnabled !== false).length;

      res.json({
        revenue: {
          today: todayRevenue,
          week: weekRevenue,
          month: monthRevenue,
          trend: 0,
        },
        orders: {
          total: orders.length,
          pending: pendingOrders,
          inProduction: inProductionOrders,
          shipped: shippedOrders,
          trend: 0,
        },
        customers: {
          total: users.length,
          newThisWeek: newUsersThisWeek,
          returning: users.length - newUsersThisWeek,
        },
        products: {
          active: activeProducts,
          lowStock: 0,
          syncErrors: 0,
        },
        health: await checkProviderHealth(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CUSTOMERS ENDPOINTS ============

  // Get all customers with stats (admin only)
  app.get("/api/admin/customers", isAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const orders = await storage.getOrders();

      const customerStats = users.map(user => {
        const userOrders = orders.filter(o => o.customerEmail === user.email);
        const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
        const lastOrder = userOrders.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })[0];

        return {
          ...user,
          orderCount: userOrders.length,
          totalSpent,
          lastOrderDate: lastOrder?.createdAt?.toISOString() || null,
        };
      });

      customerStats.sort((a, b) => b.totalSpent - a.totalSpent);

      res.json(customerStats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single customer with orders (admin only)
  app.get("/api/admin/customers/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const orders = await storage.getOrders();
      const userOrders = orders.filter(o => o.customerEmail === user.email);
      const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const lastOrder = userOrders[0];

      res.json({
        customer: {
          ...user,
          orderCount: userOrders.length,
          totalSpent,
          lastOrderDate: lastOrder?.createdAt?.toISOString() || null,
        },
        recentOrders: userOrders.slice(0, 10),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SYSTEM HEALTH ENDPOINTS ============

  // Get system health overview (admin only)
  app.get("/api/admin/health", isAdmin, async (req, res) => {
    try {
      const healthLogs = await storage.getProviderHealthLogs(50);

      const providerStatus: Record<string, { healthy: number; total: number; lastCheck: Date | null; avgResponse: number }> = {};
      
      for (const log of healthLogs) {
        const provider = log.providerType;
        if (!providerStatus[provider]) {
          providerStatus[provider] = { healthy: 0, total: 0, lastCheck: null, avgResponse: 0 };
        }
        providerStatus[provider].total++;
        if (log.isHealthy) providerStatus[provider].healthy++;
        if (!providerStatus[provider].lastCheck || log.checkTime > providerStatus[provider].lastCheck) {
          providerStatus[provider].lastCheck = log.checkTime;
        }
        if (log.responseTimeMs) {
          providerStatus[provider].avgResponse += log.responseTimeMs;
        }
      }

      const providers = Object.entries(providerStatus).map(([provider, stats]) => {
        const successRate = stats.total > 0 ? (stats.healthy / stats.total) * 100 : 100;
        let status: "healthy" | "degraded" | "down" = "healthy";
        if (successRate < 50) status = "down";
        else if (successRate < 90) status = "degraded";

        return {
          provider,
          status,
          lastCheck: stats.lastCheck?.toISOString() || new Date().toISOString(),
          responseMs: stats.total > 0 ? Math.round(stats.avgResponse / stats.total) : 0,
          successRate: Math.round(successRate * 10) / 10,
          recentErrors: stats.total - stats.healthy,
        };
      });

      if (providers.length === 0) {
        providers.push(
          { provider: "printify", status: "healthy", lastCheck: new Date().toISOString(), responseMs: 200, successRate: 100, recentErrors: 0 },
          { provider: "stripe", status: "healthy", lastCheck: new Date().toISOString(), responseMs: 100, successRate: 100, recentErrors: 0 }
        );
      }

      res.json({
        providers,
        recentLogs: healthLogs.slice(0, 20),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ COUPONS ENDPOINTS ============

  // Get all coupons (admin only)
  app.get("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const coupons = await storage.getCoupons();
      res.json(coupons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create coupon (admin only) - syncs with Stripe
  app.post("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        code: z.string().min(1).max(50),
        name: z.string().min(1),
        discountType: z.enum(["percent", "fixed"]),
        discountValue: z.string().refine(val => parseFloat(val) > 0, "Must be greater than 0"),
        currency: z.string().optional().default("usd"),
        minOrderAmount: z.string().nullable().optional(),
        maxRedemptions: z.number().nullable().optional(),
        validFrom: z.string().nullable().optional(),
        validUntil: z.string().nullable().optional(),
        isActive: z.boolean().optional().default(true),
      });

      const validated = createSchema.parse(req.body);

      const existing = await storage.getCouponByCode(validated.code);
      if (existing) {
        return res.status(409).json({ error: "A coupon with this code already exists" });
      }

      let stripeCouponId: string | null = null;
      let stripePromotionCodeId: string | null = null;

      try {
        const { getUncachableStripeClient } = await import("../stripeClient");
        const stripe = await getUncachableStripeClient();

        const stripeCoupon = await stripe.coupons.create({
          ...(validated.discountType === "percent"
            ? { percent_off: parseFloat(validated.discountValue) }
            : { amount_off: Math.round(parseFloat(validated.discountValue) * 100), currency: validated.currency }),
          name: validated.name,
          ...(validated.validUntil && { redeem_by: Math.floor(new Date(validated.validUntil).getTime() / 1000) }),
          ...(validated.maxRedemptions && { max_redemptions: validated.maxRedemptions }),
        });
        stripeCouponId = stripeCoupon.id;

        const promoCode = await stripe.promotionCodes.create({
          promotion: {
            type: 'coupon',
            coupon: stripeCoupon.id,
          },
          code: validated.code.toUpperCase(),
          active: validated.isActive,
        });
        stripePromotionCodeId = promoCode.id;
      } catch (stripeError: any) {
        console.error("Stripe coupon creation failed:", stripeError.message);
      }

      const coupon = await storage.createCoupon({
        code: validated.code,
        name: validated.name,
        discountType: validated.discountType,
        discountValue: validated.discountValue,
        currency: validated.currency,
        minOrderAmount: validated.minOrderAmount ?? null,
        maxRedemptions: validated.maxRedemptions ?? null,
        validFrom: validated.validFrom ? new Date(validated.validFrom) : null,
        validUntil: validated.validUntil ? new Date(validated.validUntil) : null,
        stripeCouponId,
        stripePromotionCodeId,
        isActive: validated.isActive,
      });

      res.json(coupon);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update coupon (admin only)
  app.put("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        maxRedemptions: z.number().nullable().optional(),
        validUntil: z.string().nullable().optional(),
      });

      const validated = updateSchema.parse(req.body);
      
      const existingCoupon = await storage.getCoupon(id);
      if (existingCoupon?.stripePromotionCodeId && validated.isActive !== undefined) {
        try {
          const { getUncachableStripeClient } = await import("../stripeClient");
          const stripe = await getUncachableStripeClient();
          await stripe.promotionCodes.update(existingCoupon.stripePromotionCodeId, {
            active: validated.isActive,
          });
        } catch (stripeError: any) {
          console.error("Stripe promo code update failed:", stripeError.message);
        }
      }

      const updated = await storage.updateCoupon(id, {
        ...(validated.name && { name: validated.name }),
        ...(validated.isActive !== undefined && { isActive: validated.isActive }),
        ...(validated.maxRedemptions !== undefined && { maxRedemptions: validated.maxRedemptions }),
        ...(validated.validUntil !== undefined && { validUntil: validated.validUntil ? new Date(validated.validUntil) : null }),
      });

      if (!updated) {
        return res.status(404).json({ error: "Coupon not found" });
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete coupon (admin only)
  app.delete("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const existingCoupon = await storage.getCoupon(id);
      if (existingCoupon?.stripePromotionCodeId) {
        try {
          const { getUncachableStripeClient } = await import("../stripeClient");
          const stripe = await getUncachableStripeClient();
          await stripe.promotionCodes.update(existingCoupon.stripePromotionCodeId, {
            active: false,
          });
        } catch (stripeError: any) {
          console.error("Stripe promo code deactivation failed:", stripeError.message);
        }
      }

      await storage.deleteCoupon(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate coupon code (public - for cart/checkout)
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const validateSchema = z.object({
        code: z.string().min(1),
        orderTotal: z.number().optional(),
      });

      const { code, orderTotal } = validateSchema.parse(req.body);
      const coupon = await storage.getCouponByCode(code);

      if (!coupon) {
        return res.status(404).json({ valid: false, error: "Invalid coupon code" });
      }

      if (!coupon.isActive) {
        return res.status(400).json({ valid: false, error: "This coupon is no longer active" });
      }

      const now = new Date();
      if (coupon.validFrom && now < new Date(coupon.validFrom)) {
        return res.status(400).json({ valid: false, error: "This coupon is not yet active" });
      }

      if (coupon.validUntil && now > new Date(coupon.validUntil)) {
        return res.status(400).json({ valid: false, error: "This coupon has expired" });
      }

      if (coupon.maxRedemptions && (coupon.redemptionCount || 0) >= coupon.maxRedemptions) {
        return res.status(400).json({ valid: false, error: "This coupon has reached its usage limit" });
      }

      if (coupon.minOrderAmount && orderTotal && orderTotal < parseFloat(coupon.minOrderAmount)) {
        return res.status(400).json({ 
          valid: false, 
          error: `Minimum order of $${coupon.minOrderAmount} required for this coupon` 
        });
      }

      let discountAmount = 0;
      if (orderTotal) {
        if (coupon.discountType === "percent") {
          discountAmount = orderTotal * (parseFloat(coupon.discountValue) / 100);
        } else {
          discountAmount = Math.min(parseFloat(coupon.discountValue), orderTotal);
        }
      }

      res.json({
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          stripePromotionCodeId: coupon.stripePromotionCodeId,
        },
        discountAmount: discountAmount.toFixed(2),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ valid: false, error: error.errors });
      }
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // ============ ADMIN: PARTNER STORE PRODUCTS ============
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
          
          const blackArtwork = designPlacements["front-chest"] || designPlacements["front-chest-black"];
          const whiteArtwork = designPlacements["front-chest-white"];
          
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

  // ============ ADMIN: GRAPHICS SAVE ============
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
}
