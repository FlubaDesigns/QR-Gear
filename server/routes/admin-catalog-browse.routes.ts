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

      // ── Schema-first resolution (QRG.md §3) ─────────────────────────────────
      const stnnn = docId.slice(4);
      const sDigit = stnnn[0];
      const tDigit = stnnn[1];
      const stKey = `${sDigit}${tDigit}`;

      const QRG_S_FAMILY: Record<string, string> = {
        '1': 'apparel', '2': 'houseware', '3': 'print_display',
        '4': 'accessories', '5': 'pet', '6': 'holiday',
      };
      const QRG_ST_TYPE: Record<string, string> = {
        '11': 'tshirt', '12': 'hoodie', '13': 'tank', '14': 'longsleeve',
        '15': 'jacket', '16': 'shorts', '17': 'dress', '18': 'leggings',
        '21': 'drinkware', '22': 'kitchen', '23': 'home_decor',
        '31': 'poster', '32': 'canvas', '33': 'card',
        '41': 'bag', '42': 'hat', '43': 'phone_case', '44': 'jewelry',
        '51': 'pet_apparel', '52': 'pet_accessory',
        '61': 'ornament', '62': 'seasonal_decor',
      };
      const QRG_ST_COLLECTION: Record<string, string> = {
        '11': 'tshirts', '12': 'hoodies', '13': 'tanks', '14': 'longsleeves',
        '15': 'jackets', '16': 'shorts', '17': 'dresses', '18': 'leggings',
        '21': 'drinkware', '22': 'kitchen', '23': 'home_decor',
        '31': 'posters', '32': 'canvas', '33': 'cards',
        '41': 'bags', '42': 'hats', '43': 'phone_cases', '44': 'jewelry',
        '51': 'pet_apparel', '52': 'pet_accessories',
        '61': 'ornaments', '62': 'seasonal_decor',
      };

      const schemaFamily = QRG_S_FAMILY[sDigit] || 'unknown';
      const schemaType = QRG_ST_TYPE[stKey] || 'unknown';
      const schemaCollection = QRG_ST_COLLECTION[stKey] || 'unknown';
      const canonicalProfilePath = `layout_profiles/${schemaFamily}/${schemaCollection}`;

      // Load print_placements crosswalk + Tier 1 canonical profile in parallel
      const canonicalProfileRef = (schemaFamily !== 'unknown' && schemaCollection !== 'unknown')
        ? fsDb.collection('layout_profiles').doc(schemaFamily).collection(schemaCollection).doc('canonical')
        : null;

      const [placementsSnap, canonicalProfileDoc] = await Promise.all([
        fsDb.collection('print_placements').get(),
        canonicalProfileRef ? canonicalProfileRef.get() : Promise.resolve(null as any),
      ]);

      const placementMap = new Map<string, any>();
      for (const d of placementsSnap.docs) {
        placementMap.set(d.id, d.data());
      }

      // Build canonical dims map from Tier 1 profile
      const canonicalProfile = canonicalProfileDoc?.exists ? canonicalProfileDoc.data() : null;
      const canonicalDimsMap = new Map<string, any>();
      if (canonicalProfile?.placements) {
        for (const p of (canonicalProfile.placements as any[])) {
          if (p.id) canonicalDimsMap.set(p.id, p);
        }
      }

      type PrintLocation = {
        id: string; label: string; canonicalLocationCode: string;
        provider: string; providerPlacement: string; providerPlacementId: string;
        sourceTable: string; layoutSource?: string; dimensions?: any; printArea?: any; safeArea?: any;
        dpi?: number; rawProviderPlacement?: any;
      };
      let printLocations: PrintLocation[] = [];

      // Helper: resolve a canonical print_placements doc + id for a given position name.
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

      const buildLocation = (canonicalId: string, pp: any, providerEntry: any, provider: string): PrintLocation => {
        // Dimension fallback: provider crosswalk → print_placements doc → Tier 1 canonical profile
        const canonicalP = canonicalDimsMap.get(canonicalId);
        const dims = providerEntry.dimensions || pp.dimensions || canonicalP?.dimensions || null;
        const printArea = providerEntry.printArea || canonicalP?.printArea
          || (dims ? { widthPx: dims.widthPx, heightPx: dims.heightPx } : null);
        return {
          id: canonicalId,
          label: pp.displayName || canonicalId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          canonicalLocationCode: canonicalId,
          provider,
          providerPlacement: providerEntry.defaultDtgName || canonicalId,
          providerPlacementId: providerEntry.providerPlacementId || providerEntry.defaultDtgName || canonicalId,
          sourceTable: providerEntry.sourceTable || `${provider}_print_placements`,
          dimensions: dims,
          printArea,
          safeArea: providerEntry.safeArea || canonicalP?.safeArea || null,
          dpi: providerEntry.dpi || pp.dimensions?.dpi || canonicalP?.dpi || 300,
          rawProviderPlacement: providerEntry,
        };
      };

      // ── Provider-first resolution ──────────────────────────────────────────
      // For Printful: derive positions from printful_products/{id}.printLocations.
      // This is authoritative — product.printPositions is legacy cache only.
      // For Printify: falls through to cachedPositions + crosswalk (existing path).
      let providerPositions: string[] = [];
      const providerDimsMap = new Map<string, { widthPx: number; heightPx: number; dpi: number }>();
      let layoutSource = 'legacy_printPositions';
      let providerProductId: string | null = null;

      if (requestedProvider === 'printful' && product.printfulProductId) {
        try {
          providerProductId = String(product.printfulProductId);
          const pfDoc = await fsDb.collection('printful_products').doc(providerProductId).get();
          if (pfDoc.exists) {
            const pfData = pfDoc.data() as any;
            const pfLocs: any[] = Array.isArray(pfData.printLocations) ? pfData.printLocations : [];
            if (pfLocs.length > 0) {
              for (const loc of pfLocs) {
                if (loc.placement && !isEmbroideryPlacement(loc.placement)) {
                  providerPositions.push(loc.placement);
                  if (loc.width && loc.height) {
                    providerDimsMap.set(loc.placement, { widthPx: loc.width, heightPx: loc.height, dpi: 300 });
                  }
                }
              }
              layoutSource = 'provider_product_locations';
            }
          }
        } catch (_pfErr: any) { /* continue — fall through to cached positions */ }
      }

      // Positions to resolve: provider product data takes precedence over legacy cache
      const resolvePositions = providerPositions.length > 0 ? providerPositions : cachedPositions;

      if (resolvePositions.length > 0) {
        // seenCanonicalIds deduplicates cases where multiple provider names map to the
        // same canonical ID (e.g. "front" + "front_large" both → canonical "front").
        const seenCanonicalIds = new Set<string>();
        for (const pos of resolvePositions) {
          if (isEmbroideryPlacement(pos)) continue;
          const resolved = resolvePlacement(placementMap, pos, requestedProvider);
          if (!resolved) {
            if (layoutSource === 'provider_product_locations' && providerDimsMap.has(pos)) {
              if (seenCanonicalIds.has(pos)) continue;
              seenCanonicalIds.add(pos);
              const dims = providerDimsMap.get(pos)!;
              printLocations.push({
                id: pos,
                label: pos.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                canonicalLocationCode: pos,
                provider: requestedProvider,
                providerPlacement: pos,
                providerPlacementId: pos,
                sourceTable: `printful_products/${providerProductId}.printLocations`,
                layoutSource,
                dimensions: dims,
                printArea: { widthPx: dims.widthPx, heightPx: dims.heightPx },
                dpi: dims.dpi,
              });
            } else {
              console.warn(`[master-catalog/options] ${docId}: position "${pos}" not in print_placements — skipping`);
            }
            continue;
          }
          const { canonicalId, pp } = resolved;
          if (seenCanonicalIds.has(canonicalId)) continue;
          seenCanonicalIds.add(canonicalId);
          const providerEntry = pp.providers?.[requestedProvider];
          if (!providerEntry) continue;
          const actualDims = providerDimsMap.get(pos) || null;
          const enrichedEntry = (actualDims && !providerEntry.dimensions)
            ? { ...providerEntry, dimensions: actualDims }
            : providerEntry;
          const loc = buildLocation(canonicalId, pp, enrichedEntry, requestedProvider);
          const srcTable = layoutSource === 'provider_product_locations'
            ? `printful_products/${providerProductId}.printLocations`
            : (loc.sourceTable || `${requestedProvider}_print_placements`);
          printLocations.push({ ...loc, layoutSource, sourceTable: srcTable });
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
          all.push({ ...buildLocation(internalName, pp, providerEntry, requestedProvider), sortOrder: pp.sortOrder ?? 99, layoutSource });
        }
        all.sort((a, b) => a.sortOrder - b.sortOrder);
        printLocations = all;
      }

      // Tier 2: backfilled provider placements stored on master_catalog doc
      if (printLocations.length === 0) {
        const backfilled: any[] = requestedProvider === 'printful'
          ? (Array.isArray(product.printfulPlacements) ? product.printfulPlacements : [])
          : (Array.isArray(product.printifyPlacements) ? product.printifyPlacements : []);

        if (backfilled.length > 0) {
          printLocations = backfilled
            .filter((p: any) => !/embroider/i.test(p.position || ''))
            .map((p: any) => {
              const canonicalP = canonicalDimsMap.get(p.position);
              const dims = canonicalP?.dimensions
                || (p.width && p.height ? { widthPx: p.width, heightPx: p.height, dpi: 300 } : null);
              return {
                id: p.position,
                label: p.label || p.position.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                canonicalLocationCode: p.position,
                provider: requestedProvider,
                providerPlacement: p.position,
                providerPlacementId: p.position,
                sourceTable: `${requestedProvider}_placements_cached`,
                dimensions: dims,
                printArea: canonicalP?.printArea || (dims ? { widthPx: dims.widthPx, heightPx: dims.heightPx } : null),
                safeArea: canonicalP?.safeArea || null,
                dpi: canonicalP?.dpi || 300,
              };
            });
        }
      }

      if (printLocations.length === 0) {
        layoutSource = 'emergency_fallback';
        printLocations = [{
          id: 'front', label: 'Front', canonicalLocationCode: 'front',
          provider: requestedProvider, providerPlacement: 'front',
          providerPlacementId: 'front', sourceTable: `${requestedProvider}_print_placements`,
          layoutSource: 'emergency_fallback', dpi: 300,
        }];
      }

      console.log(`[master-catalog/options] ${docId} schema=${schemaFamily}/${schemaType} provider=${requestedProvider} → ${printLocations.length} placements (source=${layoutSource})`);

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
        // Schema identity — resolved from QRG STNNN digits before any provider query
        schemaFamily,
        schemaType,
        canonicalProfilePath,
        layoutSource,
        title: product.canonicalTitle || product.title || null,
        brand: product.brand || null,
        model: product.model || null,
        category: product.qrgCategory || product.category || null,
        availableSizes,
        availableColors,
        printLocations,
        provider: {
          name: requestedProvider,
          blueprintId: product.printifyBlueprintId ? String(product.printifyBlueprintId) : (product.blueprintId ? String(product.blueprintId) : null),
          printProviderId: product.printifyProviderId ? String(product.printifyProviderId) : null,
          printfulProductId: providerProductId,
        },
        qrgVariants,
      });
    } catch (e: any) {
      console.error('[master-catalog/options]', e.message);
      return res.status(500).json({ error: e.message });
    }
  });
}
