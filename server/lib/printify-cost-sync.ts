import { storage } from "../storage";
import { printify } from "./printify";
import type { PrintifyCostSync, PrintifyPrintProvider } from "@shared/schema";

interface CostSyncOptions {
  forceRefresh?: boolean;
  batchSize?: number;
  delayBetweenRequests?: number;
}

let activeSyncId: string | null = null;
let isSyncRunning = false;

export function isCostSyncRunning(): boolean {
  return isSyncRunning;
}

export function getActiveSyncId(): string | null {
  return activeSyncId;
}

export async function startCostSync(options: CostSyncOptions = {}): Promise<PrintifyCostSync | null> {
  const {
    forceRefresh = false,
    batchSize = 50,
    delayBetweenRequests = 3000,
  } = options;

  if (isSyncRunning) {
    console.log("[Cost Sync] Sync already in progress, skipping...");
    return null;
  }

  if (!printify.isConfigured) {
    console.error("[Cost Sync] Printify API not configured");
    return null;
  }

  const allProviders = await storage.getAllPrintifyProviders();
  
  if (allProviders.length === 0) {
    console.log("[Cost Sync] No providers cached. Run catalog sync first.");
    return null;
  }

  let providers = allProviders;
  let previousSync = await storage.getLatestCostSync();
  let startingCounts = { processedCount: 0, successCount: 0, failedCount: 0, skippedCount: 0 };

  if (previousSync?.status === 'paused' && previousSync.lastProcessedProviderId) {
    const lastIdx = allProviders.findIndex(p => p.id === previousSync.lastProcessedProviderId);
    if (lastIdx >= 0 && lastIdx < allProviders.length - 1) {
      providers = allProviders.slice(lastIdx + 1);
      startingCounts = {
        processedCount: previousSync.processedCount ?? 0,
        successCount: previousSync.successCount ?? 0,
        failedCount: previousSync.failedCount ?? 0,
        skippedCount: previousSync.skippedCount ?? 0,
      };
      console.log(`[Cost Sync] Resuming from provider ${lastIdx + 1}/${allProviders.length}`);
    }
  }

  const costSync = await storage.createCostSync({
    status: "running",
    totalProviders: allProviders.length,
    processedCount: startingCounts.processedCount,
    successCount: startingCounts.successCount,
    failedCount: startingCounts.failedCount,
    skippedCount: startingCounts.skippedCount,
  });

  activeSyncId = costSync.id;
  isSyncRunning = true;

  runCostSyncBackground(costSync.id, providers, { forceRefresh, delayBetweenRequests, startingCounts });

  return costSync;
}

