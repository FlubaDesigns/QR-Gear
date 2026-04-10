import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { fsGetAll, fsCount } from "../lib/firestore-crud";
import { printify, syncProductPlacements, syncProductVariants, detectCategory } from "../lib/printify";
import { startCostSync, getCostSyncStatus, cancelCostSync, isCostSyncRunning } from "../lib/printify-cost-sync";
import { autoSyncVariantsFromLocalCatalog } from "./route-helpers";
import { normalizePlacement, normalizePlacements, isEmbroideryPlacement } from '../../shared/placements';
import { registerAdminCatalogBrowseRoutes } from "./admin-catalog-browse.routes";
import { registerAdminCatalogImportRoutes } from "./admin-catalog-import.routes";

export function registerAdminCatalogSyncRoutes(app: Express): void {
  registerAdminCatalogBrowseRoutes(app);
  registerAdminCatalogImportRoutes(app);

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

  // ── Master Catalog Sync proxy → Cloud Functions ──────────────────────────
  // Forwards to CF with the caller's Firebase ID token so requireAdmin passes.
  const CF_BASE = process.env.FUNCTIONS_BASE_URL || 'https://api-b3rye3vhuq-uc.a.run.app';

  app.post('/api/admin/master-catalog/sync', isAdmin, async (req: any, res) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      const response = await fetch(`${CF_BASE}/admin/master-catalog/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(req.body || {}),
      });

      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('[MasterCatalogProxy] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
