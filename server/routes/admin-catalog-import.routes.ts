import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { printify, syncProductPlacements, syncProductVariants, detectCategory } from "../lib/printify";
import { autoSyncVariantsFromLocalCatalog } from "./route-helpers";

export function registerAdminCatalogImportRoutes(app: Express): void {
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

      const blueprintsSnap = await fsDb.collection('printify_blueprints').get();
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
