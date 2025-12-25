import { storage } from "../storage";
import type { MasterProduct, ChannelConfig, ChannelPublishState } from "@shared/schema";

export interface BulkPublishRequest {
  productIds: string[];
  channelTypes: string[];
}

export interface BulkPublishItemResult {
  productId: string;
  productTitle: string;
  channelType: string;
  success: boolean;
  listingId?: string;
  error?: string;
  durationMs: number;
}

export interface BulkPublishResult {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalItems: number;
  completedItems: number;
  successCount: number;
  failureCount: number;
  results: BulkPublishItemResult[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

const activeJobs = new Map<string, BulkPublishResult>();

export class BulkPublisher {
  private concurrencyLimit = 3;

  async createJob(request: BulkPublishRequest): Promise<string> {
    const jobId = `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const job: BulkPublishResult = {
      jobId,
      status: "pending",
      totalItems: request.productIds.length * request.channelTypes.length,
      completedItems: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      startedAt: new Date().toISOString(),
    };
    
    activeJobs.set(jobId, job);
    
    this.executeJob(jobId, request).catch(err => {
      console.error(`[BulkPublisher] Job ${jobId} failed:`, err);
      const job = activeJobs.get(jobId);
      if (job) {
        job.status = "failed";
        job.completedAt = new Date().toISOString();
      }
    });
    
    return jobId;
  }

  getJob(jobId: string): BulkPublishResult | undefined {
    return activeJobs.get(jobId);
  }

  getAllJobs(): BulkPublishResult[] {
    return Array.from(activeJobs.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 50);
  }

  private async executeJob(jobId: string, request: BulkPublishRequest): Promise<void> {
    const job = activeJobs.get(jobId);
    if (!job) return;
    
    job.status = "running";
    const startTime = Date.now();
    
    const products = await Promise.all(
      request.productIds.map(id => storage.getMasterProduct(id))
    );
    const validProducts = products.filter((p): p is MasterProduct => p !== undefined);
    
    const configs = await Promise.all(
      request.channelTypes.map(type => storage.getChannelConfig(type))
    );
    const validConfigs = configs.filter((c): c is ChannelConfig => c !== undefined && c.isEnabled === true);
    
    const tasks: { product: MasterProduct; config: ChannelConfig }[] = [];
    for (const product of validProducts) {
      for (const config of validConfigs) {
        tasks.push({ product, config });
      }
    }
    
    job.totalItems = tasks.length;
    
    for (let i = 0; i < tasks.length; i += this.concurrencyLimit) {
      const batch = tasks.slice(i, i + this.concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(({ product, config }) => this.publishSingle(product, config))
      );
      
      for (const result of batchResults) {
        job.results.push(result);
        job.completedItems++;
        if (result.success) {
          job.successCount++;
        } else {
          job.failureCount++;
        }
      }
    }
    
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.durationMs = Date.now() - startTime;
  }

  private async publishSingle(
    product: MasterProduct,
    config: ChannelConfig,
    maxRetries = 2
  ): Promise<BulkPublishItemResult> {
    const startTime = Date.now();
    let lastError = "";
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const existingState = await storage.getPublishState(product.id, config.channelType);
        
        if (existingState?.status === "published" && existingState.externalListingId) {
          return {
            productId: product.id,
            productTitle: product.title,
            channelType: config.channelType,
            success: true,
            listingId: existingState.externalListingId,
            durationMs: Date.now() - startTime,
          };
        }
        
        const adapterModule = await this.getAdapter(config.channelType);
        if (!adapterModule) {
          throw new Error(`No adapter available for channel: ${config.channelType}`);
        }
        
        const adapter = new adapterModule.default();
        
        await storage.upsertPublishState({
          masterProductId: product.id,
          channelType: config.channelType,
          status: "pending",
          lastSyncedAt: new Date(),
        });
        
        const listingData = this.buildListingData(product, config);
        const result = await adapter.createListing(listingData);
        
        await storage.upsertPublishState({
          masterProductId: product.id,
          channelType: config.channelType,
          status: "published",
          externalListingId: result.listingId,
          lastSyncedAt: new Date(),
          lastPublishedAt: new Date(),
        });
        
        return {
          productId: product.id,
          productTitle: product.title,
          channelType: config.channelType,
          success: true,
          listingId: result.listingId,
          durationMs: Date.now() - startTime,
        };
      } catch (error: any) {
        lastError = error.message;
        console.log(`[BulkPublisher] Attempt ${attempt + 1}/${maxRetries + 1} failed for ${product.sku} -> ${config.channelType}: ${lastError}`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
        await storage.upsertPublishState({
          masterProductId: product.id,
          channelType: config.channelType,
          status: "failed",
          lastError: lastError,
          lastSyncedAt: new Date(),
        });
      }
    }
    
    return {
      productId: product.id,
      productTitle: product.title,
      channelType: config.channelType,
      success: false,
      error: lastError,
      durationMs: Date.now() - startTime,
    };
  }

  private async getAdapter(channelType: string): Promise<any> {
    try {
      switch (channelType) {
        case "printify":
          return await import("../adapters/print-providers/printify");
        case "printful":
          return await import("../adapters/print-providers/printful");
        case "apliiq":
          return await import("../adapters/print-providers/apliiq");
        case "etsy":
          return await import("../adapters/marketplaces/etsy");
        case "ebay":
          return await import("../adapters/marketplaces/ebay");
        case "amazon":
          return await import("../adapters/marketplaces/amazon");
        default:
          return null;
      }
    } catch (err) {
      console.error(`[BulkPublisher] Failed to load adapter for ${channelType}:`, err);
      return null;
    }
  }

  private buildListingData(product: MasterProduct, config: ChannelConfig): any {
    const settings = (config.settings || {}) as { priceMultiplier?: number };
    const priceMultiplier = settings.priceMultiplier || 1.0;
    const basePrice = product.retailPrice ? parseFloat(product.retailPrice) : 0;
    const channelPrice = basePrice * priceMultiplier;
    
    return {
      title: product.title,
      description: product.description || "",
      price: channelPrice,
      sku: product.sku,
      images: [],
      tags: product.tags || [],
      variants: [],
      productType: product.productType,
    };
  }
}

export const bulkPublisher = new BulkPublisher();
