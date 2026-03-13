import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { fsGetAll, fsCount } from "../lib/firestore-crud";
import { printify, syncProductPlacements, syncProductVariants, detectCategory } from "../lib/printify";
import { startCostSync, getCostSyncStatus, cancelCostSync, isCostSyncRunning } from "../lib/printify-cost-sync";
import { autoSyncVariantsFromLocalCatalog } from "./route-helpers";
import { normalizePlacement, normalizePlacements, isEmbroideryPlacement } from '../../shared/placements';

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

export function registerAdminCatalogSyncRoutes(app: Express): void {
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

      const [localBlueprints, allProviders, allPrintfulRows] = await Promise.all([
        storage.getPrintifyBlueprints(),
        storage.getAllPrintifyProviders(),
        fsGetAll('printful_products'),
      ]);

      let allPrintifyBlueprints: any[] = [];
      if (localBlueprints.length > 0) {
        allPrintifyBlueprints = localBlueprints.map(bp => ({
          id: bp.id,
          title: bp.title,
          description: (bp as any).description || '',
          brand: bp.brand,
          model: bp.model,
          images: bp.images || [],
        }));
      } else if (printify) {
        allPrintifyBlueprints = await printify.getCatalogBlueprints();
      }

      const providersByBlueprint = new Map<number, { colors: Array<{name: string; hex?: string}>; sizes: string[]; minCost: number; maxCost: number; providerId: number }>();
      for (const prov of allProviders) {
        const existing = providersByBlueprint.get(prov.blueprintId);
        const colors = Array.isArray(prov.availableColors) ? prov.availableColors as Array<{name: string; hex?: string}> : [];
        const sizes = Array.isArray(prov.availableSizes) ? prov.availableSizes : [];
        const minCost = prov.minCost || 0;
        const maxCost = prov.maxCost || 0;
        if (!existing || colors.length > existing.colors.length) {
          providersByBlueprint.set(prov.blueprintId, { colors, sizes, minCost, maxCost, providerId: prov.providerId });
        }
      }

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
        matchedModels = new Set(Array.from(printifyModels).filter(m => printfulModels.has(m)));
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

          const provData = providersByBlueprint.get(bp.id);
          const rawDesc = bp.description || '';
          const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          
          const catalogItem = {
            id: bp.id,
            title: bp.title,
            description: cleanDesc,
            brand: bp.brand,
            model: bp.model,
            imageUrl: bp.images?.[0] || null,
            madeInUSA: isUSABrand,
            blueprintId: bp.id,
            printProviderId: provData?.providerId || null,
            minPrice: provData?.minCost ? (provData.minCost / 100).toFixed(2) : null,
            maxPrice: provData?.maxCost ? (provData.maxCost / 100).toFixed(2) : null,
            colorCount: provData?.colors.length || 0,
            availableColors: provData?.colors || [],
            availableSizes: provData?.sizes || [],
            fulfillmentProvider: 'printify',
            provider: 'printify',
            dualProvider: !!matchedPrintful,
            matchedProviderId: matchedPrintful ? `printful-${matchedPrintful.id}` : null,
          };
          categories[category].push(catalogItem);
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
          
          const pfColors = Array.isArray(pf.availableColors) ? pf.availableColors as Array<{name: string; hex?: string}> : [];
          const pfSizes = Array.isArray(pf.availableSizes) ? pf.availableSizes as string[] : [];

          categories[category].push({
            id: pf.id,
            title: pf.title,
            description: pf.description || '',
            brand: pf.brand || '',
            model: pf.model || '',
            imageUrl: pf.image || null,
            madeInUSA: isUSABrand,
            blueprintId: pf.id,
            printProviderId: null,
            minPrice: pf.minPrice || null,
            maxPrice: pf.maxPrice || null,
            colorCount: pfColors.length,
            availableColors: pfColors,
            availableSizes: pfSizes,
            fulfillmentProvider: 'printful',
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

  app.get("/api/admin/catalog/placements", isAdmin, async (req: any, res) => {
    try {
      const provider = req.query.provider as string;
      const blueprintId = req.query.blueprintId ? parseInt(req.query.blueprintId as string) : null;
      const printProviderId = req.query.printProviderId ? parseInt(req.query.printProviderId as string) : null;
      const productId = req.query.productId ? parseInt(req.query.productId as string) : null;

      if (provider === 'printify') {
        if (!blueprintId || !printProviderId) {
          return res.status(400).json({ error: "blueprintId and printProviderId required for Printify" });
        }
        if (!printify) {
          return res.status(503).json({ error: "Printify API not configured" });
        }
        const { placements } = await syncProductPlacements(blueprintId, printProviderId);
        const mapped = placements.map(p => {
          const normalized = normalizePlacement('printify', p.position);
          return {
            id: normalized,
            type: normalized,
            title: p.label,
            additionalPrice: 0,
          };
        });
        return res.json({ placements: mapped, source: 'printify-api' });
      }

      if (provider === 'printful') {
        if (!productId) {
          return res.status(400).json({ error: "productId required for Printful" });
        }
        const { printfulClient } = await import('../lib/printful');
        const { groupPlacementsByLocation } = await import('../../shared/placements');
        const printfileInfo = await printfulClient.getPrintfiles(productId);
        const rawPlacements = printfileInfo?.available_placements
          ? Object.keys(printfileInfo.available_placements)
          : [];
        const printPlacements = rawPlacements.filter(p => !isEmbroideryPlacement(p));
        const grouped = groupPlacementsByLocation('printful', printPlacements);
        const mapped = grouped.map(g => {
          const label = g.internal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          return {
            id: g.internal,
            type: g.internal,
            title: label,
            additionalPrice: 0,
            methods: g.methods.map(m => ({ method: m.method, providerName: m.providerName })),
          };
        });
        return res.json({ placements: mapped, source: 'printful-api' });
      }

      return res.status(400).json({ error: "provider must be 'printify' or 'printful'" });
    } catch (error: any) {
      console.error("Placement fetch error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

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

  app.get("/api/admin/catalog/sync-status", isAdmin, async (req: any, res) => {
    try {
      const syncId = req.query.syncId;
      if (syncId) {
        const syncs = await storage.getCatalogSyncHistory();
        const sync = syncs.find((s: any) => s.id === syncId);
        if (!sync) return res.status(404).json({ error: "Sync not found" });
        let summary = null;
        if (sync.status === 'completed' && sync.errorMessage) {
          try { summary = JSON.parse(sync.errorMessage); } catch {}
        }
        return res.json({ ...sync, summary });
      }
      const latest = await storage.getLatestCatalogSync();
      if (!latest) return res.json({ status: 'none', message: 'No sync has been run yet' });
      let summary = null;
      if (latest.status === 'completed' && latest.errorMessage) {
        try { summary = JSON.parse(latest.errorMessage); } catch {}
      }
      res.json({ ...latest, summary, totalBlueprints: (await storage.getPrintifyBlueprints()).length, isConfigured: printify?.isConfigured || false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog/sync-history", isAdmin, async (req: any, res) => {
    try {
      const history = await storage.getCatalogSyncHistory();
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalog/sync", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      const latestSync = await storage.getLatestCatalogSync();
      if (latestSync?.status === 'running') {
        const startedAt = latestSync.startedAt ? new Date(latestSync.startedAt).getTime() : 0;
        const staleThreshold = 30 * 60 * 1000;
        if (Date.now() - startedAt < staleThreshold) {
          return res.status(409).json({ error: "Sync already in progress", syncId: latestSync.id });
        }
        await storage.updateCatalogSync(latestSync.id, {
          status: 'failed',
          errorMessage: 'Timed out - cleared as stale',
          completedAt: new Date(),
        });
      }
      
      const syncRecord = await storage.createCatalogSync({
        syncType: 'smart',
        status: 'running',
        blueprintsCount: 0,
        providersCount: 0,
      });
      
      res.json({ syncId: syncRecord.id, status: 'started', message: 'Smart sync started — only changed items will be updated' });
      
      (async () => {
        try {
          console.log('[SmartSync] Starting smart catalog sync...');
          
          const existingBlueprints = await storage.getPrintifyBlueprints();
          const existingBpMap = new Map<number, any>();
          for (const bp of existingBlueprints) {
            existingBpMap.set(bp.id, bp);
          }
          
          const existingProviders = await storage.getAllPrintifyProviders();
          const existingProvMap = new Map<string, any>();
          for (const prov of existingProviders) {
            existingProvMap.set(`${prov.blueprintId}_${prov.providerId}`, prov);
          }
          
          console.log(`[SmartSync] Loaded ${existingBpMap.size} existing blueprints, ${existingProvMap.size} existing providers from Firestore`);
          
          const allProvidersList = await printify.getAllPrintProviders();
          const providerLocationMap = new Map<number, { country: string; isUSA: boolean }>();
          for (const p of allProvidersList) {
            const country = p.location?.country || '';
            providerLocationMap.set(p.id, {
              country,
              isUSA: country === 'US' || country === 'USA',
            });
          }
          
          const blueprints = await printify.getCatalogBlueprints();
          console.log(`[SmartSync] Found ${blueprints.length} blueprints from Printify API`);
          
          let bpAdded = 0, bpUpdated = 0, bpSkipped = 0;
          let provAdded = 0, provUpdated = 0, provSkipped = 0;
          
          for (const bp of blueprints) {
            try {
              const existing = existingBpMap.get(bp.id);
              const newCategory = detectCategory(bp.title, bp.brand || '');
              const newImageUrl = bp.images?.[0] || null;
              
              const changed = !existing ||
                existing.title !== bp.title ||
                existing.brand !== (bp.brand || null) ||
                existing.model !== (bp.model || null) ||
                existing.primaryImageUrl !== newImageUrl ||
                existing.category !== newCategory;
              
              if (changed) {
                await storage.upsertPrintifyBlueprint({
                  id: bp.id,
                  title: bp.title,
                  description: bp.description || null,
                  brand: bp.brand || null,
                  model: bp.model || null,
                  images: bp.images || null,
                  primaryImageUrl: newImageUrl,
                  category: newCategory,
                });
                if (existing) { bpUpdated++; } else { bpAdded++; }
              } else {
                bpSkipped++;
              }
              
              const providers = await printify.getPrintProviders(bp.id);
              for (const provider of providers) {
                const loc = providerLocationMap.get(provider.id);
                const country = loc?.country || null;
                const isUSA = loc?.isUSA || false;
                const key = `${bp.id}_${provider.id}`;
                const existingProv = existingProvMap.get(key);
                
                const provChanged = !existingProv ||
                  existingProv.title !== provider.title ||
                  existingProv.country !== country ||
                  existingProv.isUSA !== isUSA;
                
                if (provChanged) {
                  await storage.upsertPrintifyPrintProvider({
                    blueprintId: bp.id,
                    providerId: provider.id,
                    title: provider.title,
                    country,
                    isUSA,
                  });
                  if (existingProv) { provUpdated++; } else { provAdded++; }
                } else {
                  provSkipped++;
                }
              }
              
              await new Promise(r => setTimeout(r, 100));
              
            } catch (bpError: any) {
              console.error(`[SmartSync] Error syncing blueprint ${bp.id}:`, bpError.message);
            }
          }
          
          const summary = {
            blueprints: { added: bpAdded, updated: bpUpdated, skipped: bpSkipped, total: blueprints.length },
            providers: { added: provAdded, updated: provUpdated, skipped: provSkipped },
          };
          
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'completed',
            blueprintsCount: bpAdded + bpUpdated,
            providersCount: provAdded + provUpdated,
            completedAt: new Date(),
            errorMessage: JSON.stringify(summary),
          });
          
          console.log(`[SmartSync] Done.`, JSON.stringify(summary));
          
        } catch (error: any) {
          console.error('[SmartSync] Error:', error.message);
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

  app.delete("/api/admin/catalog/clear", isAdmin, async (req: any, res) => {
    try {
      await storage.clearPrintifyPrintProviders();
      await storage.clearPrintifyBlueprints();
      res.json({ success: true, message: "Local catalog cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

  app.get("/api/admin/catalog/cost-sync-status", isAdmin, async (req: any, res) => {
    try {
      const status = await getCostSyncStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalog/cancel-cost-sync", isAdmin, async (req: any, res) => {
    try {
      cancelCostSync();
      res.json({ success: true, message: "Cost sync cancellation requested" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
        const result = await syncPrintfulCatalog(productIds ? { productIds } : undefined);
        console.log('[Printful Sync] Background sync complete:', result);
      } catch (syncError: any) {
        console.error('[Printful Sync] Background sync error:', syncError.message);
      }
      
    } catch (error: any) {
      console.error('[Printful Sync] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog/printful-status", isAdmin, async (req: any, res) => {
    try {
      const { printfulClient } = await import("../lib/printful");
      
      const productCountNum = await fsCount('printful_products');
      const variantCountNum = await fsCount('printful_variants');
      
      const isConfigured = printfulClient.isConfigured;
      console.log('[Printful Status] isConfigured:', isConfigured);
      
      res.json({
        isConfigured,
        productCount: productCountNum,
        variantCount: variantCountNum,
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  function classifyPrintfulProduct(typeName: string): string {
    const n = (typeName || "").toLowerCase();

    if (n.startsWith("all-over print")) return "All-Over Print";

    if (n.includes("t-shirt") || n.includes("tank top") || n.includes("crop top") || n.includes("jersey") || (n.includes("tee") && !n.includes("steer")))
      return "T-Shirts & Tops";
    if (n.includes("cardigan") || n.includes("jacket") || n.includes("windbreaker") || n.includes("bomber") || n.includes("vest") || n.includes("sweater") || n.includes("quarter-zip") || n.includes("quarter zip"))
      return "Outerwear & Layers";
    if (n.includes("hoodie") || n.includes("hood") || n.includes("sweatshirt") || n.includes("pullover") || n.includes("fleece"))
      return "Hoodies & Sweatshirts";
    if (n.includes("hat") || n.includes("beanie") || n.includes("cap") || n.includes("visor"))
      return "Hats & Headwear";
    if (n.includes("canvas shoe") || n.includes("athletic shoe") || n.includes("slide") || n.includes("sneaker") || (n.includes("shoe") && !n.includes("shower")))
      return "Footwear";
    if (n.includes("mug") || n.includes("tumbler") || n.includes("glass") || n.includes("bottle") || n.includes("can cooler") || n.includes("wine"))
      return "Drinkware";
    if (n.includes("poster") || n.includes("canvas") || n.includes("framed") || n.includes("tapestry") || n.includes("flag") || n.includes("pennant") || n.includes("metal print") || n.includes("glossy metal") || n.includes("photo paper"))
      return "Wall Art & Prints";
    if (n.includes("iphone") || n.includes("samsung") || n.includes("airpods") || n.includes("magsafe") || n.includes("phone case") || n.includes("snap case"))
      return "Phone & Tech Cases";
    if (n.includes("sticker") || n.includes("decal") || n.includes("magnet") || n.includes("patch"))
      return "Stickers & Patches";
    if (n.includes("bag") || n.includes("tote") || n.includes("backpack") || n.includes("fanny pack") || n.includes("crossbody") || n.includes("luggage") || n.includes("duffle") || n.includes("weekender"))
      return "Bags & Accessories";
    if (n.includes("dress") || n.includes("skirt") || n.includes("bikini") || n.includes("swimsuit") || n.includes("swim trunk") || n.includes("bra") || n.includes("pajama") || n.includes("rash guard"))
      return "Dresses & Swimwear";
    if (n.includes("short") || n.includes("pant") || n.includes("jogger") || n.includes("legging") || n.includes("sweatpant"))
      return "Bottoms";
    if (n.includes("pillow") || n.includes("blanket") || n.includes("comforter") || n.includes("rug") || n.includes("towel") || n.includes("curtain") || n.includes("coaster") || n.includes("napkin") || n.includes("placemat") || n.includes("cutting board") || n.includes("doormat") || n.includes("apron") || n.includes("shower"))
      return "Home & Living";
    if (n.includes("mouse pad") || n.includes("desk mat") || n.includes("laptop"))
      return "Desk & Office";
    if (n.includes("yoga mat") || n.includes("yoga"))
      return "Activewear";
    if (n.includes("sock") || n.includes("gaiter") || n.includes("bandana") || n.includes("headband") || n.includes("scarf"))
      return "Socks & Accessories";
    if (n.includes("kid") || n.includes("youth") || n.includes("baby"))
      return "Kids & Youth";
    if (n.includes("pet") || n.includes("dog") || n.includes("collar") || n.includes("leash") || n.includes("pet bowl") || n.includes("feeding mat"))
      return "Pet Products";
    if (n.includes("ornament") || n.includes("christmas") || n.includes("stocking") || n.includes("gift wrap") || n.includes("wrapping"))
      return "Seasonal & Holiday";
    if (n.includes("candle") || n.includes("lotion") || n.includes("wash") || n.includes("soap"))
      return "Beauty & Wellness";
    if (n.includes("polo"))
      return "Polo Shirts";
    if (n.includes("playing card") || n.includes("poker") || n.includes("puzzle") || n.includes("pickleball"))
      return "Games & Sports";
    if (n.includes("notebook") || n.includes("journal") || n.includes("notepad") || n.includes("calendar") || n.includes("greeting card") || n.includes("business card"))
      return "Stationery & Paper";
    if (n.includes("pin button") || n.includes("pin ") || n.includes("set of pin"))
      return "Pins & Buttons";
    if (n.includes("license plate") || n.includes("vanity plate"))
      return "Auto & Outdoors";
    if (n.includes("mat") || n.includes("bath"))
      return "Home & Living";

    return "Other";
  }

  function buildPrintfulVariantLookup(variants: any[]): Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }> {
    const lookup = new Map<number, { colorsMap: Map<string, string>; sizesSet: Set<string> }>();
    for (const v of variants) {
      const pid = v.productId;
      if (!pid) continue;
      if (!lookup.has(pid)) lookup.set(pid, { colorsMap: new Map(), sizesSet: new Set() });
      const entry = lookup.get(pid)!;
      if (v.color && !entry.colorsMap.has(v.color)) {
        entry.colorsMap.set(v.color, v.colorCode || "#888");
      }
      if (v.size) entry.sizesSet.add(v.size);
    }
    const result = new Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }>();
    for (const [pid, entry] of Array.from(lookup.entries())) {
      result.set(pid, {
        colors: Array.from(entry.colorsMap.entries()).map(([name, hex]: [string, string]) => ({ name, hex })),
        sizes: Array.from(entry.sizesSet),
      });
    }
    return result;
  }

  app.get("/api/admin/catalog/printful-products", isAdmin, async (req: any, res) => {
    try {
      const [products, allVariants] = await Promise.all([
        fsGetAll('printful_products', 'lastSyncedAt', 'desc'),
        fsGetAll('printful_variants'),
      ]);
      const variantLookup = buildPrintfulVariantLookup(allVariants);
      
      const grouped: Record<string, any[]> = {};
      for (const p of products) {
        const categoryName = classifyPrintfulProduct(p.typeName || p.type || "");
        if (!grouped[categoryName]) grouped[categoryName] = [];
        const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
        grouped[categoryName].push({
          id: p.id,
          title: p.title,
          brand: p.brand || "",
          model: p.model || "",
          imageUrl: p.image || null,
          madeInUSA: (p.originCountry || "").toUpperCase() === "US",
          minPrice: p.minPrice || null,
          maxPrice: p.maxPrice || null,
          colorCount: vData.colors.length,
          availableColors: vData.colors,
          availableSizes: vData.sizes,
          blueprintId: p.id,
          printProviderId: null,
          hasMockupMapping: false,
          fulfillmentProvider: 'printful',
        });
      }
      
      const result = Object.entries(grouped).map(([name, items]) => ({
        name,
        items,
        count: items.length,
      }));
      
      res.json(result);
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/catalog/printful-products", async (_req: any, res) => {
    try {
      const [products, allVariants] = await Promise.all([
        fsGetAll('printful_products', 'lastSyncedAt', 'desc'),
        fsGetAll('printful_variants'),
      ]);
      const variantLookup = buildPrintfulVariantLookup(allVariants);

      const grouped: Record<string, any[]> = {};
      for (const p of products) {
        const categoryName = classifyPrintfulProduct(p.typeName || p.type || "");
        if (!grouped[categoryName]) grouped[categoryName] = [];
        const rawPlacements = (p.availablePlacements || []).filter((pid: string) => !isEmbroideryPlacement(pid));
        const normalizedIds = normalizePlacements('printful', rawPlacements);
        const placements = normalizedIds.map((nid) => ({
          id: nid, type: nid,
          title: nid.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          additionalPrice: 0,
        }));
        const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
        grouped[categoryName].push({
          id: p.id, title: p.title, brand: p.brand || "", model: p.model || "",
          imageUrl: p.image || null,
          madeInUSA: (p.originCountry || "").toUpperCase() === "US",
          minPrice: p.minPrice || null, maxPrice: p.maxPrice || null,
          colorCount: vData.colors.length,
          availableColors: vData.colors,
          availableSizes: vData.sizes,
          blueprintId: p.id, printProviderId: null, hasMockupMapping: false,
          fulfillmentProvider: 'printful',
          placements: placements.length > 0 ? placements : null,
        });
      }
      const result = Object.entries(grouped).map(([name, items]) => ({ name, items, count: items.length }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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

  app.post("/api/admin/products/sync", isAdmin, async (req: any, res) => {
    try {
      const provider = req.query?.provider || req.body?.provider || 'printify';
      
      if (provider === 'printful') {
        const { syncPrintfulCatalog, printfulClient } = await import("../lib/printful");
        if (!printfulClient.isConfigured) {
          return res.status(503).json({ error: "Printful API key not configured" });
        }
        res.json({ status: 'started', message: 'Printful smart sync started in background' });
        try {
          const result = await syncPrintfulCatalog();
          console.log('[ProductsSync] Printful sync complete:', result);
        } catch (e: any) {
          console.error('[ProductsSync] Printful sync error:', e.message);
        }
        return;
      }
      
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      const latestSync = await storage.getLatestCatalogSync();
      if (latestSync?.status === 'running') {
        const startedAt = latestSync.startedAt ? new Date(latestSync.startedAt).getTime() : 0;
        const staleThreshold = 30 * 60 * 1000;
        if (Date.now() - startedAt < staleThreshold) {
          return res.status(409).json({ error: "Sync already in progress", syncId: latestSync.id });
        }
        await storage.updateCatalogSync(latestSync.id, {
          status: 'failed',
          errorMessage: 'Timed out - cleared as stale',
          completedAt: new Date(),
        });
      }

      const syncRecord = await storage.createCatalogSync({
        syncType: 'smart',
        status: 'running',
        blueprintsCount: 0,
        providersCount: 0,
      });

      res.json({ syncId: syncRecord.id, synced: 0, status: 'started', message: 'Smart sync started — only changed items will be updated' });

      (async () => {
        try {
          console.log('[SmartSync] Starting smart catalog sync (products/sync route)...');
          
          const existingBlueprints = await storage.getPrintifyBlueprints();
          const existingBpMap = new Map<number, any>();
          for (const bp of existingBlueprints) {
            existingBpMap.set(bp.id, bp);
          }
          
          const existingProviders = await storage.getAllPrintifyProviders();
          const existingProvMap = new Map<string, any>();
          for (const prov of existingProviders) {
            existingProvMap.set(`${prov.blueprintId}_${prov.providerId}`, prov);
          }
          
          const allProvidersList = await printify.getAllPrintProviders();
          const providerLocationMap = new Map<number, { country: string; isUSA: boolean }>();
          for (const p of allProvidersList) {
            const country = p.location?.country || '';
            providerLocationMap.set(p.id, {
              country,
              isUSA: country === 'US' || country === 'USA',
            });
          }
          
          const blueprints = await printify.getCatalogBlueprints();
          
          let bpAdded = 0, bpUpdated = 0, bpSkipped = 0;
          let provAdded = 0, provUpdated = 0, provSkipped = 0;

          for (const bp of blueprints) {
            try {
              const existing = existingBpMap.get(bp.id);
              const newCategory = detectCategory(bp.title, bp.brand || '');
              const newImageUrl = bp.images?.[0] || null;
              
              const changed = !existing ||
                existing.title !== bp.title ||
                existing.brand !== (bp.brand || null) ||
                existing.model !== (bp.model || null) ||
                existing.primaryImageUrl !== newImageUrl ||
                existing.category !== newCategory;
              
              if (changed) {
                await storage.upsertPrintifyBlueprint({
                  id: bp.id,
                  title: bp.title,
                  description: bp.description || null,
                  brand: bp.brand || null,
                  model: bp.model || null,
                  images: bp.images || null,
                  primaryImageUrl: newImageUrl,
                  category: newCategory,
                });
                if (existing) { bpUpdated++; } else { bpAdded++; }
              } else {
                bpSkipped++;
              }

              const providers = await printify.getPrintProviders(bp.id);
              for (const provider of providers) {
                const loc = providerLocationMap.get(provider.id);
                const country = loc?.country || null;
                const isUSA = loc?.isUSA || false;
                const key = `${bp.id}_${provider.id}`;
                const existingProv = existingProvMap.get(key);
                
                const provChanged = !existingProv ||
                  existingProv.title !== provider.title ||
                  existingProv.country !== country ||
                  existingProv.isUSA !== isUSA;
                
                if (provChanged) {
                  await storage.upsertPrintifyPrintProvider({
                    blueprintId: bp.id,
                    providerId: provider.id,
                    title: provider.title,
                    country,
                    isUSA,
                  });
                  if (existingProv) { provUpdated++; } else { provAdded++; }
                } else {
                  provSkipped++;
                }
              }

              await new Promise(r => setTimeout(r, 100));
            } catch (bpError: any) {
              console.error(`[SmartSync] Error syncing blueprint ${bp.id}:`, bpError.message);
            }
          }

          const summary = {
            blueprints: { added: bpAdded, updated: bpUpdated, skipped: bpSkipped, total: blueprints.length },
            providers: { added: provAdded, updated: provUpdated, skipped: provSkipped },
          };

          await storage.updateCatalogSync(syncRecord.id, {
            status: 'completed',
            blueprintsCount: bpAdded + bpUpdated,
            providersCount: provAdded + provUpdated,
            completedAt: new Date(),
            errorMessage: JSON.stringify(summary),
          });

          console.log(`[SmartSync] Done.`, JSON.stringify(summary));
        } catch (bgError: any) {
          console.error('[SmartSync] Background sync error:', bgError.message);
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'failed',
            errorMessage: bgError.message,
            completedAt: new Date(),
          });
        }
      })();
    } catch (error: any) {
      console.error('[AdminProducts] Sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/bulk-import", isAdmin, async (req: any, res) => {
    try {
      console.log('[BulkImport] Starting bulk product import from cached blueprints...');
      const { detectCategory } = await import("../lib/printify");
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();

      const existingProducts = await storage.getAllProducts();
      const existingBlueprintProviders = new Set(
        existingProducts
          .filter(p => p.blueprintId && p.printProviderId)
          .map(p => `${p.blueprintId}_${p.printProviderId}`)
      );

      const blueprintsSnap = await fsDb.collection('printifyBlueprints').get();
      const blueprintMap = new Map<number, any>();
      blueprintsSnap.docs.forEach(doc => {
        const d = doc.data();
        blueprintMap.set(parseInt(doc.id), d);
      });

      const providersSnap = await fsDb.collection('printifyPrintProviders').get();

      const bestProviders = new Map<number, any>();
      providersSnap.docs.forEach(doc => {
        const d = doc.data();
        if (!d.minCost || d.minCost <= 0) return;
        if (!d.availableColors || !Array.isArray(d.availableColors) || d.availableColors.length === 0) return;

        const bpId = d.blueprintId;
        const existing = bestProviders.get(bpId);
        if (!existing || d.availableColors.length > (existing.availableColors?.length || 0)) {
          bestProviders.set(bpId, { ...d, docId: doc.id });
        }
      });

      console.log(`[BulkImport] Found ${blueprintMap.size} blueprints, ${bestProviders.size} with cost+color data`);

      const pricingDoc = await fsDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const [blueprintId, provider] of Array.from(bestProviders.entries())) {
        const key = `${blueprintId}_${provider.providerId}`;
        if (existingBlueprintProviders.has(key)) {
          skipped++;
          continue;
        }

        const blueprint = blueprintMap.get(blueprintId);
        if (!blueprint) {
          skipped++;
          continue;
        }

        try {
          const baseCostCents = provider.minCost || 0;
          const baseCost = (baseCostCents / 100).toFixed(2);
          const baseCostNum = baseCostCents / 100;
          const customerPrice = (Math.ceil((baseCostNum * (1 + markupPercent / 100) + markupFixed) * 100) / 100).toFixed(2);

          const category = blueprint.category || detectCategory(blueprint.title || '', blueprint.brand || '');
          const productId = `printify_${blueprintId}_${provider.providerId}`;

          const placements = ['front'];
          if (category === 't-shirts' || category === 'hoodies' || category === 'long-sleeves') {
            placements.push('back');
          }

          await storage.createProduct({
            id: productId,
            printifyId: null,
            blueprintId: blueprintId,
            printProviderId: provider.providerId,
            name: blueprint.title || `Product ${blueprintId}`,
            description: blueprint.description || `${blueprint.brand || ''} ${blueprint.title || ''}`.trim(),
            category: category,
            basePrice: baseCost,
            customerPrice: customerPrice,
            imageUrl: blueprint.primaryImageUrl || blueprint.images?.[0] || null,
            manufacturer: blueprint.brand || null,
            madeInUSA: false,
            availablePlacements: placements,
            availableColors: provider.availableColors || [],
            availableSizes: provider.availableSizes || [],
            metadata: {
              fulfillmentProvider: 'printify',
              importedAt: new Date().toISOString(),
              maxCost: provider.maxCost ? (provider.maxCost / 100).toFixed(2) : baseCost,
            },
            isEnabled: true,
            isFeatured: false,
            markupPercent: String(markupPercent),
            markupFixed: String(markupFixed),
            qrProductionCost: "0",
            sortOrder: created,
          });
          created++;

          if (created % 50 === 0) {
            console.log(`[BulkImport] Created ${created} products so far...`);
          }
        } catch (err: any) {
          errors.push(`Blueprint ${blueprintId}: ${err.message}`);
        }
      }

      console.log(`[BulkImport] Complete: ${created} created, ${skipped} skipped, ${errors.length} errors`);
      res.json({
        success: true,
        created,
        skipped,
        errors: errors.slice(0, 10),
        total: bestProviders.size,
      });
    } catch (error: any) {
      console.error('[BulkImport] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
