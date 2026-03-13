import type { Express } from "express";
import { storage } from "../../storage";
import { isAdmin } from "../../firebaseAuth";
import { insertPartnerStoreSchema, insertEmailTemplateSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

export function registerPartnerStoresEmailRoutes(app: Express): void {

  app.get("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      const stores = await storage.getPartnerStores();
      res.json(stores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.getPartnerStore(req.params.id);
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      const dataWithApiKey = {
        ...req.body,
        apiKey: req.body.apiKey || `qrg_${crypto.randomUUID().replace(/-/g, '')}`,
      };
      
      const validated = insertPartnerStoreSchema.parse(dataWithApiKey);
      
      const existingStores = await storage.getPartnerStores();
      const normalizedName = validated.name?.toLowerCase().trim();
      const isDuplicate = existingStores.some(
        (s) => s.name?.toLowerCase().trim() === normalizedName && s.isInternal === validated.isInternal
      );
      if (isDuplicate) {
        return res.status(409).json({ 
          error: `A ${validated.isInternal ? 'internal' : 'partner'} store with the name "${validated.name}" already exists` 
        });
      }
      
      const store = await storage.createPartnerStore(validated);
      res.json(store);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("[Partner Store Validation Error]", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Partner Store Create Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.updatePartnerStore(req.params.id, req.body);
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deletePartnerStore(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores/:id/regenerate-key", isAdmin, async (req: any, res) => {
    try {
      const newApiKey = `qrg_${crypto.randomUUID().replace(/-/g, '')}`;
      const store = await storage.updatePartnerStore(req.params.id, { apiKey: newApiKey });
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json({ apiKey: newApiKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const storeProducts = await storage.getPartnerStoreProducts(req.params.id);
      res.json(storeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-templates", isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/email-templates", isAdmin, async (req: any, res) => {
    try {
      const parsed = insertEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const template = await storage.createEmailTemplate(parsed.data);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      const parsed = insertEmailTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const template = await storage.updateEmailTemplate(req.params.id, parsed.data);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteEmailTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-logs", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getEmailLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
