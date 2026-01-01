import { db } from "../db";
import { mockupJobs, products, type MockupJob, type InsertMockupJob } from "@shared/schema";
import { eq, and, lte, or, asc, desc } from "drizzle-orm";
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

    const [job] = await db.insert(mockupJobs).values({
      productId: params.productId,
      colorName: params.colorName,
      qrSize: params.qrSize,
      jobData,
      status: "pending",
      priority: params.priority ?? 10,
      attempts: 0,
      maxAttempts: 5,
    }).returning();

    return job;
  }

  async createBatchJobs(params: {
    productId: string;
    colors: Array<{ name: string; hex: string }>;
    qrSizes?: Array<"small" | "medium" | "large">;
    blueprintId: number;
    printProviderId: number;
    artworkUrl: string;
    artworkVariant: "black" | "white";
  }): Promise<MockupJob[]> {
    const jobs: MockupJob[] = [];
    const qrSizes = params.qrSizes || ["small", "medium", "large"];
    
    let priority = 0;
    for (const color of params.colors) {
      for (const qrSize of qrSizes) {
        const job = await this.createJob({
          productId: params.productId,
          colorName: color.name,
          qrSize,
          blueprintId: params.blueprintId,
          printProviderId: params.printProviderId,
          artworkUrl: params.artworkUrl,
          artworkVariant: params.artworkVariant,
          priority: priority++,
        });
        jobs.push(job);
      }
    }

    return jobs;
  }

  async getJob(jobId: string): Promise<MockupJob | null> {
    const [job] = await db.select().from(mockupJobs).where(eq(mockupJobs.id, jobId));
    return job || null;
  }

  async getJobsByProduct(productId: string): Promise<MockupJob[]> {
    return db.select().from(mockupJobs)
      .where(eq(mockupJobs.productId, productId))
      .orderBy(asc(mockupJobs.priority), asc(mockupJobs.createdAt));
  }

  async getStats(): Promise<QueueStats> {
    const allJobs = await db.select().from(mockupJobs);
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
    viewerId: string;
  }): Promise<MockupJob | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minute TTL
    
    // Find the job for this color + qrSize combo
    const [existingJob] = await db.select().from(mockupJobs)
      .where(
        and(
          eq(mockupJobs.productId, params.productId),
          eq(mockupJobs.colorName, params.colorName),
          eq(mockupJobs.qrSize, params.qrSize)
        )
      )
      .limit(1);
    
    if (!existingJob) {
      return null;
    }
    
    // Only bump if job is still pending or delayed
    if (existingJob.status !== "pending" && existingJob.status !== "delayed") {
      return existingJob; // Already processing/completed/failed
    }
    
    // Set priority to -1 (highest) and update tracking fields
    const [updatedJob] = await db.update(mockupJobs)
      .set({
        priority: -1,
        priorityUpdatedAt: now,
        priorityOwner: params.viewerId,
        priorityExpiresAt: expiresAt,
      })
      .where(eq(mockupJobs.id, existingJob.id))
      .returning();
    
    console.log(`[MockupQueue] Bumped priority for ${params.colorName}/${params.qrSize} (job ${existingJob.id})`);
    return updatedJob;
  }

  async getNextJob(): Promise<MockupJob | null> {
    const now = new Date();
    
    // Order by priority first, then by priorityUpdatedAt (most recently boosted), then createdAt
    const [job] = await db.select().from(mockupJobs)
      .where(
        or(
          eq(mockupJobs.status, "pending"),
          and(
            eq(mockupJobs.status, "delayed"),
            lte(mockupJobs.nextRetryAt, now)
          )
        )
      )
      .orderBy(asc(mockupJobs.priority), desc(mockupJobs.priorityUpdatedAt), asc(mockupJobs.createdAt))
      .limit(1);

    return job || null;
  }

  async markProcessing(jobId: string): Promise<void> {
    const [job] = await db.select().from(mockupJobs).where(eq(mockupJobs.id, jobId));
    if (!job) return;
    
    await db.update(mockupJobs)
      .set({ 
        status: "processing", 
        startedAt: new Date(),
        attempts: (job.attempts || 0) + 1,
      })
      .where(eq(mockupJobs.id, jobId));
  }

  async markCompleted(jobId: string, result: JobResult): Promise<void> {
    await db.update(mockupJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        resultData: result,
        errorMessage: null,
      })
      .where(eq(mockupJobs.id, jobId));
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    const [job] = await db.select().from(mockupJobs).where(eq(mockupJobs.id, jobId));
    if (!job) return;

    const attempts = (job.attempts || 0);
    const maxAttempts = job.maxAttempts || 5;

    if (attempts >= maxAttempts) {
      await db.update(mockupJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: error,
        })
        .where(eq(mockupJobs.id, jobId));
    } else {
      const backoffMs = calculateBackoff(attempts);
      const nextRetry = new Date(Date.now() + backoffMs);
      
      await db.update(mockupJobs)
        .set({
          status: "delayed",
          nextRetryAt: nextRetry,
          errorMessage: error,
        })
        .where(eq(mockupJobs.id, jobId));
      
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
      const [product] = await db.select().from(products).where(eq(products.id, job.productId));
      if (!product) return;

      const mockupsByColor = (product.mockupsByColor || {}) as Record<string, any>;
      mockupsByColor[job.colorName] = {
        front: result.mockupUrl,
        lifestyle: result.lifestyleMockupUrl,
        qrSize: job.qrSize,
        generatedAt: new Date().toISOString(),
      };

      await db.update(products)
        .set({ mockupsByColor })
        .where(eq(products.id, job.productId));

      console.log(`[JobQueue] Updated product ${job.productId} mockups for ${job.colorName}`);
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
    const result = await db.delete(mockupJobs)
      .where(
        and(
          eq(mockupJobs.status, "completed"),
          lte(mockupJobs.completedAt, cutoff)
        )
      )
      .returning();
    return result.length;
  }

  async cancelJobsByProduct(productId: string): Promise<number> {
    const result = await db.delete(mockupJobs)
      .where(
        and(
          eq(mockupJobs.productId, productId),
          or(
            eq(mockupJobs.status, "pending"),
            eq(mockupJobs.status, "delayed")
          )
        )
      )
      .returning();
    return result.length;
  }
}

export const mockupJobQueue = new MockupJobQueue();
