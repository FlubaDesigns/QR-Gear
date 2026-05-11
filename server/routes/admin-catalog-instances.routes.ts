/**
 * Admin Catalog Instances
 *
 * Architecture:
 *   provider handlers → master_catalog (read-only canonical)
 *   master_catalog → admin_catalog_instances (editable derived copy)
 *   admin_catalog_instances → member_library_instances (per-member derived copy)
 *   instances → packets / templates / graphics (attached artifacts)
 *
 * Every instance preserves full lineage back to its master catalog source.
 */

import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";

const ADMIN_INSTANCES_COLLECTION = "admin_catalog_instances";
const MASTER_CATALOG_COLLECTION = "master_catalog";
const MEMBER_INSTANCES_COLLECTION = "member_library_instances";
const PRODUCT_PACKETS_COLLECTION = "productPackets";

function resolveFields(base: Record<string, any>, overrides: Record<string, any>): Record<string, any> {
  const resolved: Record<string, any> = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== null && val !== undefined && val !== "") {
      resolved[key] = val;
    }
  }
  return resolved;
}

export function registerAdminCatalogInstanceRoutes(app: Express): void {

  // ── List admin instances ─────────────────────────────────────────────────
  app.get("/api/admin/catalog-instances", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const { storeId, channelId, collectionName, folderPath, catalogId, sourceMasterId } = req.query as Record<string, string>;

      // Build the Firestore query using only the most selective indexed fields.
      // channelId / collectionName are intentionally NOT used as Firestore filters
      // because older instances (pre-folder-path CF) have those fields as null.
      // We filter them in memory below so legacy items still surface.
      let query: any = (storeId || catalogId || sourceMasterId)
        ? db.collection(ADMIN_INSTANCES_COLLECTION)
        : db.collection(ADMIN_INSTANCES_COLLECTION).orderBy("createdAt", "desc");

      if (catalogId)      query = query.where("catalogId",      "==", catalogId);
      if (sourceMasterId) query = query.where("sourceMasterId", "==", sourceMasterId);
      if (storeId)        query = query.where("storeId",        "==", storeId);
      // folderPath is an exact-match shortcut when provided — only use it alone
      if (folderPath && !channelId && !collectionName) {
        query = query.where("folderPath", "==", folderPath);
      }

      const snap = await query.limit(500).get();
      let instances: any[] = snap.docs.map((doc: any) => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || null,
          updatedAt: d.updatedAt?.toDate?.() || null,
        };
      });

      // In-memory filters for channel / collection — handles legacy null fields gracefully.
      // An instance with a null/missing channelId is treated as belonging to ALL channels
      // within its store so it always surfaces (prevents data disappearing after CF upgrade).
      if (channelId) {
        instances = instances.filter(inst =>
          !inst.channelId || inst.channelId === channelId
        );
      }
      if (collectionName) {
        instances = instances.filter(inst =>
          inst.collectionName === collectionName
        );
      }

      // Sort newest-first
      instances.sort((a: any, b: any) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });

      res.json({ success: true, instances, count: instances.length });
    } catch (err: any) {
      console.error("[AdminInstances] list error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Look up instance by packetId (for auto-select after commit) ─────────────
  // Must be registered BEFORE /:id so Express doesn't swallow "by-packet".
  app.get("/api/admin/catalog-instances/by-packet/:packetId", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const { packetId } = req.params;
      const snap = await db.collection(ADMIN_INSTANCES_COLLECTION)
        .where("currentPacketId", "==", packetId)
        .limit(1).get();

      if (snap.empty) {
        return res.status(404).json({ error: `No instance found for packetId ${packetId}` });
      }

      const doc = snap.docs[0];
      const d = doc.data();
      const instance = {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.() || null,
        updatedAt: d.updatedAt?.toDate?.() || null,
      };

      // Fetch store to get roleType
      let storeRoleType: string | null = null;
      if (instance.storeId) {
        const storeDoc = await db.collection("stores").doc(instance.storeId).get();
        if (storeDoc.exists) {
          storeRoleType = (storeDoc.data() as any)?.roleType ?? null;
        }
      }

      res.json({ success: true, instance, storeRoleType });
    } catch (err: any) {
      console.error("[AdminInstances] by-packet error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get single admin instance ────────────────────────────────────────────
  app.get("/api/admin/catalog-instances/:id", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const doc = await db.collection(ADMIN_INSTANCES_COLLECTION).doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: "Instance not found" });

      const d = doc.data()!;
      res.json({
        success: true,
        instance: {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || null,
          updatedAt: d.updatedAt?.toDate?.() || null,
        },
      });
    } catch (err: any) {
      console.error("[AdminInstances] get error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create admin instance from master catalog item ───────────────────────
  app.post("/api/admin/catalog-instances/from-master", isAdmin, async (req: any, res) => {
    try {
      const { sourceMasterId, catalogId, metadata } = req.body;

      if (!sourceMasterId) return res.status(400).json({ error: "sourceMasterId is required" });
      if (!catalogId) return res.status(400).json({ error: "catalogId is required" });

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      // Fetch master catalog item — must exist and be read-only from here on
      const masterDoc = await db.collection(MASTER_CATALOG_COLLECTION).doc(sourceMasterId).get();
      if (!masterDoc.exists) {
        return res.status(404).json({ error: `Master catalog item not found: ${sourceMasterId}` });
      }
      const master = masterDoc.data()!;

      const now = FieldValue.serverTimestamp();

      // Clone master display fields as baseSnapshot — never mutate the master doc
      const baseSnapshot = {
        title: master.title || "",
        description: master.description || null,
        images: master.images || [],
        brand: master.brand || null,
        colors: master.colors || [],
        sizes: master.sizes || [],
        category: master.category || null,
        originCountry: master.originCountry || null,
        minPrice: master.minPrice || null,
        maxPrice: master.maxPrice || null,
        printifyBlueprintId: master.printifyBlueprintId || null,
        printfulProductId: master.printfulProductId || null,
      };

      // resolved starts identical to base — overrides will diverge it
      const resolved = { ...baseSnapshot };

      const instanceData = {
        instanceType: "admin",
        sourceMasterId,
        catalogId,
        ownerAdminId: req.user?.uid || null,
        baseSnapshot,
        overrides: {},
        resolved,
        currentPacketId: null,
        currentTemplateId: null,
        currentGraphicSetId: null,
        status: "active",
        metadata: metadata || null,
        createdAt: now,
        updatedAt: now,
      };

      const ref = await db.collection(ADMIN_INSTANCES_COLLECTION).add(instanceData);

      console.log(`[AdminInstances] Created instance ${ref.id} from master ${sourceMasterId}`);
      res.json({ success: true, instanceId: ref.id, sourceMasterId });
    } catch (err: any) {
      console.error("[AdminInstances] from-master error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Save admin overrides to instance (NEVER touches master) ─────────────
  app.patch("/api/admin/catalog-instances/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { overrides, metadata, status, folderUpdate, enabledColors, enabledSizes, customerPrice } = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const ref = db.collection(ADMIN_INSTANCES_COLLECTION).doc(id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Instance not found" });

      const existing = doc.data()!;

      // Merge incoming overrides on top of existing overrides
      const mergedOverrides = { ...existing.overrides, ...overrides };

      // Recompute resolved = base merged with all overrides (no nulls win)
      const resolved = resolveFields(existing.baseSnapshot, mergedOverrides);

      const update: Record<string, any> = {
        overrides: mergedOverrides,
        resolved,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (metadata !== undefined) update.metadata = metadata;
      if (status !== undefined) update.status = status;

      // Listing controls — stored at top level, not in overrides
      if (enabledColors !== undefined) update.enabledColors = enabledColors;
      if (enabledSizes !== undefined) update.enabledSizes = enabledSizes;
      if (customerPrice !== undefined) update.customerPrice = customerPrice;

      // Folder move — update top-level folder fields atomically
      if (folderUpdate) {
        const allowed = ["storeId","storeName","channelId","channelName","collectionId","collectionName","folderPath"];
        for (const key of allowed) {
          if (folderUpdate[key] !== undefined) update[key] = folderUpdate[key];
        }
      }

      await ref.update(update);

      console.log(`[AdminInstances] Updated instance ${id}`);
      res.json({ success: true, instanceId: id, resolved });
    } catch (err: any) {
      console.error("[AdminInstances] patch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Delete admin instance ────────────────────────────────────────────────
  app.delete("/api/admin/catalog-instances/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const ref = db.collection(ADMIN_INSTANCES_COLLECTION).doc(id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Instance not found" });

      await ref.delete();
      console.log(`[AdminInstances] Deleted instance ${id}`);
      res.json({ success: true, instanceId: id });
    } catch (err: any) {
      console.error("[AdminInstances] delete error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create or update a packet from an admin instance ─────────────────────
  // Packet is an attached artifact — lineage is written back onto the instance
  app.post("/api/admin/catalog-instances/:id/create-packet", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const packetFields = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const instanceRef = db.collection(ADMIN_INSTANCES_COLLECTION).doc(id);
      const instanceDoc = await instanceRef.get();
      if (!instanceDoc.exists) return res.status(404).json({ error: "Instance not found" });

      const instance = instanceDoc.data()!;
      const now = FieldValue.serverTimestamp();

      const packetData = {
        // Lineage — mandatory, never lose these
        ownerType: "admin",
        ownerInstanceId: id,
        sourceMasterId: instance.sourceMasterId,
        sourceAdminInstanceId: id,
        sourceMemberInstanceId: null,

        // Resolved product identity from the instance
        productId: instance.resolved?.printifyBlueprintId
          ? `py_${instance.resolved.printifyBlueprintId}`
          : null,
        masterTitle: instance.baseSnapshot?.title || null,
        adminCatalogTitle: instance.resolved?.title || null,
        effectiveTitle: instance.resolved?.title || instance.baseSnapshot?.title || null,
        masterDescription: instance.baseSnapshot?.description || null,
        adminCatalogDescription: instance.resolved?.description || null,
        effectiveDescription: instance.resolved?.description || instance.baseSnapshot?.description || null,
        productImageUrl: instance.resolved?.images?.[0] || null,
        blueprintId: instance.resolved?.printifyBlueprintId || null,
        manufacturer: instance.resolved?.brand || null,
        madeInUSA: instance.resolved?.originCountry === "US" || instance.resolved?.originCountry === "USA" || false,
        category: instance.resolved?.category || null,
        colors: instance.resolved?.colors || [],
        sizes: instance.resolved?.sizes || [],

        // Caller-supplied packet-specific fields (QR, graphics, layout, etc.)
        ...packetFields,

        // Timestamps always server-controlled
        createdAt: now,
        updatedAt: now,
      };

      let packetId: string;
      if (instance.currentPacketId) {
        // Update existing packet
        await db.collection(PRODUCT_PACKETS_COLLECTION)
          .doc(instance.currentPacketId)
          .update({ ...packetData, createdAt: FieldValue.delete(), updatedAt: now });
        packetId = instance.currentPacketId;
        console.log(`[AdminInstances] Updated packet ${packetId} for instance ${id}`);
      } else {
        // Create new packet
        const packetRef = await db.collection(PRODUCT_PACKETS_COLLECTION).add(packetData);
        packetId = packetRef.id;
        console.log(`[AdminInstances] Created packet ${packetId} for instance ${id}`);
      }

      // Write packet reference back onto the instance
      await instanceRef.update({
        currentPacketId: packetId,
        updatedAt: now,
      });

      res.json({ success: true, packetId, instanceId: id });
    } catch (err: any) {
      console.error("[AdminInstances] create-packet error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Push admin instance to a member → creates member library instance ────
  app.post("/api/admin/catalog-instances/:id/push-to-member", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { memberId, libraryId } = req.body;

      if (!memberId) return res.status(400).json({ error: "memberId is required" });

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const instanceDoc = await db.collection(ADMIN_INSTANCES_COLLECTION).doc(id).get();
      if (!instanceDoc.exists) return res.status(404).json({ error: "Admin instance not found" });

      const instance = instanceDoc.data()!;
      const now = FieldValue.serverTimestamp();

      // Clone the admin resolved state as the member's baseSnapshot
      // Member starts with exactly what admin configured — no more, no less
      const baseSnapshot = { ...instance.resolved };

      const memberInstance = {
        instanceType: "member",
        sourceMasterId: instance.sourceMasterId,
        sourceAdminInstanceId: id,
        ownerMemberId: memberId,
        libraryId: libraryId || null,
        baseSnapshot,
        overrides: {},
        resolved: { ...baseSnapshot },
        currentPacketId: null,
        currentTemplateId: null,
        currentGraphicSetId: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      const memberRef = await db.collection(MEMBER_INSTANCES_COLLECTION).add(memberInstance);

      console.log(`[AdminInstances] Pushed instance ${id} to member ${memberId} → member instance ${memberRef.id}`);
      res.json({
        success: true,
        memberInstanceId: memberRef.id,
        adminInstanceId: id,
        sourceMasterId: instance.sourceMasterId,
      });
    } catch (err: any) {
      console.error("[AdminInstances] push-to-member error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/admin/catalog-instances/backfill-all-images ──────────────────
  // Local-dev mirror: iterate all instances with a currentPacketId and rebuild resolved.images.
  // Must be registered BEFORE /:id routes.
  app.post("/api/admin/catalog-instances/backfill-all-images", isAdmin, async (_req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const PLACEMENT_ORDER = ["front", "front-center", "back", "left_sleeve", "right_sleeve"];
      const buildPacketImageOrder = (pkt: any): string[] => {
        const ordered: string[] = [];
        const seen = new Set<string>();
        const add = (url: string | null | undefined) => {
          if (!url || seen.has(url)) return;
          seen.add(url);
          ordered.push(url);
        };
        add(pkt.lifestyleMockupUrl);
        const placementMockupUrls: Record<string, string> = pkt.placementMockupUrls || {};
        const placementKeys = Object.keys(placementMockupUrls);
        const sortedKeys = [
          ...PLACEMENT_ORDER.filter(p => placementKeys.includes(p)),
          ...placementKeys.filter(p => !PLACEMENT_ORDER.includes(p)),
        ];
        for (const key of sortedKeys) add(placementMockupUrls[key]);
        if (sortedKeys.length === 0) add(pkt.priorityMockupUrl);
        add(pkt.compositeUrl || pkt.productGraphicUrl);
        add(pkt.landingPageSnapshotUrl);
        return ordered;
      };

      const snap = await db.collection(ADMIN_INSTANCES_COLLECTION)
        .where("currentPacketId", "!=", null)
        .limit(300)
        .get();

      let updated = 0; let skipped = 0; const errors: string[] = [];
      for (const doc of snap.docs) {
        try {
          const inst = doc.data() as any;
          const packetId = inst.currentPacketId;
          if (!packetId) { skipped++; continue; }
          const packetDoc = await db.collection("productPackets").doc(packetId).get();
          if (!packetDoc.exists) { skipped++; continue; }
          const pkt = packetDoc.data() as any;
          const images = buildPacketImageOrder(pkt);
          if (images.length === 0) { skipped++; continue; }
          const qrgId: string | null = pkt.qrgId || null;
          const update: Record<string, any> = { "resolved.images": images, updatedAt: FieldValue.serverTimestamp() };
          if (qrgId) update["resolved.qrgId"] = qrgId;
          await doc.ref.update(update);
          updated++;
        } catch (e: any) { errors.push(`${doc.id}: ${e.message}`); }
      }
      res.json({ success: true, total: snap.size, updated, skipped, ...(errors.length ? { errors } : {}) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── POST /api/admin/catalog-instances/:id/rebuild-images ───────────────────
  // Local-dev mirror: rebuild resolved.images from linked packet for a single instance.
  app.post("/api/admin/catalog-instances/:id/rebuild-images", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const PLACEMENT_ORDER = ["front", "front-center", "back", "left_sleeve", "right_sleeve"];
      const buildPacketImageOrder = (pkt: any): string[] => {
        const ordered: string[] = [];
        const seen = new Set<string>();
        const add = (url: string | null | undefined) => {
          if (!url || seen.has(url)) return;
          seen.add(url);
          ordered.push(url);
        };
        add(pkt.lifestyleMockupUrl);
        const placementMockupUrls: Record<string, string> = pkt.placementMockupUrls || {};
        const placementKeys = Object.keys(placementMockupUrls);
        const sortedKeys = [
          ...PLACEMENT_ORDER.filter(p => placementKeys.includes(p)),
          ...placementKeys.filter(p => !PLACEMENT_ORDER.includes(p)),
        ];
        for (const key of sortedKeys) add(placementMockupUrls[key]);
        if (sortedKeys.length === 0) add(pkt.priorityMockupUrl);
        add(pkt.compositeUrl || pkt.productGraphicUrl);
        add(pkt.landingPageSnapshotUrl);
        return ordered;
      };

      const instanceDoc = await db.collection(ADMIN_INSTANCES_COLLECTION).doc(id).get();
      if (!instanceDoc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
      const instance = instanceDoc.data() as any;
      if (!instance.currentPacketId) { res.status(400).json({ error: "Instance has no linked packet" }); return; }

      const packetDoc = await db.collection("productPackets").doc(instance.currentPacketId).get();
      if (!packetDoc.exists) { res.status(404).json({ error: "Packet not found" }); return; }

      const pkt = packetDoc.data() as any;
      const images = buildPacketImageOrder(pkt);
      const qrgId: string | null = pkt.qrgId || null;
      const update: Record<string, any> = { "resolved.images": images, updatedAt: FieldValue.serverTimestamp() };
      if (qrgId) update["resolved.qrgId"] = qrgId;
      await db.collection(ADMIN_INSTANCES_COLLECTION).doc(id).update(update);

      res.json({ success: true, instanceId: id, imageCount: images.length, qrgId });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
