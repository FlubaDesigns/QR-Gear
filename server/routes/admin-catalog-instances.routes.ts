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

      let query: any = db.collection(ADMIN_INSTANCES_COLLECTION)
        .orderBy("createdAt", "desc");

      if (req.query.catalogId) {
        query = query.where("catalogId", "==", req.query.catalogId);
      }
      if (req.query.sourceMasterId) {
        query = query.where("sourceMasterId", "==", req.query.sourceMasterId);
      }

      const snap = await query.limit(200).get();
      const instances = snap.docs.map((doc: any) => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || null,
          updatedAt: d.updatedAt?.toDate?.() || null,
        };
      });

      res.json({ success: true, instances, count: instances.length });
    } catch (err: any) {
      console.error("[AdminInstances] list error:", err);
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
      const { overrides, metadata, status } = req.body;

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

      await ref.update(update);

      console.log(`[AdminInstances] Updated instance ${id} overrides:`, Object.keys(overrides || {}));
      res.json({ success: true, instanceId: id, resolved });
    } catch (err: any) {
      console.error("[AdminInstances] patch error:", err);
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
}
