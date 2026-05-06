import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { fsGetAll } from "../lib/firestore-crud";
import { printify, syncProductPlacements, syncProductVariants } from "../lib/printify";
import { normalizePlacement, isEmbroideryPlacement } from '../../shared/placements';

const USA_MADE_BRANDS = [
  'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
  'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
  'shaka wear', 'backpacks usa', 'american giant', 'next level',
];

function categorizeProduct(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) return "T-Shirts & Tops";
  if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) return "Sweatshirts & Hoodies";
  if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) return "Hats & Caps";
  if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) return "Drinkware";
  if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) return "Bags & Accessories";
  if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) return "Phone Cases & Tech";
  if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) return "Stickers & Magnets";
  if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) return "Wall Art & Posters";
  if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) return "Home & Living";
  if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) return "Stationery & Paper";
  if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe')) return "Activewear & Specialty";
  if (t.includes('pet') || t.includes('dog')) return "Pet Products";
  if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake')) return "Holiday & Seasonal";
  if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie')) return "Accessories";
  return "Other";
}

export function registerAdminCatalogBrowseRoutes(app: Express): void {
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
        if (!blueprintId) {
          return res.status(400).json({ error: "blueprintId required for Printify" });
        }
        if (!printify) {
          return res.status(503).json({ error: "Printify API not configured" });
        }

        // ── Check master_catalog for stored placements first ──
        try {
          const { getFirestoreDb } = await import('../lib/firebase-admin');
          const fsDb = getFirestoreDb();
          if (fsDb) {
            const mcSnap = await fsDb.collection('master_catalog')
              .where('blueprintId', '==', blueprintId).limit(1).get();
            if (!mcSnap.empty) {
              const stored = mcSnap.docs[0].data()?.printify?.placements;
              if (Array.isArray(stored) && stored.length > 0) {
                const seenIds = new Set<string>();
                const mapped = stored
                  .map((p: any) => {
                    const normalized = normalizePlacement('printify', p.position);
                    return {
                      id: normalized,
                      type: normalized,
                      title: p.label,
                      additionalPrice: 0,
                      widthPx: p.printArea?.width ?? null,
                      heightPx: p.printArea?.height ?? null,
                    };
                  })
                  .filter((p: any) => {
                    if (seenIds.has(p.id)) return false;
                    seenIds.add(p.id);
                    return true;
                  });
                console.log(`[Placements] blueprint=${blueprintId} → ${mapped.length} from master_catalog`);
                return res.json({ placements: mapped, source: 'master-catalog' });
              }
            }
          }
        } catch (mcErr: any) {
          console.warn(`[Placements] master_catalog check failed, falling back to live API:`, mcErr.message);
        }

        let resolvedProviderId = printProviderId;

        if (!resolvedProviderId) {
          const allProviders = await storage.getAllPrintifyProviders();
          const matching = allProviders.filter(p => p.blueprintId === blueprintId);
          if (matching.length > 0) {
            const best = matching.reduce((prev, cur) => {
              const prevColors = Array.isArray(prev.availableColors) ? prev.availableColors.length : 0;
              const curColors = Array.isArray(cur.availableColors) ? cur.availableColors.length : 0;
              return curColors > prevColors ? cur : prev;
            });
            resolvedProviderId = best.providerId;
          }
        }

        if (!resolvedProviderId) {
          try {
            const livePrintProviders = await printify.getPrintProviders(blueprintId);
            if (livePrintProviders && livePrintProviders.length > 0) {
              resolvedProviderId = livePrintProviders[0].id;
            }
          } catch (provErr: any) {
            console.warn(`[Placements] Could not fetch live providers for blueprint ${blueprintId}:`, provErr.message);
          }
        }

        if (!resolvedProviderId) {
          return res.status(400).json({ error: "No print provider found for this blueprint. Try syncing the catalog first." });
        }

        const { placements } = await syncProductPlacements(blueprintId, resolvedProviderId);
        const seenIds = new Set<string>();
        const mapped = placements
          .map(p => {
            const normalized = normalizePlacement('printify', p.position);
            return {
              id: normalized,
              type: normalized,
              title: p.label,
              additionalPrice: 0,
            };
          })
          .filter(p => {
            if (seenIds.has(p.id)) return false;
            seenIds.add(p.id);
            return true;
          });
        console.log(`[Placements] blueprint=${blueprintId} provider=${resolvedProviderId} → ${placements.length} raw, ${mapped.length} unique normalized`);
        return res.json({ placements: mapped, source: 'printify-api' });
      }

      if (provider === 'printful') {
        if (!productId) {
          return res.status(400).json({ error: "productId required for Printful" });
        }

        // ── Check master_catalog for stored Printful placements first ──
        try {
          const { getFirestoreDb } = await import('../lib/firebase-admin');
          const fsDb = getFirestoreDb();
          if (fsDb) {
            const mcSnap = await fsDb.collection('master_catalog')
              .where('printfulId', '==', productId).limit(1).get();
            if (!mcSnap.empty) {
              const stored = mcSnap.docs[0].data()?.printful?.placements;
              if (Array.isArray(stored) && stored.length > 0) {
                const { groupPlacementsByLocation } = await import('../../shared/placements');
                const seenIds = new Set<string>();
                const grouped = groupPlacementsByLocation('printful', stored.map((p: any) => p.position));
                const mapped = grouped
                  .filter((g: any) => {
                    if (seenIds.has(g.internal)) return false;
                    seenIds.add(g.internal);
                    return true;
                  })
                  .map((g: any) => ({
                    id: g.internal,
                    type: g.internal,
                    title: g.internal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                    additionalPrice: 0,
                    methods: g.methods.map((m: any) => ({ method: m.method, providerName: m.providerName })),
                  }));
                console.log(`[Placements] printfulId=${productId} → ${mapped.length} from master_catalog`);
                return res.json({ placements: mapped, source: 'master-catalog' });
              }
            }
          }
        } catch (mcErr: any) {
          console.warn(`[Placements] master_catalog check failed, falling back to live Printful API:`, mcErr.message);
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

  // ── GET /api/admin/master-catalog/products/:docId/options ─────────────────────
  // Dev-server equivalent of the Cloud Functions options endpoint.
  // Filters print locations through the print_placements crosswalk for the
  // selected provider — only placements with a providers[requestedProvider] entry
  // are returned.
  app.get("/api/admin/master-catalog/products/:docId/options", isAdmin, async (req: any, res) => {
    try {
      const { docId } = req.params;
      // Normalize "both" → "printify". The crosswalk only has entries for a specific
      // provider; "both" would match nothing and fall through to the front-only fallback.
      const rawProvider = (typeof req.query.provider === 'string' ? req.query.provider : 'printify').toLowerCase();
      const requestedProvider = (!rawProvider || rawProvider === 'both') ? 'printify' : rawProvider;

      if (!/^qrg_[1-6][1-9][0-9]{3}$/.test(docId)) {
        return res.status(400).json({ error: 'INVALID_QRG_DOC_ID' });
      }

      const { getFirestoreDb } = await import('../lib/firebase-admin');
      const fsDb = getFirestoreDb();
      if (!fsDb) {
        return res.status(503).json({ error: 'Firestore not available' });
      }

      const doc = await fsDb.collection('master_catalog').doc(docId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'MASTER_PRODUCT_NOT_FOUND' });
      }
      const product = doc.data() as any;
      const qrgBlankId: string = product.qrgBlankId || docId.slice(4);
      const cachedPositions: string[] = Array.isArray(product.printPositions) ? product.printPositions : [];

      // Load print_placements crosswalk
      const placementsSnap = await fsDb.collection('print_placements').get();
      const placementMap = new Map<string, any>();
      for (const d of placementsSnap.docs) {
        placementMap.set(d.id, d.data());
      }

      type PrintLocation = {
        id: string; label: string; canonicalLocationCode: string;
        provider: string; providerPlacement: string; providerPlacementId: string;
        sourceTable: string; dimensions?: any; printArea?: any; safeArea?: any;
        dpi?: number; rawProviderPlacement?: any;
      };
      let printLocations: PrintLocation[] = [];

      // Helper: resolve a canonical print_placements doc + id for a given position name.
      // Tries direct doc-id lookup first, then scans provider dtgNames/dtfNames.
      const resolvePlacement = (
        map: Map<string, any>, pos: string, provider: string,
      ): { canonicalId: string; pp: any } | null => {
        const direct = map.get(pos);
        if (direct) return { canonicalId: pos, pp: direct };
        const entries = Array.from(map.entries());
        for (const [cId, candidate] of entries) {
          const entry = candidate.providers?.[provider];
          if (!entry) continue;
          if ((entry.dtgNames || []).includes(pos) || (entry.dtfNames || []).includes(pos)) {
            return { canonicalId: cId, pp: candidate };
          }
        }
        return null;
      };

      const buildLocation = (canonicalId: string, pp: any, providerEntry: any, provider: string): PrintLocation => ({
        id: canonicalId,
        label: pp.displayName || canonicalId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        canonicalLocationCode: canonicalId,
        provider,
        providerPlacement: providerEntry.defaultDtgName || canonicalId,
        providerPlacementId: providerEntry.providerPlacementId || providerEntry.defaultDtgName || canonicalId,
        sourceTable: providerEntry.sourceTable || `${provider}_print_placements`,
        dimensions: providerEntry.dimensions || pp.dimensions || null,
        printArea: providerEntry.printArea || null,
        safeArea: providerEntry.safeArea || null,
        dpi: providerEntry.dpi || pp.dimensions?.dpi || 300,
        rawProviderPlacement: providerEntry,
      });

      if (cachedPositions.length > 0) {
        for (const pos of cachedPositions) {
          if (isEmbroideryPlacement(pos)) continue;
          const resolved = resolvePlacement(placementMap, pos, requestedProvider);
          if (!resolved) {
            console.warn(`[master-catalog/options] ${docId}: position "${pos}" not in print_placements — skipping`);
            continue;
          }
          const { canonicalId, pp } = resolved;
          const providerEntry = pp.providers?.[requestedProvider];
          if (!providerEntry) continue;
          printLocations.push(buildLocation(canonicalId, pp, providerEntry, requestedProvider));
        }
        printLocations.sort((a, b) => {
          const aOrd = placementMap.get(a.id)?.sortOrder ?? 99;
          const bOrd = placementMap.get(b.id)?.sortOrder ?? 99;
          return aOrd - bOrd;
        });
      } else {
        const all: Array<PrintLocation & { sortOrder: number }> = [];
        for (const [internalName, pp] of Array.from(placementMap.entries())) {
          if (!pp.isActive) continue;
          if (isEmbroideryPlacement(internalName)) continue;
          const providerEntry = pp.providers?.[requestedProvider];
          if (!providerEntry) continue;
          all.push({ ...buildLocation(internalName, pp, providerEntry, requestedProvider), sortOrder: pp.sortOrder ?? 99 });
        }
        all.sort((a, b) => a.sortOrder - b.sortOrder);
        printLocations = all;
      }

      if (printLocations.length === 0) {
        printLocations = [{
          id: 'front', label: 'Front', canonicalLocationCode: 'front',
          provider: requestedProvider, providerPlacement: 'front',
          providerPlacementId: 'front', sourceTable: `${requestedProvider}_print_placements`,
          dpi: 300,
        }];
      }

      console.log(`[master-catalog/options] ${docId} provider=${requestedProvider} → ${printLocations.length} placements`);

      // Build sizes and colors from qrgVariants
      const qrgVariants: Record<string, any> = product.qrgVariants || {};
      const sizeCodesInVariants = new Set<string>();
      const colorCodesInVariants = new Set<string>();

      for (const vc of Object.keys(qrgVariants)) {
        sizeCodesInVariants.add(vc.slice(0, 2));
        colorCodesInVariants.add(vc.slice(2, 4));
      }

      const sizeCodes = sizeCodesInVariants.size > 0
        ? Array.from(sizeCodesInVariants).sort()
        : (Array.isArray(product.availableSizes) ? product.availableSizes : []);
      const colorCodes = colorCodesInVariants.size > 0
        ? Array.from(colorCodesInVariants).sort()
        : (Array.isArray(product.availableColors) ? product.availableColors : []);

      const availableSizes = sizeCodes.map((code: string) => ({ code, label: code, providerValues: [] }));
      const availableColors = colorCodes.map((code: string) => ({ code, label: code, providerValues: [] }));

      return res.json({
        docId,
        qrgBlankId,
        title: product.canonicalTitle || product.title || null,
        brand: product.brand || null,
        model: product.model || null,
        category: product.qrgCategory || product.category || null,
        availableSizes,
        availableColors,
        printLocations,
        provider: {
          name: requestedProvider,
          blueprintId: product.blueprintId ? String(product.blueprintId) : null,
          printProviderId: null,
        },
        qrgVariants,
      });
    } catch (e: any) {
      console.error('[master-catalog/options]', e.message);
      return res.status(500).json({ error: e.message });
    }
  });
}