async function runCostSyncBackground(
  syncId: string,
  providers: PrintifyPrintProvider[],
  options: { 
    forceRefresh: boolean; 
    delayBetweenRequests: number;
    startingCounts?: { processedCount: number; successCount: number; failedCount: number; skippedCount: number };
  }
): Promise<void> {
  const { forceRefresh, delayBetweenRequests, startingCounts } = options;
  
  console.log(`[Cost Sync] Starting background sync for ${providers.length} providers...`);
  
  let processedCount = startingCounts?.processedCount ?? 0;
  let successCount = startingCounts?.successCount ?? 0;
  let failedCount = startingCounts?.failedCount ?? 0;
  let skippedCount = startingCounts?.skippedCount ?? 0;
  let lastCompletedProviderId: string | null = null;

  let imageId: string | null = null;
  try {
    imageId = await printify.getOrCreatePlaceholderImage();
    console.log(`[Cost Sync] Using placeholder image: ${imageId}`);
  } catch (err: any) {
    console.error(`[Cost Sync] Failed to upload placeholder image:`, err.message);
    await storage.updateCostSync(syncId, {
      status: "failed",
      errorMessage: `Failed to upload placeholder image: ${err.message}`,
      completedAt: new Date(),
    });
    isSyncRunning = false;
    activeSyncId = null;
    return;
  }

  for (const provider of providers) {
    if (!isSyncRunning) {
      console.log("[Cost Sync] Sync was cancelled");
      await storage.updateCostSync(syncId, {
        status: "paused",
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        lastProcessedProviderId: lastCompletedProviderId,
      });
      activeSyncId = null;
      return;
    }

    if (!forceRefresh && provider.minCost && provider.minCost > 0) {
      console.log(`[Cost Sync] Skipping ${provider.blueprintId}/${provider.providerId} - already has cost $${(provider.minCost / 100).toFixed(2)}`);
      skippedCount++;
      processedCount++;
      lastCompletedProviderId = provider.id;
      continue;
    }

    let tempProductId: string | null = null;
    try {
      const { placement, variantIds } = await printify.getCommonPlacement(provider.blueprintId, provider.providerId);
      
      const placeholderProduct = await printify.createPlaceholderProduct(
        provider.blueprintId,
        provider.providerId,
        variantIds,
        imageId,
        placement
      );
      tempProductId = placeholderProduct.id;

      const costs = printify.extractCostsFromProduct(placeholderProduct);
      const colorsAndSizes = printify.extractColorsAndSizes(placeholderProduct);

      await storage.updatePrintifyProviderCosts(provider.blueprintId, provider.providerId, {
        minCost: costs.minCost,
        maxCost: costs.maxCost,
        placeholderProductId: placeholderProduct.id,
        availableColors: colorsAndSizes.colors,
        availableSizes: colorsAndSizes.sizes,
      });

      // Auto-update product prices with new cost data
      const productionCostDollars = costs.minCost / 100;
      const settings = await storage.getAdminSettings();
      const markupPercent = settings?.globalMarkupPercent ? parseFloat(settings.globalMarkupPercent) : 25;
      const markupFixed = settings?.globalMarkupFixed ? parseFloat(settings.globalMarkupFixed) : 0;
      const qrCost = settings?.globalQrProductionCost ? parseFloat(settings.globalQrProductionCost) : 2;
      
      const totalCost = productionCostDollars + qrCost + markupFixed;
      const retailPrice = Math.ceil((totalCost * (1 + markupPercent / 100)) * 100) / 100;
      
      // Update any products using this blueprint/provider
      const updatedCount = await storage.updateProductPricesByProvider(
        provider.blueprintId, 
        provider.providerId, 
        retailPrice.toFixed(2)
      );
      
      if (updatedCount > 0) {
        console.log(`[Cost Sync] Updated ${updatedCount} product(s) with price $${retailPrice.toFixed(2)}`);
      }

      console.log(`[Cost Sync] ${provider.blueprintId}/${provider.providerId}: $${(costs.minCost / 100).toFixed(2)} - $${(costs.maxCost / 100).toFixed(2)}, ${colorsAndSizes.colors.length} colors, ${colorsAndSizes.sizes.length} sizes`);
      successCount++;

    } catch (err: any) {
      console.error(`[Cost Sync] Failed for ${provider.blueprintId}/${provider.providerId}:`, err.message);
      failedCount++;
    } finally {
      if (tempProductId) {
        try {
          await printify.deleteProduct(tempProductId);
        } catch {}
      }
    }

    processedCount++;
    lastCompletedProviderId = provider.id;

    if (processedCount % 10 === 0) {
      await storage.updateCostSync(syncId, {
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        lastProcessedProviderId: lastCompletedProviderId,
      });
    }

    await new Promise(r => setTimeout(r, delayBetweenRequests));
  }

  await storage.updateCostSync(syncId, {
    status: "completed",
    processedCount,
    successCount,
    failedCount,
    skippedCount,
    completedAt: new Date(),
  });

  console.log(`[Cost Sync] Complete! Success: ${successCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);
  
  isSyncRunning = false;
  activeSyncId = null;
}

export function cancelCostSync(): void {
  if (isSyncRunning) {
    console.log("[Cost Sync] Cancelling sync...");
    isSyncRunning = false;
  }
}

export async function getCostSyncStatus(): Promise<{
  isRunning: boolean;
  currentSync: PrintifyCostSync | undefined;
  stats: { total: number; withCosts: number; stale: number };
}> {
  const [currentSync, stats] = await Promise.all([
    storage.getLatestCostSync(),
    storage.getProviderCostStats(),
  ]);

  return {
    isRunning: isSyncRunning,
    currentSync,
    stats,
  };
}
