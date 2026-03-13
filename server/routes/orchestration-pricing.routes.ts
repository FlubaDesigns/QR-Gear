import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { fsGet, fsGetAll, fsQuery, fsQueryOne, fsInsert, fsUpdate, fsDelete, fsDeleteWhere, fsBatchInsert } from "../lib/firestore-crud";

export async function registerOrchestrationPricingRoutes(app: Express): Promise<void> {
  app.get("/api/admin/orchestration/repricing/rules", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const rules = await autoRepricer.getRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get repricing statistics
  app.get("/api/admin/orchestration/repricing/stats", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const stats = await autoRepricer.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get repricing history
  app.get("/api/admin/orchestration/repricing/history", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const limit = parseInt(req.query.limit as string) || 50;
      if (limit < 1 || limit > 500) {
        return res.status(400).json({ error: "limit must be between 1 and 500" });
      }
      const history = await autoRepricer.getHistory(limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new repricing rule
  app.post("/api/admin/orchestration/repricing/rules", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const { name, description, isActive, priority, conditions, actionType, actionParams, appliesTo, appliesToIds } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required and must be a non-empty string" });
      }
      if (!actionType || typeof actionType !== "string") {
        return res.status(400).json({ error: "actionType is required" });
      }
      const validActionTypes = ["adjust_margin", "match_target", "increase_percent", "decrease_percent"];
      if (!validActionTypes.includes(actionType)) {
        return res.status(400).json({ error: `actionType must be one of: ${validActionTypes.join(", ")}` });
      }
      
      const rule = await autoRepricer.createRule({
        name: name.trim(),
        description,
        isActive,
        priority,
        conditions: conditions || {},
        actionType,
        actionParams: actionParams || {},
        appliesTo,
        appliesToIds,
      });
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a repricing rule
  app.patch("/api/admin/orchestration/repricing/rules/:ruleId", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const { ruleId } = req.params;
      
      if (!ruleId) {
        return res.status(400).json({ error: "ruleId is required" });
      }
      
      const updated = await autoRepricer.updateRule(ruleId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a repricing rule
  app.delete("/api/admin/orchestration/repricing/rules/:ruleId", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const { ruleId } = req.params;
      
      if (!ruleId) {
        return res.status(400).json({ error: "ruleId is required" });
      }
      
      await autoRepricer.deleteRule(ruleId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle rule active status
  app.post("/api/admin/orchestration/repricing/rules/:ruleId/toggle", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const { ruleId } = req.params;
      
      const updated = await autoRepricer.toggleRule(ruleId);
      if (!updated) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Preview rule impact (dry run)
  app.get("/api/admin/orchestration/repricing/rules/:ruleId/preview", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const { ruleId } = req.params;
      
      const preview = await autoRepricer.previewRule(ruleId);
      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Run repricing evaluation (dry run or apply)
  app.post("/api/admin/orchestration/repricing/run", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("../services/auto-repricer");
      const { dryRun = true } = req.body;
      
      const results = await autoRepricer.evaluateAllProducts(dryRun);
      res.json({
        dryRun,
        productsAffected: results.length,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // QR Scan Analytics Endpoints
  app.get("/api/admin/orchestration/qr-analytics/summary", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("../services/qr-analytics");
      const summary = await qrAnalyticsService.getSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/qr-analytics/products", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("../services/qr-analytics");
      const limit = parseInt(req.query.limit as string) || 20;
      const analytics = await qrAnalyticsService.getProductAnalytics(Math.min(Math.max(1, limit), 100));
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/qr-analytics/trends", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("../services/qr-analytics");
      const days = parseInt(req.query.days as string) || 30;
      const trends = await qrAnalyticsService.getTrends(Math.min(Math.max(1, days), 365));
      res.json(trends);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/qr-analytics/recent", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("../services/qr-analytics");
      const limit = parseInt(req.query.limit as string) || 50;
      const recent = await qrAnalyticsService.getRecentScans(Math.min(Math.max(1, limit), 200));
      res.json(recent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public scan logging endpoint (called when QR is scanned)
  app.post("/api/qr/scan", async (req, res) => {
    try {
      const { qrAnalyticsService } = await import("../services/qr-analytics");
      const { masterProductId, customDesignId, qrUrl, country, region } = req.body;
      
      if (!masterProductId && !customDesignId && !qrUrl) {
        return res.status(400).json({ error: "At least one identifier required" });
      }

      const userAgent = req.headers["user-agent"] || "";
      const deviceType = qrAnalyticsService.detectDeviceType(userAgent);

      await qrAnalyticsService.logScan({
        masterProductId,
        customDesignId,
        qrUrl,
        country,
        region,
        deviceType,
        userAgent,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======== Cross-Sell Bundles ========
  
  // Get all bundles
  app.get("/api/admin/orchestration/bundles", isAdmin, async (req: any, res) => {
    try {
      const allBundles = await fsGetAll('product_bundles', 'displayOrder');
      res.json(allBundles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get bundle by ID with items
  app.get("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const bundle = await fsGet('product_bundles', id);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      const items = await fsQuery('bundle_items', [['bundleId', '==', id]], 'displayOrder');
      res.json({ ...bundle, items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create bundle
  app.post("/api/admin/orchestration/bundles", isAdmin, async (req: any, res) => {
    try {
      const { items, ...bundleData } = req.body;
      const bundle = await fsInsert('product_bundles', bundleData);
      
      if (items && items.length > 0) {
        const itemsWithBundleId = items.map((item: any) => ({
          ...item,
          bundleId: bundle.id,
        }));
        await fsBatchInsert('bundle_items', itemsWithBundleId);
      }
      
      const finalItems = await fsQuery('bundle_items', [['bundleId', '==', bundle.id]]);
      res.json({ ...bundle, items: finalItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update bundle
  app.patch("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { items, ...bundleData } = req.body;
      
      const bundle = await fsUpdate('product_bundles', id, bundleData);
      
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      if (items !== undefined) {
        await fsDeleteWhere('bundle_items', [['bundleId', '==', id]]);
        if (items.length > 0) {
          const itemsWithBundleId = items.map((item: any) => ({
            ...item,
            bundleId: id,
          }));
          await fsBatchInsert('bundle_items', itemsWithBundleId);
        }
      }
      
      const finalItems = await fsQuery('bundle_items', [['bundleId', '==', id]]);
      res.json({ ...bundle, items: finalItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete bundle
  app.delete("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await fsDeleteWhere('bundle_items', [['bundleId', '==', id]]);
      await fsDelete('product_bundles', id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle bundle active status
  app.post("/api/admin/orchestration/bundles/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const bundle = await fsGet('product_bundles', id);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      const updated = await fsUpdate('product_bundles', id, { isActive: !bundle.isActive });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get bundles for a product (for cross-sell display)
  app.get("/api/bundles/for-product/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const now = new Date();
      
      const activeBundles = await fsQuery('product_bundles', [['isActive', '==', true]]);
      
      const dateFilttered = activeBundles.filter(bundle => {
        if (bundle.startDate && new Date(bundle.startDate) > now) return false;
        if (bundle.endDate && new Date(bundle.endDate) < now) return false;
        return true;
      });
      
      const relevantBundles = dateFilttered.filter(bundle => {
        if (!bundle.triggerProductIds || bundle.triggerProductIds.length === 0) {
          return true;
        }
        return bundle.triggerProductIds.includes(productId);
      });
      
      const bundlesWithItems = await Promise.all(
        relevantBundles.map(async bundle => {
          const items = await fsQuery('bundle_items', [['bundleId', '==', bundle.id]]);
          return { ...bundle, items };
        })
      );
      
      res.json(bundlesWithItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate bundle price
  app.post("/api/bundles/:id/calculate", async (req, res) => {
    try {
      const { id } = req.params;
      const { selectedItems } = req.body;
      
      const bundle = await fsGet('product_bundles', id);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      const items = await fsQuery('bundle_items', [['bundleId', '==', id]]);
      
      let totalRetailPrice = 0;
      const itemDetails: any[] = [];
      
      for (const item of items) {
        if (selectedItems && !selectedItems.includes(item.id)) continue;
        
        let itemPrice = 0;
        let itemName = "";
        
        if (item.masterProductId) {
          const mp = await fsGet('master_products', item.masterProductId);
          if (mp && mp.retailPrice) {
            itemPrice = parseFloat(mp.retailPrice);
            itemName = mp.title;
          }
        } else if (item.productId) {
          const product = await fsGet('products', String(item.productId));
          if (product) {
            itemPrice = parseFloat(product.basePrice);
            itemName = product.name;
          }
        }
        
        const qty = item.quantity || 1;
        const itemDiscount = item.itemDiscountPercent ? parseFloat(item.itemDiscountPercent) / 100 : 0;
        const discountedPrice = itemPrice * (1 - itemDiscount) * qty;
        
        totalRetailPrice += discountedPrice;
        itemDetails.push({
          itemId: item.id,
          name: itemName,
          unitPrice: itemPrice,
          quantity: qty,
          discount: itemDiscount * 100,
          subtotal: discountedPrice,
        });
      }
      
      let bundlePrice = totalRetailPrice;
      let savings = 0;
      
      if (bundle.pricingType === "fixed_price" && bundle.fixedPrice) {
        bundlePrice = parseFloat(bundle.fixedPrice);
        savings = totalRetailPrice - bundlePrice;
      } else if (bundle.pricingType === "discount_percent" && bundle.discountPercent) {
        const discount = parseFloat(bundle.discountPercent) / 100;
        bundlePrice = totalRetailPrice * (1 - discount);
        savings = totalRetailPrice - bundlePrice;
      } else if (bundle.pricingType === "discount_amount" && bundle.discountAmount) {
        bundlePrice = totalRetailPrice - parseFloat(bundle.discountAmount);
        savings = parseFloat(bundle.discountAmount);
      }
      
      res.json({
        bundleId: bundle.id,
        bundleName: bundle.name,
        originalPrice: totalRetailPrice,
        bundlePrice: Math.max(0, bundlePrice),
        savings: Math.max(0, savings),
        savingsPercent: totalRetailPrice > 0 ? (savings / totalRetailPrice) * 100 : 0,
        items: itemDetails,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk publishing endpoints
  const { bulkPublisher } = await import("../services/bulk-publisher");
  
  app.post("/api/admin/orchestration/bulk-publish", isAdmin, async (req: any, res) => {
    try {
      const { productIds, channelTypes } = req.body;
      if (!productIds?.length || !channelTypes?.length) {
        return res.status(400).json({ error: "productIds and channelTypes arrays required" });
      }
      const jobId = await bulkPublisher.createJob({ productIds, channelTypes });
      res.json({ jobId, message: "Bulk publish job started" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/orchestration/bulk-publish/:jobId", isAdmin, async (req: any, res) => {
    try {
      const job = bulkPublisher.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/orchestration/bulk-publish-jobs", isAdmin, async (req: any, res) => {
    try {
      const jobs = bulkPublisher.getAllJobs();
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
