import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { fsGetAll, fsGet, fsInsert, fsUpdate, fsDelete, fsQuery } from "../lib/firestore-crud";

export function registerAdminCatalogsShelfRoutes(app: Express): void {
  app.get("/api/admin/nexusmail/status", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const outboxSnapshot = await fsDb.collection('email_outbox').get();
      const records = outboxSnapshot.docs.map((doc: any) => doc.data());
      const queued = records.filter((r: any) => r.status === 'queued').length;
      const sending = records.filter((r: any) => r.status === 'sending').length;
      const sent = records.filter((r: any) => r.status === 'sent').length;
      const failed = records.filter((r: any) => r.status === 'failed').length;
      const dead = records.filter((r: any) => r.status === 'dead').length;
      const consecutiveFailures = records.filter((r: any) => r.status === 'failed').length;
      res.json({
        ready: true,
        provider: process.env.RESEND_API_KEY ? 'resend' : 'none',
        health: {
          score: failed > 5 ? 50 : 100,
          status: failed > 5 ? 'degraded' : 'healthy',
          consecutiveFailures,
          isPaused: false,
        },
        outboxStats: { queued, sending, sent, failed, dead },
      });
    } catch (error: any) {
      console.error("[NexusMail] Status error:", error);
      res.json({
        ready: false,
        provider: 'none',
        health: { score: 0, status: 'unhealthy', consecutiveFailures: 0, isPaused: false },
        outboxStats: { queued: 0, sending: 0, sent: 0, failed: 0, dead: 0 },
      });
    }
  });

  app.get("/api/admin/nexusmail/outbox", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('email_outbox').orderBy('createdAt', 'desc').limit(50).get();
      const records = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json({ records });
    } catch (error: any) {
      console.error("[NexusMail] Outbox error:", error);
      res.json({ records: [] });
    }
  });

  app.post("/api/admin/nexusmail/process-outbox", isAdmin, async (req: any, res) => {
    try {
      const limit = req.body?.limit || 10;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('email_outbox')
        .where('status', '==', 'queued')
        .limit(limit)
        .get();
      let processed = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        try {
          if (process.env.RESEND_API_KEY) {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: data.from || 'QR Gear <noreply@qrgear.com>',
              to: data.to,
              subject: data.subject,
              html: data.html || data.body || '',
            });
          }
          await doc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
          processed++;
        } catch (sendErr: any) {
          await doc.ref.update({ status: 'failed', lastError: sendErr.message, retryCount: (data.retryCount || 0) + 1 });
        }
      }
      res.json({ success: true, processed, total: snapshot.size });
    } catch (error: any) {
      console.error("[NexusMail] Process error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/nexusmail/retry-failed", isAdmin, async (req: any, res) => {
    try {
      const limit = req.body?.limit || 10;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('email_outbox')
        .where('status', '==', 'failed')
        .limit(limit)
        .get();
      let retried = 0;
      for (const doc of snapshot.docs) {
        await doc.ref.update({ status: 'queued', lastError: null });
        retried++;
      }
      res.json({ success: true, retried });
    } catch (error: any) {
      console.error("[NexusMail] Retry error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/nexusmail/seed-templates", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const defaults = [
        { slug: 'order-confirmation', name: 'Order Confirmation', subject: 'Your QR Gear Order Confirmation', body: '<h1>Thank you for your order!</h1><p>Your order {{orderId}} has been received.</p>' },
        { slug: 'shipping-notification', name: 'Shipping Notification', subject: 'Your QR Gear Order Has Shipped', body: '<h1>Your order is on its way!</h1><p>Tracking: {{trackingNumber}}</p>' },
        { slug: 'welcome', name: 'Welcome Email', subject: 'Welcome to QR Gear!', body: '<h1>Welcome to QR Gear!</h1><p>We are excited to have you.</p>' },
      ];
      let created = 0;
      for (const tpl of defaults) {
        const existing = await fsDb.collection('email_templates').where('slug', '==', tpl.slug).get();
        if (existing.empty) {
          await fsDb.collection('email_templates').add({ ...tpl, createdAt: new Date().toISOString() });
          created++;
        }
      }
      res.json({ success: true, created, total: defaults.length });
    } catch (error: any) {
      console.error("[NexusMail] Seed templates error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/shelf-groups", isAdmin, async (_req: any, res) => {
    try {
      const groups = await fsGetAll("admin_shelf_groups", "sortOrder", "asc");
      res.json(groups);
    } catch (error: any) {
      console.error("[BuildShelf] List groups error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/shelf-groups", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(100),
        sortOrder: z.number().int().optional().default(0),
      });
      const parsed = schema.parse(req.body);

      const existing = await fsQuery("admin_shelf_groups", [["name", "==", parsed.name]]);
      if (existing.length > 0) {
        return res.status(409).json({ error: "A group with that name already exists" });
      }

      const group = await fsInsert("admin_shelf_groups", parsed);
      res.json(group);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Create group error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/shelf-groups/:id", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        sortOrder: z.number().int().optional(),
      });
      const parsed = schema.parse(req.body);

      if (parsed.name) {
        const existing = await fsQuery("admin_shelf_groups", [["name", "==", parsed.name]]);
        if (existing.length > 0 && existing[0].id !== req.params.id) {
          return res.status(409).json({ error: "A group with that name already exists" });
        }
      }

      const updated = await fsUpdate("admin_shelf_groups", req.params.id, parsed);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Update group error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/shelf-groups/:id", isAdmin, async (req: any, res) => {
    try {
      await fsDelete("admin_shelf_groups", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[BuildShelf] Delete group error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/build-shelf", isAdmin, async (req: any, res) => {
    try {
      const { provider, groupId } = req.query;
      let items;

      if (groupId) {
        items = await fsQuery("admin_build_shelf", [["groupIds", "array-contains", groupId]], "createdAt", "desc");
      } else {
        items = await fsGetAll("admin_build_shelf", "createdAt", "desc");
      }

      if (provider) {
        items = items.filter((item: any) => item.providerId === provider);
      }

      res.json(items);
    } catch (error: any) {
      console.error("[BuildShelf] List items error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/build-shelf", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        providerId: z.string().min(1),
        catalogId: z.string().min(1),
        catalog: z.record(z.any()),
        groupIds: z.array(z.string()).optional().default([]),
      });
      const parsed = schema.parse(req.body);

      // Resolve master_catalog docId — always store that as the shelfKey
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      let masterDocId: string;
      if (parsed.providerId === "printify") {
        masterDocId = `py_${parsed.catalogId}`;
      } else {
        const numId = parseInt(parsed.catalogId);
        const direct = await fsDb.collection("master_catalog").doc(`pf_${numId}`).get();
        if (direct.exists) {
          masterDocId = `pf_${numId}`;
        } else {
          const q = await fsDb.collection("master_catalog").where("printfulProductId", "==", numId).get();
          masterDocId = q.empty ? `pf_${numId}` : q.docs[0].id;
        }
      }

      // Also accept old-style legacy key for upsert lookup
      const legacyKey = `${parsed.providerId}:${parsed.catalogId}`;
      const existingByDocId = await fsQuery("admin_build_shelf", [["shelfKey", "==", masterDocId]]);
      const existingByLegacy = existingByDocId.length === 0
        ? await fsQuery("admin_build_shelf", [["shelfKey", "==", legacyKey]])
        : [];
      const existing = [...existingByDocId, ...existingByLegacy];

      if (existing.length > 0) {
        const updated = await fsUpdate("admin_build_shelf", existing[0].id, {
          shelfKey: masterDocId,
          catalog: parsed.catalog,
          groupIds: parsed.groupIds,
        });
        return res.json(updated);
      }

      const item = await fsInsert("admin_build_shelf", {
        shelfKey: masterDocId,
        providerId: parsed.providerId,
        catalogId: parsed.catalogId,
        catalog: parsed.catalog,
        groupIds: parsed.groupIds,
      });
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Add item error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/build-shelf/:id", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        groupIds: z.array(z.string()).optional(),
        catalog: z.record(z.any()).optional(),
      });
      const parsed = schema.parse(req.body);
      const updated = await fsUpdate("admin_build_shelf", req.params.id, parsed);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Update item error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/build-shelf/:id", isAdmin, async (req: any, res) => {
    try {
      await fsDelete("admin_build_shelf", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[BuildShelf] Delete item error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog/printful", isAdmin, async (req: any, res) => {
    try {
      const products = await fsGetAll('printful_products', 'lastSyncedAt', 'desc');
      const result = products.map((p: any) => ({
        docId: p.id,
        id: typeof p.id === 'string' ? parseInt(p.id, 10) || p.id : p.id,
        title: p.title || "",
        brand: p.brand || null,
        model: p.model || null,
        image: p.image || null,
        variantCount: p.variantCount || 0,
        category: p.typeName || p.type || "Other",
        description: p.description || null,
        type: p.typeName || p.type || null,
      }));
      res.json(result);
    } catch (error: any) {
      console.error("[Catalog/Printful] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog/printful-mappings", isAdmin, async (req: any, res) => {
    try {
      const firestoreMappings = await fsGetAll("printful_mappings");
      res.json({ firestoreMappings, hardcodedMappings: [] });
    } catch (error: any) {
      console.error("[Catalog/PrintfulMappings] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalogs", isAdmin, async (req: any, res) => {
    try {
      const catalogs = await fsGetAll("catalogs", "createdAt", "desc");
      res.json({ catalogs });
    } catch (error: any) {
      console.error("[Catalogs] List error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs", isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "name is required" });
      const catalog = await fsInsert("catalogs", {
        name: name.trim(),
        description: (description || "").trim(),
        blankIds: [],
        blankTiers: {},
        tierConfig: {},
        blankDescriptions: {},
        blankTitles: {},
      });
      res.json(catalog);
    } catch (error: any) {
      console.error("[Catalogs] Create error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/catalogs/:id", isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = (description || "").trim();
      const updated = await fsUpdate("catalogs", req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("[Catalogs] Update error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/catalogs/:id", isAdmin, async (req: any, res) => {
    try {
      await fsDelete("catalogs", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Catalogs] Delete error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs/:id/duplicate", isAdmin, async (req: any, res) => {
    try {
      const source = await fsGet("catalogs", req.params.id);
      if (!source) return res.status(404).json({ error: "Catalog not found" });
      const duplicate = await fsInsert("catalogs", {
        name: `${source.name} (Copy)`,
        description: source.description || "",
        blankIds: source.blankIds || [],
        blankTiers: source.blankTiers || {},
        tierConfig: source.tierConfig || {},
        blankDescriptions: source.blankDescriptions || {},
        blankTitles: source.blankTitles || {},
      });
      res.json(duplicate);
    } catch (error: any) {
      console.error("[Catalogs] Duplicate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs/:id/blanks", isAdmin, async (req: any, res) => {
    try {
      const { blankIds } = req.body;
      if (!Array.isArray(blankIds)) return res.status(400).json({ error: "blankIds must be an array" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const existing = new Set(catalog.blankIds || []);
      const newIds = blankIds.map(String).filter((id: string) => !existing.has(id));
      const merged = [...(catalog.blankIds || []), ...newIds];
      await fsUpdate("catalogs", req.params.id, { blankIds: merged });
      res.json({ success: true, added: newIds.length, total: merged.length });
    } catch (error: any) {
      console.error("[Catalogs] Add blanks error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/catalogs/:id/blanks", isAdmin, async (req: any, res) => {
    try {
      const { blankIds } = req.body;
      if (!Array.isArray(blankIds)) return res.status(400).json({ error: "blankIds must be an array" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const removeSet = new Set(blankIds.map(String));
      const remaining = (catalog.blankIds || []).filter((id: string) => !removeSet.has(id));
      const blankTiers = { ...(catalog.blankTiers || {}) };
      const blankDescriptions = { ...(catalog.blankDescriptions || {}) };
      const blankTitles = { ...(catalog.blankTitles || {}) };
      blankIds.forEach((id: string) => { delete blankTiers[String(id)]; delete blankDescriptions[String(id)]; delete blankTitles[String(id)]; });
      await fsUpdate("catalogs", req.params.id, { blankIds: remaining, blankTiers, blankDescriptions, blankTitles });
      res.json({ success: true, removed: blankIds.length, total: remaining.length });
    } catch (error: any) {
      console.error("[Catalogs] Remove blanks error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs/:id/bulk-copy", isAdmin, async (req: any, res) => {
    try {
      const { targetCatalogId, blankIds } = req.body;
      if (!targetCatalogId || !Array.isArray(blankIds)) return res.status(400).json({ error: "targetCatalogId and blankIds required" });
      const target = await fsGet("catalogs", targetCatalogId);
      if (!target) return res.status(404).json({ error: "Target catalog not found" });
      const existing = new Set(target.blankIds || []);
      const newIds = blankIds.map(String).filter((id: string) => !existing.has(id));
      const merged = [...(target.blankIds || []), ...newIds];
      await fsUpdate("catalogs", targetCatalogId, { blankIds: merged });
      res.json({ success: true, added: newIds.length, total: merged.length });
    } catch (error: any) {
      console.error("[Catalogs] Bulk copy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-tier", isAdmin, async (req: any, res) => {
    try {
      const { blankId, tier } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const blankTiers = { ...(catalog.blankTiers || {}) };
      if (tier) {
        blankTiers[String(blankId)] = tier;
      } else {
        delete blankTiers[String(blankId)];
      }
      await fsUpdate("catalogs", req.params.id, { blankTiers });
      res.json({ success: true, blankTiers });
    } catch (error: any) {
      console.error("[Catalogs] Set blank tier error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-description", isAdmin, async (req: any, res) => {
    try {
      const { blankId, description } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const blankDescriptions = { ...(catalog.blankDescriptions || {}) };
      if (description) {
        blankDescriptions[String(blankId)] = description;
      } else {
        delete blankDescriptions[String(blankId)];
      }
      await fsUpdate("catalogs", req.params.id, { blankDescriptions });
      res.json({ success: true, blankDescriptions });
    } catch (error: any) {
      console.error("[Catalogs] Set blank description error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-title", isAdmin, async (req: any, res) => {
    try {
      const { blankId, title } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const blankTitles = { ...(catalog.blankTitles || {}) };
      if (title) {
        blankTitles[String(blankId)] = title;
      } else {
        delete blankTitles[String(blankId)];
      }
      await fsUpdate("catalogs", req.params.id, { blankTitles });
      res.json({ success: true, blankTitles });
    } catch (error: any) {
      console.error("[Catalogs] Set blank title error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog-defaults", isAdmin, async (req: any, res) => {
    try {
      const doc = await fsGet("systemSettings", "catalog-defaults");
      res.json({ defaultCatalogId: doc?.defaultCatalogId || null });
    } catch (error: any) {
      console.error("[CatalogDefaults] Get error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalog-defaults", isAdmin, async (req: any, res) => {
    try {
      const { defaultCatalogId } = req.body;
      const { fsUpsert } = await import("../lib/firestore-crud");
      await fsUpsert("systemSettings", "catalog-defaults", { defaultCatalogId: defaultCatalogId || null });
      res.json({ success: true, defaultCatalogId: defaultCatalogId || null });
    } catch (error: any) {
      console.error("[CatalogDefaults] Set error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog-assignments", isAdmin, async (req: any, res) => {
    try {
      const doc = await fsGet("systemSettings", "catalog-assignments");
      res.json({
        member: doc?.member || null,
        public: doc?.public || null,
        external: doc?.external || null,
        marketplace: doc?.marketplace || null,
        platform: doc?.platform || null,
      });
    } catch (error: any) {
      console.error("[CatalogAssignments] Get error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalog-assignments", isAdmin, async (req: any, res) => {
    try {
      const { member, public: pub, external, marketplace, platform } = req.body;
      const { fsUpsert } = await import("../lib/firestore-crud");
      const updates: any = {};
      if (member !== undefined) updates.member = member;
      if (pub !== undefined) updates.public = pub;
      if (external !== undefined) updates.external = external;
      if (marketplace !== undefined) updates.marketplace = marketplace;
      if (platform !== undefined) updates.platform = platform;
      await fsUpsert("systemSettings", "catalog-assignments", updates);
      res.json({ success: true, ...updates });
    } catch (error: any) {
      console.error("[CatalogAssignments] Set error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Backfill category field on all master_catalog docs ──────────────────────
  app.post("/api/admin/master-catalog/backfill-categories", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      if (!fsDb) return res.status(503).json({ error: "Firestore not available" });

      function classifyCategory(title: string): string {
        const t = (title || '').toLowerCase();
        if (/christmas|holiday|ornament|halloween|easter|thanksgiving|valentine|xmas/.test(t)) return 'Holiday & Seasonal';
        if (/\bpet\b|\bdog\b|\bcat\b|puppy|kitten|\banimal\b/.test(t)) return 'Pet Products';
        if (/notebook|journal|planner|stationery|greeting card|postcard|notepad/.test(t)) return 'Stationery & Paper';
        if (/acrylic print|acrylic sign|metal print|gallery wrap|art board|canvas wrap|canvas gallery|canvas print|wall art|poster|framed|tapestry|\bbanner\b|\bflag\b|art print/.test(t)) return 'Wall Art & Posters';
        if (/tote bag|backpack|fanny pack|drawstring bag|duffel|duffle|messenger bag|crossbody|\bpouch\b|shopping bag|laptop bag/.test(t)) return 'Bags & Accessories';
        if (/phone case|iphone|samsung case|airpod|laptop sleeve|mouse pad|mousepad|tablet case/.test(t)) return 'Phone Cases & Tech';
        if (/sticker|magnet|decal|\bpatch\b/.test(t)) return 'Stickers & Magnets';
        if (/mugs?|tumbler|water bottle|wine glass|beer stein|beer mug|\bflask\b|thermos|travel mug|\bpint\b|drinkware|insulated bottle|insulated tumbler|shot glass/.test(t)) return 'Drinkware';
        if (/snapback|trucker hat|dad hat|baseball cap|bucket hat|\bbeanie\b|\bvisor\b|\bcap\b|\bhat\b/.test(t)) return 'Hats & Caps';
        if (/hoodie|hoody|sweatshirt|pullover|\bfleece\b|zip.?up|crewneck|crew neck|\bsweater\b/.test(t)) return 'Sweatshirts & Hoodies';
        if (/swimsuit|bikini|rash guard|windbreaker|biker short|boxer brief|bodycon|legging|yoga|jogger|sweatpant|sport bra|compression|activewear|athletic short/.test(t)) return 'Activewear & Specialty';
        if (/t-shirt|tshirt|\btee\b|tank top|\bpolo\b|v-neck|\bhenley\b|long sleeve|\bjersey\b|raglan|crop top|camisole|\bblouse\b|\bshirt\b/.test(t)) return 'T-Shirts & Tops';
        if (/\bpillow\b|blanket|\btowel\b|\bapron\b|\brug\b|doormat|table runner|cushion|coaster|shower curtain|duvet|bedding|\bbath\b|face mask|\bbandana\b|\bsock\b|calendar|\bclock\b|\bcandle\b|keychain|\bwallet\b|serving tray|phone stand/.test(t)) return 'Home & Living';
        if (/bracelet|necklace|earring|\bring\b|\bwatch\b|sunglasse|\bscarf\b|\bglove\b|\bbelt\b|headband|neck gaiter|hair/.test(t)) return 'Accessories';
        return 'Other';
      }

      const snap = await fsDb.collection('master_catalog').get();
      const CHUNK = 400;
      let updated = 0;
      let skipped = 0;

      const writes: Array<{ ref: FirebaseFirestore.DocumentReference; category: string }> = [];
      for (const doc of snap.docs) {
        const data = doc.data() as any;
        if (data.category && data.category !== 'Other') { skipped++; continue; }
        const category = classifyCategory(data.title || '');
        writes.push({ ref: doc.ref, category });
      }

      for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const batch = fsDb.batch();
        for (const w of chunk) {
          batch.update(w.ref, { category: w.category });
          updated++;
        }
        await batch.commit();
      }

      console.log(`[BackfillCategories] Updated ${updated} docs, skipped ${skipped} already-categorized docs`);
      res.json({ success: true, updated, skipped, total: snap.size });
    } catch (error: any) {
      console.error("[BackfillCategories] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
