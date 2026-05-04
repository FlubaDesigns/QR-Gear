import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { fsGet, fsGetAll, fsQuery, fsQueryOne, fsInsert, fsUpdate, fsDelete, fsDeleteWhere, fsBatchInsert } from "../lib/firestore-crud";
import { registerOrchestrationPricingRoutes } from "./orchestration-pricing.routes";

export async function registerOrchestrationRoutes(app: Express): Promise<void> {
  await registerOrchestrationPricingRoutes(app);

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
      
      // Generate internal reference SKU for local orchestration records (not QRG identity)
      const seq = Date.now().toString(36).toUpperCase();
      const sku = `ORK-${productType.toUpperCase().slice(0, 4)}-${seq}`;
      
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
}
