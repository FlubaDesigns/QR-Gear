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

  const providers = await storage.getAllPrintifyProviders();
  
  if (providers.length === 0) {
    console.log("[Cost Sync] No providers cached. Run catalog sync first.");
    return null;
  }

  const costSync = await storage.createCostSync({
    status: "running",
    totalProviders: providers.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
  });

  activeSyncId = costSync.id;
  isSyncRunning = true;

  runCostSyncBackground(costSync.id, providers, { forceRefresh, delayBetweenRequests });

  return costSync;
}

async function runCostSyncBackground(
  syncId: string,
  providers: PrintifyPrintProvider[],
  options: { forceRefresh: boolean; delayBetweenRequests: number }
): Promise<void> {
  const { forceRefresh, delayBetweenRequests } = options;
  
  console.log(`[Cost Sync] Starting background sync for ${providers.length} providers...`);
  
  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

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
        lastProcessedProviderId: provider.id,
      });
      activeSyncId = null;
      return;
    }

    if (!forceRefresh && provider.minCost && provider.minCost > 0) {
      console.log(`[Cost Sync] Skipping ${provider.blueprintId}/${provider.providerId} - already has cost $${(provider.minCost / 100).toFixed(2)}`);
      skippedCount++;
      processedCount++;
      continue;
    }

    try {
      const { placement, variantIds } = await printify.getCommonPlacement(provider.blueprintId, provider.providerId);
      
      const placeholderProduct = await printify.createPlaceholderProduct(
        provider.blueprintId,
        provider.providerId,
        variantIds,
        imageId,
        placement
      );

      const costs = printify.extractCostsFromProduct(placeholderProduct);

      await storage.updatePrintifyProviderCosts(provider.blueprintId, provider.providerId, {
        minCost: costs.minCost,
        maxCost: costs.maxCost,
        placeholderProductId: placeholderProduct.id,
      });

      try {
        await printify.deleteProduct(placeholderProduct.id);
      } catch {}

      console.log(`[Cost Sync] ${provider.blueprintId}/${provider.providerId}: $${(costs.minCost / 100).toFixed(2)} - $${(costs.maxCost / 100).toFixed(2)}`);
      successCount++;

    } catch (err: any) {
      console.error(`[Cost Sync] Failed for ${provider.blueprintId}/${provider.providerId}:`, err.message);
      failedCount++;
    }

    processedCount++;

    if (processedCount % 10 === 0) {
      await storage.updateCostSync(syncId, {
        processedCount,
        successCount,
        failedCount,
        skippedCount,
        lastProcessedProviderId: provider.id,
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
