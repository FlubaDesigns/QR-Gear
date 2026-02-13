import { fsGet, fsGetAll, fsQuery, fsQueryOne, fsInsert, fsUpdate, fsDelete, fsDeleteWhere } from "./firestore-crud";
import { type MockupJob, type InsertMockupJob } from "@shared/schema";
import { generatePrintfulMockup } from "./mockup-service";

interface JobResult {
  mockupUrl?: string;
  lifestyleMockupUrl?: string;
  error?: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  delayed: number;
}

const BASE_DELAY_MS = 2500;
const MAX_DELAY_MS = 120000;
const JITTER_MS = 500;

function calculateBackoff(attempts: number): number {
  const exponentialDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * JITTER_MS * 2) - JITTER_MS;
  return exponentialDelay + jitter;
}

export class MockupJobQueue {
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 3000;

  async createJob(params: {
    productId: string;
    colorName: string;
    qrSize: "small" | "medium" | "large";
    placement: string;
    blueprintId: number;
    printProviderId: number;
    artworkUrl: string;
    artworkVariant: "black" | "white";
    priority?: number;
  }): Promise<MockupJob> {
    const jobData = {
      blueprintId: params.blueprintId,
      printProviderId: params.printProviderId,
      artworkUrl: params.artworkUrl,
      artworkVariant: params.artworkVariant,
    };

    const job = await fsInsert('mockup_jobs', {
      productId: params.productId,
      colorName: params.colorName,
      qrSize: params.qrSize,
      placement: params.placement,
      jobData,
      status: "pending",
      priority: params.priority ?? 10,
      attempts: 0,
      maxAttempts: 5,
    });

    return job;
  }

  async createBatchJobs(params: {
    productId: string;
    colors: Array<{ name: string; hex: string }>;
    qrSizes?: Array<"small" | "medium" | "large">;
    placements?: string[];
    blueprintId: number;
    printProviderId: number;
    artworkUrl: string;
    artworkVariant: "black" | "white";
  }): Promise<MockupJob[]> {
    const jobs: MockupJob[] = [];
    const qrSizes = params.qrSizes || ["small", "medium", "large"];
    const placements = params.placements || ["front-chest"];
    
    let priority = 0;
    for (const placement of placements) {
      for (const color of params.colors) {
        for (const qrSize of qrSizes) {
          const job = await this.createJob({
            productId: params.productId,
            colorName: color.name,
            qrSize,
            placement,
            blueprintId: params.blueprintId,
            printProviderId: params.printProviderId,
            artworkUrl: params.artworkUrl,
            artworkVariant: params.artworkVariant,
            priority: priority++,
          });
          jobs.push(job);
        }
      }
    }

    return jobs;
  }

  async getJob(jobId: string): Promise<MockupJob | null> {
    const job = await fsGet('mockup_jobs', jobId);
    return job || null;
  }

  async getJobsByProduct(productId: string): Promise<MockupJob[]> {
    const jobs = await fsQuery('mockup_jobs', [['productId', '==', productId]]);
    return jobs.sort((a: any, b: any) => (a.priority ?? 10) - (b.priority ?? 10));
  }

  async getStats(): Promise<QueueStats> {
    const allJobs = await fsGetAll('mockup_jobs');
    return {
      pending: allJobs.filter(j => j.status === "pending").length,
      processing: allJobs.filter(j => j.status === "processing").length,
      completed: allJobs.filter(j => j.status === "completed").length,
      failed: allJobs.filter(j => j.status === "failed").length,
      delayed: allJobs.filter(j => j.status === "delayed").length,
    };
  }

  async bumpPriority(params: {
    productId: string;
    colorName: string;
    qrSize: string;
    placement: string;
    viewerId: string;
  }): Promise<MockupJob | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minute TTL
    
    const existingJob = await fsQueryOne('mockup_jobs', [
      ['productId', '==', params.productId],
      ['colorName', '==', params.colorName],
      ['qrSize', '==', params.qrSize],
      ['placement', '==', params.placement],
    ]);
    
    if (!existingJob) {
      return null;
    }
    
    if (existingJob.status !== "pending" && existingJob.status !== "delayed") {
      return existingJob;
    }
    
    const updatedJob = await fsUpdate('mockup_jobs', existingJob.id, {
      priority: -1,
      priorityUpdatedAt: now,
      priorityOwner: params.viewerId,
      priorityExpiresAt: expiresAt,
    });
    
