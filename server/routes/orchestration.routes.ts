import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { db } from "../db";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";
import { productBundles, bundleItems, masterProducts, products } from "@shared/schema";

export async function registerOrchestrationRoutes(app: Express): Promise<void> {

  // ============ ORCHESTRATION: MASTER PRODUCTS API ============
  
  app.get("/api/admin/orchestration/master-products", isAdmin, async (req: any, res) => {
    try {
      const products = await storage.getAllMasterProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/master-products/:id", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.getMasterProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Master product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/orchestration/master-products", isAdmin, async (req: any, res) => {
    try {
      const { title, description, productType, tags, channels, pricingProfileId, baseCost, retailPrice } = req.body;
      
      if (!title || !productType) {
        return res.status(400).json({ error: "Title and productType are required" });
      }
      
      // Generate unified SKU: QRG-{type}-{seq}
      const seq = Date.now().toString(36).toUpperCase();
      const sku = `QRG-${productType.toUpperCase().slice(0, 3)}-${seq}`;
      
      const product = await storage.createMasterProduct({
        sku,
        title,
        description: description || null,
        productType,
        tags: tags || [],
        channels: channels || null,
        pricingProfileId: pricingProfileId || null,
        baseCost: baseCost || null,
        retailPrice: retailPrice || null,
        status: "draft",
      });
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/orchestration/master-products/:id", isAdmin, async (req: any, res) => {
    try {
      const id = req.params.id;
      const updates = req.body;
      
      const product = await storage.updateMasterProduct(id, updates);
      if (!product) {
        return res.status(404).json({ error: "Master product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/orchestration/master-products/:id", isAdmin, async (req: any, res) => {
    try {
      const id = req.params.id;
      await storage.deleteMasterProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: DESIGN VERSIONS API ============
  
  app.get("/api/admin/orchestration/master-products/:id/design-versions", isAdmin, async (req: any, res) => {
    try {
      const masterProductId = req.params.id;
      const versions = await storage.getDesignVersions(masterProductId);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/orchestration/master-products/:id/design-versions", isAdmin, async (req: any, res) => {
    try {
      const masterProductId = req.params.id;
      const { headerText, headerStyle, footerText, footerStyle, qrUrl, renderedPngUrl, renderedSvgUrl, qrCodeUrl, placementImages } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      // Get existing versions to calculate next version number (immutable - no modifications to existing)
      const existingVersions = await storage.getDesignVersions(masterProductId);
      const versionNumber = existingVersions.length + 1;
      
      // Create new version as immutable snapshot (existing versions remain unchanged)
      const version = await storage.createDesignVersion({
        masterProductId,
        versionNumber,
        headerText: headerText || null,
        headerStyle: headerStyle || null,
        footerText: footerText || null,
        footerStyle: footerStyle || null,
        qrUrl,
        renderedPngUrl: renderedPngUrl || null,
        renderedSvgUrl: renderedSvgUrl || null,
        qrCodeUrl: qrCodeUrl || null,
        placementImages: placementImages || null,
        isActive: true,
      });
      
      // Update master product to point to new current version
      await storage.updateMasterProduct(masterProductId, {
        currentDesignVersionId: version.id,
      });
      
      res.json(version);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: CHANNEL CONFIG API ============
  
  app.get("/api/admin/orchestration/channel-configs", isAdmin, async (req: any, res) => {
    try {
      const configs = await storage.getAllChannelConfigs();
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/channel-configs/:channelType", isAdmin, async (req: any, res) => {
    try {
      const config = await storage.getChannelConfig(req.params.channelType);
      if (!config) {
        return res.status(404).json({ error: "Channel config not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/orchestration/channel-configs", isAdmin, async (req: any, res) => {
    try {
      const { channelType, displayName, isEnabled, apiKeySecretName, shopId, settings } = req.body;
      
      if (!channelType || !displayName) {
        return res.status(400).json({ error: "channelType and displayName are required" });
      }
      
      const config = await storage.createChannelConfig({
        channelType,
        displayName,
        isEnabled: isEnabled ?? false,
        apiKeySecretName: apiKeySecretName || null,
        shopId: shopId || null,
        settings: settings || {},
      });
      
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/orchestration/channel-configs/:channelType", isAdmin, async (req: any, res) => {
    try {
      const { displayName, isEnabled, apiKeySecretName, apiSecretSecretName, shopId, rateLimit, rateLimitWindow, webhookSecret, settings } = req.body;
      
      // Only include fields that were actually provided (don't update lastHealthCheck on config changes)
      const updates: Record<string, unknown> = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (isEnabled !== undefined) updates.isEnabled = isEnabled;
      if (apiKeySecretName !== undefined) updates.apiKeySecretName = apiKeySecretName;
      if (apiSecretSecretName !== undefined) updates.apiSecretSecretName = apiSecretSecretName;
      if (shopId !== undefined) updates.shopId = shopId;
      if (rateLimit !== undefined) updates.rateLimit = rateLimit;
      if (rateLimitWindow !== undefined) updates.rateLimitWindow = rateLimitWindow;
      if (webhookSecret !== undefined) updates.webhookSecret = webhookSecret;
      if (settings !== undefined) updates.settings = settings;
      
      const config = await storage.updateChannelConfig(req.params.channelType, updates);
      
      if (!config) {
        return res.status(404).json({ error: "Channel config not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: PUBLISH STATE API ============
  
  app.get("/api/admin/orchestration/master-products/:id/publish-states", isAdmin, async (req: any, res) => {
    try {
      const masterProductId = req.params.id;
      const states = await storage.getPublishStates(masterProductId);
      res.json(states);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: PROVIDER HEALTH API ============
  
  // Get health dashboard (cached results with stats)
  app.get("/api/admin/orchestration/provider-health", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("../services/health-monitor");
      const dashboard = await healthMonitor.getHealthDashboard();
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger immediate health check for all providers
  app.post("/api/admin/orchestration/provider-health/check", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("../services/health-monitor");
      const results = await healthMonitor.checkAllProviders();
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check specific provider health
  app.post("/api/admin/orchestration/provider-health/:providerType/check", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("../services/health-monitor");
      const result = await healthMonitor.checkProvider(req.params.providerType);
      if (!result) {
        return res.status(404).json({ error: "Provider not found" });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get provider health history
  app.get("/api/admin/orchestration/provider-health/:providerType/history", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("../services/health-monitor");
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await healthMonitor.getProviderHistory(req.params.providerType, limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUTO-ROUTING ENDPOINTS ====================

  // Route an order to optimal provider
  app.post("/api/admin/orchestration/routing/route", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("../services/auto-router");
      const { blueprintId, prioritize = "balanced", requireUSA, maxCostCents, excludeProviders } = req.body;
      
      if (!blueprintId) {
        return res.status(400).json({ error: "blueprintId is required" });
      }
      
      const result = await autoRouter.routeOrder({
        blueprintId: parseInt(blueprintId),
        prioritize,
        requireUSA,
        maxCostCents,
        excludeProviders
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recommendations for a blueprint (cheapest, fastest, balanced)
  app.get("/api/admin/orchestration/routing/recommendations/:blueprintId", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("../services/auto-router");
      const blueprintId = parseInt(req.params.blueprintId);
      const recommendations = await autoRouter.getRecommendations(blueprintId);
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get routing statistics
  app.get("/api/admin/orchestration/routing/stats", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("../services/auto-router");
      const stats = autoRouter.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recent routing history
  app.get("/api/admin/orchestration/routing/history", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("../services/auto-router");
      const limit = parseInt(req.query.limit as string) || 20;
      const history = autoRouter.getRecentRoutings(limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Batch route multiple blueprints
  app.post("/api/admin/orchestration/routing/batch", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("../services/auto-router");
      const { blueprintIds, prioritize = "balanced", requireUSA, maxCostCents } = req.body;
      
      if (!blueprintIds || !Array.isArray(blueprintIds)) {
        return res.status(400).json({ error: "blueprintIds array is required" });
      }
      
      const results = await autoRouter.routeBatch(blueprintIds, {
        prioritize,
        requireUSA,
        maxCostCents
      });
      
      // Convert Map to object for JSON response
      const resultsObj: Record<number, any> = {};
      for (const [id, result] of Array.from(results.entries())) {
        resultsObj[id] = result;
      }
      
      res.json(resultsObj);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================
  // PROFIT CALCULATOR ENDPOINTS
  // =====================================

  // Get complete profit dashboard
  app.get("/api/admin/orchestration/profit/dashboard", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("../services/profit-calculator");
      const dashboard = await profitCalculator.getDashboard();
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get channel profit summaries
  app.get("/api/admin/orchestration/profit/channels", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("../services/profit-calculator");
      const summaries = await profitCalculator.getChannelProfitSummaries();
      res.json(summaries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get product profit analysis
  app.get("/api/admin/orchestration/profit/products", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("../services/profit-calculator");
      const products = await profitCalculator.getProductProfitAnalysis();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get profit alerts
  app.get("/api/admin/orchestration/profit/alerts", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("../services/profit-calculator");
      const alerts = await profitCalculator.generateAlerts();
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate profit for specific parameters
  app.post("/api/admin/orchestration/profit/calculate", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("../services/profit-calculator");
      const { revenue, productionCost, shippingCost = 0, channel = "direct" } = req.body;
      
      if (typeof revenue !== "number" || !isFinite(revenue) || revenue < 0) {
        return res.status(400).json({ error: "revenue must be a non-negative number" });
      }
      if (typeof productionCost !== "number" || !isFinite(productionCost) || productionCost < 0) {
        return res.status(400).json({ error: "productionCost must be a non-negative number" });
      }
      if (typeof shippingCost !== "number" || !isFinite(shippingCost) || shippingCost < 0) {
        return res.status(400).json({ error: "shippingCost must be a non-negative number" });
      }
      if (typeof channel !== "string" || !["direct", "etsy", "ebay", "amazon", "printify", "printful", "apliiq"].includes(channel.toLowerCase())) {
        return res.status(400).json({ error: "channel must be one of: direct, etsy, ebay, amazon, printify, printful, apliiq" });
      }
      
      const breakdown = profitCalculator.calculateOrderProfit(
        revenue,
        productionCost,
        shippingCost,
        channel
      );
      res.json(breakdown);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Compare channels for a product
  app.post("/api/admin/orchestration/profit/compare-channels", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("../services/profit-calculator");
      const { productionCost, basePrice } = req.body;
      
      if (typeof productionCost !== "number" || !isFinite(productionCost) || productionCost < 0) {
        return res.status(400).json({ error: "productionCost must be a non-negative number" });
      }
      if (typeof basePrice !== "number" || !isFinite(basePrice) || basePrice < 0) {
        return res.status(400).json({ error: "basePrice must be a non-negative number" });
      }
      
      const comparison = profitCalculator.compareChannelsForProduct(productionCost, basePrice);
      res.json(comparison);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recommended price for target margin
  app.post("/api/admin/orchestration/profit/recommended-price", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("../services/profit-calculator");
      const { productionCost, targetMarginPercent = 50, channel = "direct" } = req.body;
      
      if (typeof productionCost !== "number" || !isFinite(productionCost) || productionCost < 0) {
        return res.status(400).json({ error: "productionCost must be a non-negative number" });
      }
      if (typeof targetMarginPercent !== "number" || !isFinite(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent > 100) {
        return res.status(400).json({ error: "targetMarginPercent must be a number between 0 and 100" });
      }
      if (typeof channel !== "string") {
        return res.status(400).json({ error: "channel must be a string" });
      }
      
      const recommendedPrice = profitCalculator.calculateRecommendedPrice(
        productionCost,
        targetMarginPercent,
        channel
      );
      res.json({ 
        productionCost,
        targetMarginPercent,
        channel,
        recommendedPrice
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUTO-REPRICING ENDPOINTS ====================

  // Get all repricing rules
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
      const allBundles = await db.select().from(productBundles).orderBy(productBundles.displayOrder);
      res.json(allBundles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get bundle by ID with items
  app.get("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const bundle = await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1);
      if (!bundle.length) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id)).orderBy(bundleItems.displayOrder);
      res.json({ ...bundle[0], items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create bundle
  app.post("/api/admin/orchestration/bundles", isAdmin, async (req: any, res) => {
    try {
      const { items, ...bundleData } = req.body;
      const [bundle] = await db.insert(productBundles).values(bundleData).returning();
      
      if (items && items.length > 0) {
        const itemsWithBundleId = items.map((item: any) => ({
          ...item,
          bundleId: bundle.id,
        }));
        await db.insert(bundleItems).values(itemsWithBundleId);
      }
      
      const finalItems = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundle.id));
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
      
      const [bundle] = await db.update(productBundles)
        .set({ ...bundleData, updatedAt: new Date() })
        .where(eq(productBundles.id, id))
        .returning();
      
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      if (items !== undefined) {
        await db.delete(bundleItems).where(eq(bundleItems.bundleId, id));
        if (items.length > 0) {
          const itemsWithBundleId = items.map((item: any) => ({
            ...item,
            bundleId: id,
          }));
          await db.insert(bundleItems).values(itemsWithBundleId);
        }
      }
      
      const finalItems = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id));
      res.json({ ...bundle, items: finalItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete bundle
  app.delete("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await db.delete(productBundles).where(eq(productBundles.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle bundle active status
  app.post("/api/admin/orchestration/bundles/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [bundle] = await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      const [updated] = await db.update(productBundles)
        .set({ isActive: !bundle.isActive, updatedAt: new Date() })
        .where(eq(productBundles.id, id))
        .returning();
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
      
      const activeBundles = await db.select()
        .from(productBundles)
        .where(
          and(
            eq(productBundles.isActive, true),
            or(
              isNull(productBundles.startDate),
              lte(productBundles.startDate, now)
            ),
            or(
              isNull(productBundles.endDate),
              gte(productBundles.endDate, now)
            )
          )
        );
      
      const relevantBundles = activeBundles.filter(bundle => {
        if (!bundle.triggerProductIds || bundle.triggerProductIds.length === 0) {
          return true;
        }
        return bundle.triggerProductIds.includes(productId);
      });
      
      const bundlesWithItems = await Promise.all(
        relevantBundles.map(async bundle => {
          const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundle.id));
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
      
      const [bundle] = await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id));
      
      let totalRetailPrice = 0;
      const itemDetails: any[] = [];
      
      for (const item of items) {
        if (selectedItems && !selectedItems.includes(item.id)) continue;
        
        let itemPrice = 0;
        let itemName = "";
        
        if (item.masterProductId) {
          const [mp] = await db.select().from(masterProducts).where(eq(masterProducts.id, item.masterProductId)).limit(1);
          if (mp && mp.retailPrice) {
            itemPrice = parseFloat(mp.retailPrice);
            itemName = mp.title;
          }
        } else if (item.productId) {
          const [product] = await db.select().from(products).where(eq(products.id, String(item.productId))).limit(1);
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
