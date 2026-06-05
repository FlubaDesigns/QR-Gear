import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { fsGetAll, fsGet, fsInsert, fsUpdate, fsDelete, fsQuery } from "../lib/firestore-crud";

const QRG_DOC_RE = /^qrg_[1-6][1-9][0-9]{3}$/;

/**
 * Thrown by resolveCatalogBlankId when an input ID cannot be resolved to a
 * master_catalog qrg_STNNN record. Callers should surface this as HTTP 400.
 */
class CatalogBlankResolverError extends Error {
  readonly statusCode = 400;
  readonly failedBlankId?: string;
  constructor(message: string, failedBlankId?: string) {
    super(message);
    this.name = 'CatalogBlankResolverError';
    this.failedBlankId = failedBlankId;
  }
}

/**
 * Resolves any blank ID input to its canonical master_catalog doc ID (qrg_STNNN).
 *
 * Accepted input forms:
 *   qrg_STNNN   — canonical QRG doc ID (verified against master_catalog)
 *   pending_*   — migration pending; returns null (caller decides whether to allow)
 *   py_NNN      — Printify blueprint ID prefix
 *   pf_NNN      — Printful product ID prefix (underscore form)
 *   pf:NNN      — Printful product ID prefix (colon form)
 *   NNN         — plain numeric (tried as Printify blueprint ID first)
 *
 * Returns:
 *   string  — canonical qrg_STNNN doc ID
 *   null    — intentional pending/migration ID (soft allow)
 *
 * Throws CatalogBlankResolverError (HTTP 400):
 *   — input cannot be resolved to any master_catalog record, or is structurally invalid
 *
 * Never invents a QRG ID. Only returns what exists in Firestore.
 */