    console.log(`[MockupQueue] Bumped priority for ${params.colorName}/${params.qrSize}/${params.placement} (job ${existingJob.id})`);
    return updatedJob;
  }

  async getNextJob(): Promise<MockupJob | null> {
    const now = new Date();
    
    const pendingJobs = await fsQuery('mockup_jobs', [['status', '==', 'pending']]);
    const delayedJobs = await fsQuery('mockup_jobs', [['status', '==', 'delayed']]);
    
    const eligibleDelayed = delayedJobs.filter(j => {
      const nextRetry = j.nextRetryAt instanceof Date ? j.nextRetryAt : new Date(j.nextRetryAt);
      return nextRetry <= now;
    });
    
    const allEligible = [...pendingJobs, ...eligibleDelayed].sort((a, b) => {
      if ((a.priority ?? 10) !== (b.priority ?? 10)) return (a.priority ?? 10) - (b.priority ?? 10);
      const aUpdated = a.priorityUpdatedAt ? new Date(a.priorityUpdatedAt).getTime() : 0;
      const bUpdated = b.priorityUpdatedAt ? new Date(b.priorityUpdatedAt).getTime() : 0;
      if (bUpdated !== aUpdated) return bUpdated - aUpdated;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aCreated - bCreated;
    });

    return allEligible.length > 0 ? allEligible[0] : null;
  }

  async markProcessing(jobId: string): Promise<void> {
    const job = await fsGet('mockup_jobs', jobId);
    if (!job) return;
    
    await fsUpdate('mockup_jobs', jobId, { 
      status: "processing", 
      startedAt: new Date(),
      attempts: (job.attempts || 0) + 1,
    });
  }

  async markCompleted(jobId: string, result: JobResult): Promise<void> {
    await fsUpdate('mockup_jobs', jobId, {
      status: "completed",
      completedAt: new Date(),
      resultData: result,
      errorMessage: null,
    });
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const job = await fsGet('mockup_jobs', jobId);
    if (!job) return;

    const attempts = (job.attempts || 0);
    const maxAttempts = job.maxAttempts || 5;

    if (attempts >= maxAttempts) {
      await fsUpdate('mockup_jobs', jobId, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: error,
      });
    } else {
      const backoffMs = calculateBackoff(attempts);
      const nextRetry = new Date(Date.now() + backoffMs);
      
      await fsUpdate('mockup_jobs', jobId, {
        status: "delayed",
        nextRetryAt: nextRetry,
        errorMessage: error,
      });
      
      console.log(`[JobQueue] Job ${jobId} delayed, retry at ${nextRetry.toISOString()} (attempt ${attempts}/${maxAttempts})`);
    }
  }

  async processJob(job: MockupJob): Promise<JobResult> {
    const jobData = job.jobData as any;
    
    console.log(`[JobQueue] Processing job ${job.id}: ${job.productId} / ${job.colorName} / ${job.qrSize}`);

    try {
      const result = await generatePrintfulMockup({
        productId: job.productId,
        blueprintId: jobData.blueprintId,
        printProviderId: jobData.printProviderId,
        colorName: job.colorName,
        artworkUrl: jobData.artworkUrl,
        artworkVariant: jobData.artworkVariant,
        qrSize: job.qrSize as "small" | "medium" | "large",
      });

      if (result.error) {
        return { error: result.error };
      }

      return {
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleUrl,
      };
    } catch (err: any) {
      return { error: err.message || "Unknown error" };
    }
  }

  async processNextJob(): Promise<boolean> {
    if (this.isProcessing) return false;

    const job = await this.getNextJob();
    if (!job) return false;

    this.isProcessing = true;

    try {
      await this.markProcessing(job.id);
      const result = await this.processJob(job);

      if (result.error) {
        await this.markFailed(job.id, result.error);
        
        if (result.error.includes("429")) {
          console.log("[JobQueue] Rate limited, pausing for 60 seconds...");
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      } else {
        await this.markCompleted(job.id, result);
        
        await this.updateProductMockups(job, result);
      }

      return true;
    } finally {
      this.isProcessing = false;
    }
  }

  private async updateProductMockups(job: MockupJob, result: JobResult): Promise<void> {
    try {
      const product = await fsGet('products', job.productId);
      if (!product) return;

      const mockupsByColor = (product.mockupsByColor || {}) as Record<string, any>;
      
      const placement = job.placement || 'front';
      const fullKey = `${job.colorName}_${job.qrSize}_${placement}`;
      mockupsByColor[fullKey] = {
        front: result.mockupUrl,
        lifestyle: result.lifestyleMockupUrl,
        qrSize: job.qrSize,
        placement,
        generatedAt: new Date().toISOString(),
      };
      
      const colorSizeKey = `${job.colorName}_${job.qrSize}`;
      mockupsByColor[colorSizeKey] = {
        front: result.mockupUrl,
        lifestyle: result.lifestyleMockupUrl,
        qrSize: job.qrSize,
        placement,
        generatedAt: new Date().toISOString(),
      };
      
      mockupsByColor[job.colorName] = {
        front: result.mockupUrl,
        lifestyle: result.lifestyleMockupUrl,
        qrSize: job.qrSize,
        placement,
        generatedAt: new Date().toISOString(),
      };

      await fsUpdate('products', job.productId, { mockupsByColor });

      console.log(`[JobQueue] Updated product ${job.productId} mockups for ${colorSizeKey}`);
    } catch (err) {
      console.error("[JobQueue] Error updating product mockups:", err);
    }
  }

  startWorker(): void {
    if (this.processingInterval) return;

    console.log("[JobQueue] Starting worker...");
    
    this.processingInterval = setInterval(async () => {
      try {
        await this.processNextJob();
      } catch (err) {
        console.error("[JobQueue] Worker error:", err);
      }
    }, this.POLL_INTERVAL_MS);
  }

  stopWorker(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log("[JobQueue] Worker stopped");
    }
  }

  async clearCompletedJobs(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const completedJobs = await fsQuery('mockup_jobs', [['status', '==', 'completed']]);
    const oldJobs = completedJobs.filter(j => {
      const completedAt = j.completedAt instanceof Date ? j.completedAt : new Date(j.completedAt);
      return completedAt <= cutoff;
    });
    for (const job of oldJobs) {
      await fsDelete('mockup_jobs', job.id);
    }
    return oldJobs.length;
  }

  async cancelJobsByProduct(productId: string): Promise<number> {
    const jobs = await fsQuery('mockup_jobs', [
      ['productId', '==', productId],
      ['status', 'in', ['pending', 'delayed']],
    ]);
    for (const job of jobs) {
      await fsDelete('mockup_jobs', job.id);
    }
    return jobs.length;
  }
}

export const mockupJobQueue = new MockupJobQueue();
