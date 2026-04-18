import type { Express } from "express";
import { storage } from "../../storage";
import { isAdmin } from "../../firebaseAuth";
import { z } from "zod";

export function registerQrTemplatesRoutes(app: Express): void {

  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getActiveQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const templates = await storage.getQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url(),
        fullImageUrl: z.string().url(),
        storageUrl: z.string().url(),
        priceUpcharge: z.string().optional().default("0"),
        isActive: z.boolean().optional().default(true),
        isFeatured: z.boolean().optional().default(false),
      });
      
      const validatedData = createSchema.parse(req.body);
      const template = await storage.createQrTemplate(validatedData);
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url().optional(),
        fullImageUrl: z.string().url().optional(),
        storageUrl: z.string().url().optional(),
        priceUpcharge: z.string().optional(),
        isActive: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const template = await storage.updateQrTemplate(id, validatedData);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQrTemplate(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/templates/full-save", isAdmin, async (req, res) => {
    try {
      const templatePricingSchema = z.object({
        baseProductCost: z.number(),
        placementCost: z.number(),
        textUpcharge: z.number(),
        hostingCost: z.number(),
        subtotal: z.number(),
        markupAmount: z.number(),
        customerPrice: z.number(),
        hostingTierCode: z.string(),
      }).nullable().optional();

      const fullSaveSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        productId: z.string(),
        blueprintId: z.number(),
        printProviderId: z.number(),
        fulfillmentProvider: z.string().optional().default('printful'),
        colors: z.array(z.object({
          name: z.string(),
          hex: z.string(),
        })),
        placements: z.array(z.string()).default(["front"]),
        placementMethods: z.record(z.string(), z.string()).optional(),
        qrSizes: z.array(z.enum(["small", "medium", "large"])).default(["small", "medium", "large"]),
        artworkUrl: z.string().optional().default(""),
        artworkVariant: z.enum(["black", "white"]).default("black"),
        thumbnailUrl: z.string().optional(),
        storeId: z.string().optional(),
        channelId: z.string().optional(),
        qrContent: z.string().optional(),
        pricing: templatePricingSchema,
      });

      const data = fullSaveSchema.parse(req.body);

      const customerPrice = data.pricing?.customerPrice?.toFixed(2) || "0";
      const template = await storage.createQrTemplate({
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        thumbnailUrl: data.thumbnailUrl || data.artworkUrl,
        fullImageUrl: data.artworkUrl,
        storageUrl: data.artworkUrl,
        priceUpcharge: customerPrice,
        textStyle: data.pricing ? {
          pricing: data.pricing,
          hostingTierCode: data.pricing.hostingTierCode,
        } : null,
        isActive: true,
        isFeatured: false,
      });

      const { mockupJobQueue } = await import('../../lib/mockup-job-queue.js');
      
      const frontBackPlacements = data.placements.filter(p => p === "front" || p === "back");
      const otherPlacements = data.placements.filter(p => p !== "front" && p !== "back");

      const allJobs: any[] = [];

      if (frontBackPlacements.length > 0) {
        const jobs = await mockupJobQueue.createBatchJobs({
          productId: data.productId,
          colors: data.colors,
          qrSizes: data.qrSizes,
          placements: frontBackPlacements,
          blueprintId: data.blueprintId,
          printProviderId: data.printProviderId,
          artworkUrl: data.artworkUrl,
          artworkVariant: data.artworkVariant,
          fulfillmentProvider: data.fulfillmentProvider,
          placementMethods: data.placementMethods,
        });
        allJobs.push(...jobs);
      }

      if (otherPlacements.length > 0) {
        const jobs = await mockupJobQueue.createBatchJobs({
          productId: data.productId,
          colors: data.colors,
          qrSizes: ["large"],
          placements: otherPlacements,
          blueprintId: data.blueprintId,
          printProviderId: data.printProviderId,
          artworkUrl: data.artworkUrl,
          artworkVariant: data.artworkVariant,
          fulfillmentProvider: data.fulfillmentProvider,
          placementMethods: data.placementMethods,
        });
        allJobs.push(...jobs);
      }

      console.log(`[Templates] Created template ${template.id} with ${allJobs.length} mockup jobs queued`);

      res.json({
        success: true,
        template,
        jobsQueued: allJobs.length,
        message: `Template created with ${allJobs.length} mockups queued for generation`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("[Templates] Full save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/queue/status", isAdmin, async (_req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const pendingSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "pending").get();
      const processingSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "processing").get();
      const completedSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "completed").limit(100).get();
      const failedSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "failed").limit(100).get();

      res.json({
        success: true,
        queue: {
          pending: pendingSnapshot.size,
          processing: processingSnapshot.size,
          completed: completedSnapshot.size,
          failed: failedSnapshot.size,
        },
        message: `Queue status: ${pendingSnapshot.size} pending, ${processingSnapshot.size} processing`,
      });
    } catch (error: any) {
      console.error("[Queue] Error getting status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/templates/:templateId/mockups", isAdmin, async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const jobsSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("templateId", "==", templateId)
        .get();

      const mockups = jobsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          status: data.status,
          color: data.color,
          size: data.size,
          placement: data.placement,
          mockupUrl: data.mockupUrl || null,
          error: data.error || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
        };
      });

      const completed = mockups.filter(m => m.status === "completed");
      const pending = mockups.filter(m => m.status === "pending");
      const processing = mockups.filter(m => m.status === "processing");
      const failed = mockups.filter(m => m.status === "failed");

      res.json({
        success: true,
        templateId,
        summary: {
          total: mockups.length,
          completed: completed.length,
          pending: pending.length,
          processing: processing.length,
          failed: failed.length,
        },
        mockups,
      });
    } catch (error: any) {
      console.error("[Mockups] Error getting mockups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/queue/retry-failed", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb, getFirebaseAdmin } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();

      const failedSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("status", "==", "failed")
        .get();

      if (failedSnapshot.empty) {
        return res.json({ success: true, reset: 0, message: "No failed jobs to retry" });
      }

      let resetCount = 0;
      const batch = firestoreDb.batch();
      for (const doc of failedSnapshot.docs) {
        batch.update(doc.ref, {
          status: "pending",
          error: null,
          retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        resetCount++;
      }
      await batch.commit();

      console.log(`[Queue] Reset ${resetCount} failed jobs to pending`);
      res.json({ success: true, reset: resetCount, message: `Reset ${resetCount} failed jobs to pending` });
    } catch (error: any) {
      console.error("[Queue] Error retrying failed jobs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/queue/process", isAdmin, async (req: any, res) => {
    try {
      const { limit = 5 } = req.body;
      const processLimit = Math.min(limit, 20);

      const { getFirestoreDb, getFirebaseAdmin } = await import("../../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const processingSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("status", "==", "processing")
        .limit(50)
        .get();
      
      let recoveredCount = 0;
      for (const doc of processingSnapshot.docs) {
        const data = doc.data();
        const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
        if (startedAt < fiveMinutesAgo) {
          await firestoreDb.collection("mockup_jobs").doc(doc.id).update({
            status: "pending",
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[Queue] Recovered stale job ${doc.id}`);
          recoveredCount++;
        }
      }

      const pendingSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("status", "==", "pending")
        .limit(processLimit)
        .get();

      if (pendingSnapshot.empty) {
        return res.json({
          success: true,
          processed: 0,
          recovered: recoveredCount,
          message: "No pending jobs in queue",
        });
      }

      console.log(`[Queue] Processing ${pendingSnapshot.size} mockup jobs`);

      const results: Array<{ jobId: string; status: string; error?: string }> = [];

      for (const jobDoc of pendingSnapshot.docs) {
        const job = jobDoc.data();
        const jobId = jobDoc.id;

        try {
          const claimed = await firestoreDb.runTransaction(async (transaction) => {
            const jobRef = firestoreDb.collection("mockup_jobs").doc(jobId);
            const freshDoc = await transaction.get(jobRef);
            
            if (!freshDoc.exists || freshDoc.data()?.status !== "pending") {
              return false;
            }
            
            transaction.update(jobRef, {
              status: "processing",
              startedAt: admin.firestore.FieldValue.serverTimestamp(),
              processorId: `dev-${Date.now()}`,
            });
            return true;
          });

          if (!claimed) {
            console.log(`[Queue] Job ${jobId} already claimed, skipping`);
            continue;
          }

          await new Promise(resolve => setTimeout(resolve, 2000));

          const templateDoc = await firestoreDb.collection("productTemplates").doc(job.templateId).get();
          if (!templateDoc.exists) {
            throw new Error(`Template ${job.templateId} not found`);
          }
          const template = templateDoc.data()!;

          const { generatePrintfulMockup } = await import("../../lib/mockup-service");
          const mockupResult = await generatePrintfulMockup({
            productId: template.productId || job.templateId,
            blueprintId: template.blueprintId || 5,
            printProviderId: template.printProviderId || 39,
            colorName: job.colorName,
            artworkUrl: template.artworkUrl,
            artworkVariant: template.artworkVariant || "black",
            qrSize: job.qrSize || "large",
            fulfillmentProvider: template.fulfillmentProvider || job.fulfillmentProvider || "printify",
            placement: job.placement || "front",
            printMethod: job.printMethod,
          });

          if (mockupResult.error) {
            throw new Error(mockupResult.error);
          }

          const colorKey = job.colorName.replace(/\s+/g, "_").toLowerCase();
          const placementKey = job.placement || "front";
          const sizeKey = job.qrSize || "large";
          
          const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
          await firestoreDb.collection("productTemplates").doc(job.templateId).update({
            [mockupPath]: mockupResult.mockupUrl || null,
            [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleUrl || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await firestoreDb.collection("mockup_jobs").doc(jobId).update({
            status: "completed",
            mockupUrl: mockupResult.mockupUrl || null,
            lifestyleUrl: mockupResult.lifestyleUrl || null,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ jobId, status: "completed" });
          console.log(`[Queue] Job ${jobId} completed: ${job.colorName} / ${job.placement} / ${job.qrSize}`);

        } catch (error: any) {
          console.error(`[Queue] Job ${jobId} failed:`, error.message);
          
          await firestoreDb.collection("mockup_jobs").doc(jobId).update({
            status: "failed",
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ jobId, status: "failed", error: error.message });
        }
      }

      const completed = results.filter(r => r.status === "completed").length;
      const failed = results.filter(r => r.status === "failed").length;

      res.json({
        success: true,
        processed: results.length,
        completed,
        failed,
        results,
        message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed`,
      });

    } catch (error: any) {
      console.error("[Queue] Error processing jobs:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
