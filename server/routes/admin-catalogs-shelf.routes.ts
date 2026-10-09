import { registerCatalogRoutes } from "../../functions/src/services/admin-catalog-routes";
import { getFirestoreDb } from "../lib/firebase-admin";
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
  registerCatalogRoutes(app, "/api/admin", isAdmin, { db: getFirestoreDb, now: () => new Date().toISOString() });
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

}