async function resolveCatalogBlankId(inputId: string): Promise<string | null> {
  const id = String(inputId ?? '').trim();
  if (!id) throw new CatalogBlankResolverError('blankId must be a non-empty string');

  // Fast path: already a valid QRG doc ID
  if (QRG_DOC_RE.test(id)) {
    const { getFirestoreDb } = await import('../lib/firebase-admin');
    const fsDb = getFirestoreDb();
    const doc = await fsDb.collection('master_catalog').doc(id).get();
    if (doc.exists) return id;
    throw new CatalogBlankResolverError(`QRG blank "${id}" not found in master_catalog. Verify the blank has been synced.`, id);
  }

  // Pending migration IDs — soft allow, caller decides
  if (id.startsWith('pending_')) return null;

  const { getFirestoreDb } = await import('../lib/firebase-admin');
  const fsDb = getFirestoreDb();

  // Extract numeric provider ID from prefixed or plain form
  let numericId: number | null = null;
  const candidates: string[] = [id];

  if (id.startsWith('py_')) {
    const n = parseInt(id.slice(3), 10);
    if (!isNaN(n)) { numericId = n; candidates.push(String(n)); }
  } else if (id.startsWith('pf_')) {
    const n = parseInt(id.slice(3), 10);
    if (!isNaN(n)) { numericId = n; candidates.push(`pf:${n}`, String(n)); }
  } else if (id.startsWith('pf:')) {
    const n = parseInt(id.slice(3), 10);
    if (!isNaN(n)) { numericId = n; candidates.push(`pf_${n}`, String(n)); }
  } else {
    // Plain numeric — could be Printify blueprint or Printful product ID
    const n = parseInt(id, 10);
    if (!isNaN(n) && String(n) === id) {
      numericId = n;
      candidates.push(`py_${n}`, `pf_${n}`, `pf:${n}`);
    }
  }

  // Try direct doc lookups for all candidate key forms
  for (const candidate of candidates) {
    const doc = await fsDb.collection('master_catalog').doc(candidate).get();
    if (doc.exists) {
      const docId = doc.id;
      if (QRG_DOC_RE.test(docId)) return docId;
      if (docId.startsWith('pending_')) return null;
      // Non-QRG, non-pending doc found — unresolvable
      break;
    }
  }

  // Field queries: match printifyBlueprintId or printfulProductId
  if (numericId !== null) {
    const pyQ = await fsDb.collection('master_catalog')
      .where('printifyBlueprintId', '==', numericId).limit(1).get();
    if (!pyQ.empty) {
      const docId = pyQ.docs[0].id;
      if (QRG_DOC_RE.test(docId)) return docId;
      if (docId.startsWith('pending_')) return null;
    }

    const pfQ = await fsDb.collection('master_catalog')
      .where('printfulProductId', '==', numericId).limit(1).get();
    if (!pfQ.empty) {
      const docId = pfQ.docs[0].id;
      if (QRG_DOC_RE.test(docId)) return docId;
      if (docId.startsWith('pending_')) return null;
    }
  }

  throw new CatalogBlankResolverError(
    `Cannot resolve "${id}" to a QRG master_catalog record. ` +
    `Provider IDs (py_/pf_/pf:) are lookup references only — the blank must exist in master_catalog with a qrg_STNNN identity.`,
    id
  );
}

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
      const { provider, groupId, catalogId, mode } = req.query;
      let items;

      if (catalogId) {
        items = await fsQuery("admin_build_shelf", [["catalogId", "==", catalogId]], "createdAt", "desc");

        // Synthesize shelf items for any blankIds in the catalog that have no
        // corresponding admin_build_shelf entry. This bridges the gap when blanks
        // are added via BlankPickerModal (which only writes catalogs.blankIds) vs
        // the old shelf flow (which writes admin_build_shelf rows).
        try {
          const { getFirestoreDb } = await import("../lib/firebase-admin");
          const fsDb = getFirestoreDb();
          const catalogDoc = await fsDb.collection("catalogs").doc(String(catalogId)).get();
          if (catalogDoc.exists) {
            const catalogData = catalogDoc.data() as any;
            const blankIds: string[] = catalogData?.blankIds || [];
            const coveredKeys = new Set<string>(items.map((i: any) => i.shelfKey).filter(Boolean));
            const uncoveredIds = blankIds.filter((id: string) => !coveredKeys.has(id));
            if (uncoveredIds.length > 0) {
              const CHUNK = 30;
              for (let i = 0; i < uncoveredIds.length; i += CHUNK) {
                const chunk = uncoveredIds.slice(i, i + CHUNK);
                const docs = await Promise.all(chunk.map((key: string) => fsDb.collection("master_catalog").doc(key).get()));
                for (const doc of docs) {
                  if (!doc.exists) continue;
                  const m = doc.data() as any;
                  const providerId = m.printfulProductId ? "printful" : "printify";
                  const numericId = m.printifyBlueprintId ?? m.printfulProductId ?? 0;
                  const synthetic = {
                    id: `synthetic:${doc.id}`,
                    shelfKey: doc.id,
                    catalogId: String(catalogId),
                    groupIds: [],
                    providerId,
                    catalog: {
                      docId: doc.id,
                      id: numericId,
                      title: m.canonicalTitle || m.title || "",
                      description: m.canonicalDescription || m.description || null,
                      brand: m.brand || null,
                      imageUrl: m.images?.[0] || m.imageUrl || null,
                      images: m.images || [],
                      madeInUSA: m.madeInUSA ?? false,
                      minPrice: m.minPrice || null,
                      maxPrice: m.maxPrice || null,
                      colorCount: m.colorCount ?? null,
                      availableColors: m.availableColors || [],
                      availableSizes: m.availableSizes || [],
                      fulfillmentProvider: providerId,
                      qrgCategory: m.qrgCategory || null,
                      printifyImages: m.printifyImages || [],
                      printfulImages: m.printfulImages || [],
                    },
                  };
                  items = [...items, synthetic];
                }
              }
            }
          }
        } catch (synthErr: any) {
          console.warn("[BuildShelf] Synthetic item synthesis failed (non-fatal):", synthErr.message);
        }
      } else if (groupId) {
        items = await fsQuery("admin_build_shelf", [["groupIds", "array-contains", groupId]], "createdAt", "desc");
      } else if (mode === "global") {
        items = await fsGetAll("admin_build_shelf", "createdAt", "desc");
      } else {
        return res.status(400).json({ error: "catalogId is required. Pass ?mode=global to list all shelf items." });
      }

      if (provider) {
        items = items.filter((item: any) => item.providerId === provider);
      }

      // Augment each shelf item's catalog with the full images[] from master_catalog.
      // admin_build_shelf only stores a single imageUrl; the authoritative image list
      // lives in master_catalog.images (written during catalog import / sync).
      const shelfKeys = Array.from(new Set(items.map((i: any) => i.shelfKey).filter(Boolean))) as string[];
      if (shelfKeys.length > 0) {
        const { getFirestoreDb } = await import("../lib/firebase-admin");
        const fsDb = getFirestoreDb();
        const masterMap = new Map<string, any>();
        const CHUNK = 30;
        for (let i = 0; i < shelfKeys.length; i += CHUNK) {
          const chunk = shelfKeys.slice(i, i + CHUNK);
          const docs = await Promise.all(chunk.map((key: string) => fsDb.collection("master_catalog").doc(key).get()));
          for (const doc of docs) {
            if (doc.exists) masterMap.set(doc.id, doc.data());
          }
        }
        items = items.map((item: any) => {
          const master = masterMap.get(item.shelfKey);
          const masterImages: string[] = master?.images || [];
          const qrgCategory: string | null = master?.qrgCategory || null;
          if (!masterImages.length && !qrgCategory) return item;
          const catalogPatch: Record<string, any> = {};
          if (masterImages.length) catalogPatch.images = masterImages;
          if (qrgCategory) catalogPatch.qrgCategory = qrgCategory;
          return { ...item, catalog: { ...item.catalog, ...catalogPatch } };
        });
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

      // Resolve to canonical qrg_STNNN shelfKey via resolveCatalogBlankId().
      // Provider keys (py_NNN, pf_NNN) are lookup references only — never stored as identity.
      const providerPrefixedId = parsed.providerId === "printify"
        ? `py_${parsed.catalogId}`
        : `pf_${parsed.catalogId}`;
      let masterDocId: string;
      try {
        const resolved = await resolveCatalogBlankId(providerPrefixedId);
        // null means pending_ migration ID — keep provider-prefixed key as fallback
        masterDocId = resolved ?? providerPrefixedId;
      } catch {
        // Not yet in master_catalog — store provider key temporarily, migration will fix later
        console.warn(`[BuildShelf] Cannot resolve "${providerPrefixedId}" to QRG canonical ID — blank not yet synced to master_catalog. Storing provider key as fallback.`);
        masterDocId = providerPrefixedId;
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
        blankMakers: {},
        blankModels: {},
        blankProviders: {},
        blankImages: {},
        blankPrimaryImages: {},
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
        blankMakers: source.blankMakers || {},
        blankModels: source.blankModels || {},
        blankProviders: source.blankProviders || {},
        blankImages: source.blankImages || {},
        blankPrimaryImages: source.blankPrimaryImages || {},
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

      // Resolve all inputs to canonical qrg_STNNN identities before persisting
      const resolvedIds: string[] = [];
      for (const rawId of blankIds) {
        const canonical = await resolveCatalogBlankId(String(rawId));
        if (canonical !== null) resolvedIds.push(canonical);
        // null = pending migration ID → silently skip (not persisted)
      }

      const existing = new Set(catalog.blankIds || []);
      const newIds = resolvedIds.filter((id) => !existing.has(id));
      // Deduplicate the full merged array — also heals any pre-existing duplicates in Firestore
      const merged = Array.from(new Set([...(catalog.blankIds || []), ...newIds]));
      await fsUpdate("catalogs", req.params.id, { blankIds: merged });
      res.json({ success: true, added: newIds.length, total: merged.length });
    } catch (error: any) {
      console.error("[Catalogs] Add blanks error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message, failedBlankId: error.failedBlankId });
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/catalogs/:id/blanks", isAdmin, async (req: any, res) => {
    try {
      const { blankIds } = req.body;
      if (!Array.isArray(blankIds)) return res.status(400).json({ error: "blankIds must be an array" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });

      // Build the set of keys to remove: always include the raw input key (handles
      // legacy stored IDs), plus the resolved canonical key when resolvable.
      // Unresolvable IDs (not found in master_catalog) return 400 — callers must
      // send IDs that exist or can be resolved. Provider keys (py_/pf_) are resolved
      // so both the raw and canonical key are removed from all overlay maps.
      const removeSet = new Set<string>();
      for (const rawId of blankIds) {
        const raw = String(rawId);
        removeSet.add(raw);
        const canonical = await resolveCatalogBlankId(raw); // throws CatalogBlankResolverError → 400
        if (canonical) removeSet.add(canonical);
      }

      const remaining = (catalog.blankIds || []).filter((id: string) => !removeSet.has(id));

      // Clean all nine overlay maps
      const blankTiers = { ...(catalog.blankTiers || {}) };
      const blankDescriptions = { ...(catalog.blankDescriptions || {}) };
      const blankTitles = { ...(catalog.blankTitles || {}) };
      const blankMakers = { ...(catalog.blankMakers || {}) };
      const blankModels = { ...(catalog.blankModels || {}) };
      const blankProviders = { ...(catalog.blankProviders || {}) };
      const blankImages = { ...(catalog.blankImages || {}) };
      const blankPrimaryImages = { ...(catalog.blankPrimaryImages || {}) };

      removeSet.forEach((key) => {
        delete blankTiers[key];
        delete blankDescriptions[key];
        delete blankTitles[key];
        delete blankMakers[key];
        delete blankModels[key];
        delete blankProviders[key];
        delete blankImages[key];
        delete blankPrimaryImages[key];
      });

      await fsUpdate("catalogs", req.params.id, {
        blankIds: remaining,
        blankTiers,
        blankDescriptions,
        blankTitles,
        blankMakers,
        blankModels,
        blankProviders,
        blankImages,
        blankPrimaryImages,
      });
      res.json({ success: true, removed: removeSet.size, total: remaining.length });
    } catch (error: any) {
      console.error("[Catalogs] Remove blanks error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs/:id/bulk-copy", isAdmin, async (req: any, res) => {
    try {
      const { targetCatalogId, blankIds } = req.body;
      if (!targetCatalogId || !Array.isArray(blankIds)) return res.status(400).json({ error: "targetCatalogId and blankIds required" });
      const target = await fsGet("catalogs", targetCatalogId);
      if (!target) return res.status(404).json({ error: "Target catalog not found" });

      // Resolve all inputs to canonical qrg_STNNN identities before persisting
      const resolvedIds: string[] = [];
      for (const rawId of blankIds) {
        const canonical = await resolveCatalogBlankId(String(rawId));
        if (canonical !== null) resolvedIds.push(canonical);
      }

      const existing = new Set(target.blankIds || []);
      const newIds = resolvedIds.filter((id) => !existing.has(id));
      // Deduplicate the full merged array — also heals any pre-existing duplicates in Firestore
      const merged = Array.from(new Set([...(target.blankIds || []), ...newIds]));
      await fsUpdate("catalogs", targetCatalogId, { blankIds: merged });
      res.json({ success: true, added: newIds.length, total: merged.length });
    } catch (error: any) {
      console.error("[Catalogs] Bulk copy error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-tier", isAdmin, async (req: any, res) => {
    try {
      const { blankId, tier } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const canonicalId = await resolveCatalogBlankId(String(blankId));
      if (canonicalId === null) return res.status(400).json({ error: `Blank "${blankId}" is pending classification and cannot be tier-assigned yet` });
      const blankTiers = { ...(catalog.blankTiers || {}) };
      if (tier) {
        blankTiers[canonicalId] = tier;
      } else {
        delete blankTiers[canonicalId];
      }
      await fsUpdate("catalogs", req.params.id, { blankTiers });
      res.json({ success: true, blankTiers });
    } catch (error: any) {
      console.error("[Catalogs] Set blank tier error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-description", isAdmin, async (req: any, res) => {
    try {
      const { blankId, description } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const canonicalId = await resolveCatalogBlankId(String(blankId));
      if (canonicalId === null) return res.status(400).json({ error: `Blank "${blankId}" is pending classification` });
      const blankDescriptions = { ...(catalog.blankDescriptions || {}) };
      if (description) {
        blankDescriptions[canonicalId] = description;
      } else {
        delete blankDescriptions[canonicalId];
      }
      await fsUpdate("catalogs", req.params.id, { blankDescriptions });
      res.json({ success: true, blankDescriptions });
    } catch (error: any) {
      console.error("[Catalogs] Set blank description error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-title", isAdmin, async (req: any, res) => {
    try {
      const { blankId, title } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const canonicalId = await resolveCatalogBlankId(String(blankId));
      if (canonicalId === null) return res.status(400).json({ error: `Blank "${blankId}" is pending classification` });
      const blankTitles = { ...(catalog.blankTitles || {}) };
      if (title) {
        blankTitles[canonicalId] = title;
      } else {
        delete blankTitles[canonicalId];
      }
      await fsUpdate("catalogs", req.params.id, { blankTitles });
      res.json({ success: true, blankTitles });
    } catch (error: any) {
      console.error("[Catalogs] Set blank title error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-colors", isAdmin, async (req: any, res) => {
    try {
      const { blankId, colors } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      if (!Array.isArray(colors)) return res.status(400).json({ error: "colors must be an array" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const canonicalId = await resolveCatalogBlankId(String(blankId));
      if (canonicalId === null) return res.status(400).json({ error: `Blank "${blankId}" is pending classification` });
      const blankColors: Record<string, Array<{name: string; hex: string}>> = { ...(catalog.blankColors || {}) };
      if (colors.length === 0) {
        delete blankColors[canonicalId];
      } else {
        blankColors[canonicalId] = colors.map((c: any) => ({ name: String(c.name || ''), hex: String(c.hex || '') }));
      }
      await fsUpdate("catalogs", req.params.id, { blankColors });
      res.json({ success: true, blankColors });
    } catch (error: any) {
      console.error("[Catalogs] Set blank colors error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // ── Curated image list for a blank within a catalog ──────────────────────
  // An empty array restores the master images (clears the override).
  app.put("/api/admin/catalogs/:id/blank-images", isAdmin, async (req: any, res) => {
    try {
      const { blankId, images } = req.body;
      if (!blankId || !Array.isArray(images)) {
        return res.status(400).json({ error: "blankId and images[] are required" });
      }
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const canonicalId = await resolveCatalogBlankId(String(blankId));
      if (canonicalId === null) return res.status(400).json({ error: `Blank "${blankId}" is pending classification` });
      const blankImages = { ...(catalog.blankImages || {}) };
      if (images.length > 0) {
        blankImages[canonicalId] = images.map(String);
      } else {
        // Empty array = restore master — remove override entry
        delete blankImages[canonicalId];
      }
      await fsUpdate("catalogs", req.params.id, { blankImages });
      console.log(`[Catalogs] Updated images for blank ${canonicalId} in catalog ${req.params.id}: ${images.length} images`);
      res.json({ success: true, blankId: canonicalId, imageCount: images.length });
    } catch (error: any) {
      console.error("[Catalogs] Set blank images error:", error);
      if (error instanceof CatalogBlankResolverError) return res.status(400).json({ error: error.message });
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

  // ── Migrate legacy blank IDs in all catalog documents ───────────────────────
  // Scans every `catalogs` doc and resolves any non-canonical blankId to its
  // qrg_STNNN form, re-keying all eight blank-keyed overlay maps in the same pass.
  // (tierConfig is excluded — it is not keyed by blankId.)
  // IDs that cannot be resolved are flagged and left untouched (never dropped).
  app.post("/api/admin/catalogs/migrate-legacy-ids", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      if (!fsDb) return res.status(503).json({ error: "Firestore not available" });

      const OVERLAY_MAPS = [
        "blankTiers",
        "blankDescriptions",
        "blankTitles",
        "blankMakers",
        "blankModels",
        "blankProviders",
        "blankImages",
        "blankPrimaryImages",
      ] as const;

      const catalogsSnap = await fsDb.collection("catalogs").get();

      const report: {
        catalogId: string;
        catalogName: string;
        migrated: { from: string; to: string }[];
        unresolvable: string[];
        conflicts: { map: string; canonicalId: string; keptKey: string; droppedLegacyKeys: string[] }[];
        skipped: number;
        changed: boolean;
      }[] = [];

      const CHUNK = 400;
      const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> = [];

      for (const catalogDoc of catalogsSnap.docs) {
        const data = catalogDoc.data() as any;
        const catalogName: string = data.name || catalogDoc.id;

        const originalBlankIds: string[] = Array.isArray(data.blankIds) ? data.blankIds : [];

        // Collect the FULL set of IDs to resolve: blankIds union all overlay map keys.
        // This ensures overlay entries that drifted out of sync with blankIds are also migrated.
        const allRawIds = new Set<string>(originalBlankIds);
        for (const mapKey of OVERLAY_MAPS) {
          const originalMap: Record<string, any> = data[mapKey] || {};
          for (const key of Object.keys(originalMap)) allRawIds.add(key);
        }

        // Build a remapping table: raw key → canonical key (or null = unresolvable/pending)
        const remapTable = new Map<string, string | null>();
        for (const rawId of Array.from(allRawIds)) {
          if (QRG_DOC_RE.test(rawId)) {
            // Already canonical — verify it exists; mark null only if missing (don't remap)
            const doc = await fsDb.collection("master_catalog").doc(rawId).get();
            remapTable.set(rawId, doc.exists ? rawId : null);
          } else {
            try {
              const canonical = await resolveCatalogBlankId(rawId);
              remapTable.set(rawId, canonical); // null = pending; non-null = resolved
            } catch {
              remapTable.set(rawId, null); // unresolvable
            }
          }
        }

        // ── Rebuild blankIds ───────────────────────────────────────────────
        const newBlankIds: string[] = [];
        const migrated: { from: string; to: string }[] = [];
        const unresolvableSet = new Set<string>();
        let skipped = 0;
        const seenCanonical = new Set<string>();

        for (const rawId of originalBlankIds) {
          const canonical = remapTable.get(rawId);
          if (canonical === null || canonical === undefined) {
            // Unresolvable or pending: keep raw ID so nothing is lost
            if (!seenCanonical.has(rawId)) {
              newBlankIds.push(rawId);
              seenCanonical.add(rawId);
              unresolvableSet.add(rawId);
            }
          } else if (canonical === rawId) {
            // Already canonical
            if (!seenCanonical.has(canonical)) {
              newBlankIds.push(canonical);
              seenCanonical.add(canonical);
              skipped++;
            }
          } else {
            // Needs migration
            if (!seenCanonical.has(canonical)) {
              newBlankIds.push(canonical);
              seenCanonical.add(canonical);
              migrated.push({ from: rawId, to: canonical });
            }
          }
        }

        // ── Re-key all overlay maps (two-pass: canonical entries win) ─────
        // When key drift means both a legacy key and the canonical key exist
        // in the same map, the canonical entry must take priority.
        // Pass 1 inserts all already-canonical entries; Pass 2 inserts legacy
        // entries only if the canonical slot was not already filled.
        const updatedOverlays: any = {};
        let overlayChanged = false;
        const catalogConflicts: {
          map: string;
          canonicalId: string;
          keptKey: string;
          droppedLegacyKeys: string[];
        }[] = [];

        for (const mapKey of OVERLAY_MAPS) {
          const originalMap: Record<string, any> = data[mapKey] || {};
          const newMap: Record<string, any> = {};

          // Pass 1: insert entries whose key is already canonical (key === canonical).
          for (const [key, value] of Object.entries(originalMap)) {
            const canonical = remapTable.get(key);
            if (canonical !== null && canonical !== undefined && canonical === key) {
              newMap[canonical] = value;
            }
          }

          // Pass 2: insert unresolvable entries (keep as-is) and legacy-key entries
          // (only if canonical slot not already filled by Pass 1).
          // Track conflicts where canonical slot was already filled.
          const legacyDropped = new Map<string, string[]>(); // canonicalId → legacy keys dropped
          for (const [key, value] of Object.entries(originalMap)) {
            const canonical = remapTable.get(key);
            if (canonical === null || canonical === undefined) {
              // Unresolvable: keep under original key, flag for review
              newMap[key] = value;
              unresolvableSet.add(key);
            } else if (canonical !== key) {
              // Legacy key → canonical key remapping
              overlayChanged = true;
              if (canonical in newMap) {
                // Canonical slot already filled (by Pass 1 or an earlier legacy entry that
                // got promoted) — drop this legacy value, record the collision
                const dropped = legacyDropped.get(canonical) || [];
                dropped.push(key);
                legacyDropped.set(canonical, dropped);
              } else {
                newMap[canonical] = value;
              }
            }
            // key === canonical case handled in Pass 1 — skip here
          }

          // Record conflicts for this map
          for (const [canonicalId, droppedLegacyKeys] of Array.from(legacyDropped.entries())) {
            catalogConflicts.push({
              map: mapKey,
              canonicalId,
              keptKey: canonicalId,
              droppedLegacyKeys,
            });
          }

          updatedOverlays[mapKey] = newMap;
        }

        // ── Determine whether the document actually changed ────────────────
        const blankIdsChanged = migrated.length > 0;
        const changed = blankIdsChanged || overlayChanged;

        report.push({
          catalogId: catalogDoc.id,
          catalogName,
          migrated,
          unresolvable: Array.from(unresolvableSet),
          conflicts: catalogConflicts,
          skipped,
          changed,
        });

        if (changed) {
          writes.push({
            ref: catalogDoc.ref,
            data: {
              blankIds: newBlankIds,
              ...updatedOverlays,
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      // Write in batches of 400
      for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const batch = fsDb.batch();
        for (const w of chunk) {
          batch.update(w.ref, w.data);
        }
        await batch.commit();
      }

      const totalMigrated = report.reduce((sum, r) => sum + r.migrated.length, 0);
      const totalUnresolvable = report.reduce((sum, r) => sum + r.unresolvable.length, 0);
      const totalConflicts = report.reduce((sum, r) => sum + r.conflicts.length, 0);
      const catalogsChanged = report.filter((r) => r.changed).length;

      console.log(
        `[MigrateLegacyIds] Scanned ${catalogsSnap.size} catalogs. ` +
        `${catalogsChanged} updated, ${totalMigrated} IDs migrated, ` +
        `${totalUnresolvable} unresolvable, ${totalConflicts} conflicts resolved (canonical kept).`
      );

      res.json({
        success: true,
        catalogsScanned: catalogsSnap.size,
        catalogsChanged,
        totalMigrated,
        totalUnresolvable,
        totalConflicts,
        report,
      });
    } catch (error: any) {
      console.error("[MigrateLegacyIds] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Backfill category field on all master_catalog docs ──────────────────────
  app.post("/api/admin/master-catalog/backfill-categories", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      if (!fsDb) return res.status(503).json({ error: "Firestore not available" });

      const classifyCategory = (title: string): string => {
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

  // POST /api/admin/catalogs/migrate-blank-ids
  // Finding-A remediation: scans every catalog for legacy provider-prefixed blankIds
  // (py_NNN, pf_NNN, pf:NNN, plain numeric) and resolves them to canonical qrg_STNNN.
  // Also remaps all overlay maps (blankTiers, blankDescriptions, blankTitles, etc.) to
  // use the new key. Unresolvable IDs are dropped and reported. Idempotent — safe to re-run.
  app.post("/api/admin/catalogs/migrate-blank-ids", isAdmin, async (req: any, res: any) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const OVERLAY_MAPS = ['blankTiers', 'blankDescriptions', 'blankTitles', 'blankMakers', 'blankModels', 'blankProviders', 'blankImages', 'blankPrimaryImages'];
      const QRG_RE = /^qrg_[1-6][1-9][0-9]{3}$/;

      const snap = await fsDb.collection('catalogs').get();
      const report: any[] = [];

      for (const docSnap of snap.docs) {
        const catalogId = docSnap.id;
        const data = docSnap.data() as any;
        const blankIds: string[] = (data.blankIds || []).map(String);

        const legacyIds = blankIds.filter((id: string) => !QRG_RE.test(id) && !id.startsWith('pending_'));
        if (legacyIds.length === 0) {
          report.push({ catalogId, name: data.name, status: 'clean' });
          continue;
        }

        const resolvedIds: string[] = [];
        const dropped: string[] = [];
        const remap = new Map<string, string | null>(); // oldKey → newKey (null = drop)

        for (const rawId of blankIds) {
          const id = String(rawId);
          if (QRG_RE.test(id) || id.startsWith('pending_')) {
            resolvedIds.push(id);
            continue;
          }
          try {
            const canonical = await resolveCatalogBlankId(id);
            if (canonical === null) { resolvedIds.push(id); continue; }
            remap.set(id, canonical);
            resolvedIds.push(canonical);
          } catch {
            remap.set(id, null);
            dropped.push(id);
          }
        }

        const newBlankIds = Array.from(new Set(resolvedIds));

        const updates: any = { blankIds: newBlankIds, updatedAt: new Date().toISOString() };
        for (const mapField of OVERLAY_MAPS) {
          const oldMap: Record<string, any> = data[mapField] || {};
          if (Object.keys(oldMap).length === 0) continue;
          const newMap: Record<string, any> = {};
          for (const [k, v] of Object.entries(oldMap)) {
            const newKey = remap.has(k) ? remap.get(k) : k;
            if (newKey !== null && newKey !== undefined) newMap[newKey as string] = v;
          }
          updates[mapField] = newMap;
        }

        await docSnap.ref.update(updates);
        console.log(`[CatalogMigration] Migrated catalog "${data.name}" (${catalogId}): ${remap.size} remapped, ${dropped.length} dropped`);
        report.push({ catalogId, name: data.name, status: 'migrated', remapped: remap.size, dropped: dropped.length, droppedIds: dropped });
      }

      const migrated = report.filter((r: any) => r.status === 'migrated').length;
      const clean = report.filter((r: any) => r.status === 'clean').length;
      console.log(`[CatalogMigration] Done: ${snap.size} catalogs scanned, ${migrated} migrated, ${clean} already clean`);
      res.json({ success: true, catalogsScanned: snap.size, migrated, clean, report });
    } catch (error: any) {
      console.error('[CatalogMigration] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
}
