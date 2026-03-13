import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { insertPricingRuleSchema, insertAdminSettingsSchema } from "@shared/schema";
import { registerAdminProductsCrudRoutes } from "./admin-products-crud.routes";
import { registerAdminCatalogSyncRoutes } from "./admin-catalog-sync.routes";
import { registerAdminCommerceRoutes } from "./admin-commerce.routes";
import { registerAdminContentRoutes } from "./admin-content.routes";

export function registerAdminRoutes(app: Express): void {
  // ============ ADMIN ROUTES ============

  // Admin: Get fulfillment provider status (which providers are configured)
  app.get("/api/admin/fulfillment-providers", isAdmin, async (req: any, res) => {
    try {
      const printifyKey = process.env.PRINTIFY_API_KEY;
      const printfulKey = process.env.PRINTFUL_API_KEY;
      const apliiqKey = process.env.APLIIQ_API_KEY;
      
      const providers = [
        { 
          id: "printify", 
          name: "Printify", 
          configured: !!printifyKey && printifyKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printify network"
        },
        { 
          id: "printful", 
          name: "Printful", 
          configured: !!printfulKey && printfulKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printful"
        },
        { 
          id: "apliiq", 
          name: "Apliiq", 
          configured: !!apliiqKey && apliiqKey.length > 10,
          role: "fulfillment",
          description: "Custom apparel via Apliiq"
        },
      ];
      
      console.log(`[FulfillmentProviders] Admin returning ${providers.filter(p => p.configured).length} configured providers`);
      res.json(providers);
    } catch (error: any) {
      console.error('[FulfillmentProviders] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Settings
  app.get("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      let settings = await storage.getAdminSettings();
      if (!settings) {
        settings = await storage.upsertAdminSettings({});
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      const validated = insertAdminSettingsSchema.partial().parse(req.body);
      const settings = await storage.upsertAdminSettings(validated);
      res.json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Pricing Rules
  app.get("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
    try {
      const validated = insertPricingRuleSchema.parse(req.body);
      const rule = await storage.createPricingRule(validated);
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertPricingRuleSchema.partial().parse(req.body);
      const rule = await storage.updatePricingRule(id, validated);
      if (!rule) {
        return res.status(404).json({ error: "Pricing rule not found" });
      }
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePricingRule(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  registerAdminProductsCrudRoutes(app);
  registerAdminCatalogSyncRoutes(app);
  registerAdminCommerceRoutes(app);
  registerAdminContentRoutes(app);
}
