import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";

export function registerMockupJobsRoutes(app: Express): void {
  app.post("/api/mockup-jobs/batch", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const { productId, fullGeneration = false, placements, qrSizes } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }
      
      // Validate qrSizes if provided
      const validQrSizes = ["small", "medium", "large"];
      if (qrSizes && !qrSizes.every((s: string) => validQrSizes.includes(s))) {
        return res.status(400).json({ error: "qrSizes must be array of 'small', 'medium', or 'large'" });
      }
      
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
      
      const product = await storage.getProduct(canonicalProductId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const { blueprintId, printProviderId, availableColors } = product;
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      const colors = Array.isArray(availableColors) ? availableColors : [];
      if (colors.length === 0) {
        return res.status(400).json({ error: "Product has no colors defined" });
      }
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Get artwork
      let designPlacements: Record<string, string> = {};
      if (typeof design.placementImages === 'string') {
        designPlacements = JSON.parse(design.placementImages);
      } else if (design.placementImages && typeof design.placementImages === 'object') {
        designPlacements = design.placementImages as Record<string, string>;
      }
      
      const blackArtwork = designPlacements["front"] || designPlacements["front-chest"] || designPlacements["front-center"];
      const whiteArtwork = designPlacements["front-white"] || designPlacements["front-chest-white"] || designPlacements["front-center-white"];
      
      if (!blackArtwork) {
        return res.status(400).json({ error: "No artwork found for product" });
      }
      
      // Determine which placements and QR sizes to generate
      const ALL_PLACEMENTS = ["front", "back", "left_sleeve", "right_sleeve"];
      const ALL_QR_SIZES: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
      
      let targetPlacements: string[];
      let targetQrSizes: Array<"small" | "medium" | "large">;
      
      if (fullGeneration) {
        // Admin catalog: generate ALL combinations
        targetPlacements = placements || ALL_PLACEMENTS;
        targetQrSizes = qrSizes || ALL_QR_SIZES;
      } else {
        // Custom order: generate specified or default
        targetPlacements = placements || ["front"];
        targetQrSizes = qrSizes || ALL_QR_SIZES;
      }
      
      // Create jobs for all combinations
      const jobs = await mockupJobQueue.createBatchJobs({
        productId: canonicalProductId,
        colors: colors as Array<{ name: string; hex: string }>,
        qrSizes: targetQrSizes,
        placements: targetPlacements,
        blueprintId,
        printProviderId,
        artworkUrl: blackArtwork,
        artworkVariant: "black",
      });
      
      const totalCombos = `${colors.length} colors × ${targetQrSizes.length} QR sizes × ${targetPlacements.length} placements`;
      
      res.json({
        success: true,
        message: `Created ${jobs.length} mockup jobs (${totalCombos})`,
        jobCount: jobs.length,
        placements: targetPlacements,
        qrSizes: targetQrSizes,
        colorCount: colors.length,
        jobIds: jobs.map(j => j.id),
      });
    } catch (error: any) {
      console.error("[MockupJobQueue] Batch create error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get queue stats - public
  app.get("/api/mockup-jobs/stats", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const stats = await mockupJobQueue.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get jobs for a product - public
  app.get("/api/mockup-jobs/product/:productId", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const { productId } = req.params;
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const jobs = await mockupJobQueue.getJobsByProduct(canonicalProductId);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single job status - public
  app.get("/api/mockup-jobs/:jobId", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const job = await mockupJobQueue.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Priority bump for a specific color + QR size + placement combo (public - for customer UX)
  app.post("/api/mockup-jobs/prioritize", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const { productId, colorName, qrSize, placement, viewerId } = req.body;
      
      if (!productId || !colorName || !qrSize || !placement || !viewerId) {
        return res.status(400).json({ error: "Missing required fields: productId, colorName, qrSize, placement, viewerId" });
      }
      
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const job = await mockupJobQueue.bumpPriority({
        productId: canonicalProductId,
        colorName,
        qrSize,
        placement,
        viewerId,
      });
      
      if (!job) {
        return res.status(404).json({ error: "Job not found for this color/size combination" });
      }
      
      res.json({ 
        success: true, 
        jobId: job.id, 
        status: job.status,
        priority: job.priority,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel pending jobs for a product - admin only (prevent abuse)
  app.delete("/api/mockup-jobs/product/:productId", isAdmin, async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const { productId } = req.params;
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const cancelled = await mockupJobQueue.cancelJobsByProduct(canonicalProductId);
      res.json({ success: true, cancelledCount: cancelled });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start/stop worker (admin control)
  app.post("/api/admin/mockup-jobs/worker/:action", isAdmin, async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const { action } = req.params;
      
      if (action === "start") {
        mockupJobQueue.startWorker();
        res.json({ success: true, message: "Worker started" });
      } else if (action === "stop") {
        mockupJobQueue.stopWorker();
        res.json({ success: true, message: "Worker stopped" });
      } else {
        res.status(400).json({ error: "Action must be 'start' or 'stop'" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRINTIFY MOCKUP GENERATION ============
  
  // Admin: Publish design to Printify and generate mockups for all selected colors
}
