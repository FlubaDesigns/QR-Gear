/**
 * Member Library Instances
 *
 * A member library instance is a derived editable copy of an admin catalog
 * instance. The member can customize their own copy without mutating:
 *   - the master catalog
 *   - the admin instance it came from
 *
 * Lineage is always preserved:
 *   sourceMasterId + sourceAdminInstanceId on every member instance.
 *   ownerInstanceId + sourceMasterId + sourceAdminInstanceId on every packet.
 */

import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";

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

function memberAuth(req: any, res: any, next: any) {
  if (!req.user?.uid) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export function registerMemberCatalogInstanceRoutes(app: Express): void {

  // ── List member instances (admin can see all; member sees own) ───────────
  app.get("/api/member/catalog-instances", memberAuth, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const uid = req.user.uid;
      const isAdminUser = req.user?.admin === true;

      let query: any = db.collection(MEMBER_INSTANCES_COLLECTION)
        .orderBy("createdAt", "desc");

      if (!isAdminUser) {
        query = query.where("ownerMemberId", "==", uid);
      } else if (req.query.memberId) {
        query = query.where("ownerMemberId", "==", req.query.memberId);
      }

      if (req.query.sourceAdminInstanceId) {
        query = query.where("sourceAdminInstanceId", "==", req.query.sourceAdminInstanceId);
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
      console.error("[MemberInstances] list error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get single member instance ───────────────────────────────────────────
  app.get("/api/member/catalog-instances/:id", memberAuth, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const doc = await db.collection(MEMBER_INSTANCES_COLLECTION).doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: "Instance not found" });

      const d = doc.data()!;
      const uid = req.user.uid;
      const isAdminUser = req.user?.admin === true;

      if (!isAdminUser && d.ownerMemberId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

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
      console.error("[MemberInstances] get error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Save member overrides (NEVER touches master or admin instance) ────────
  app.patch("/api/member/catalog-instances/:id", memberAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { overrides, metadata, status } = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const ref = db.collection(MEMBER_INSTANCES_COLLECTION).doc(id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Instance not found" });

      const existing = doc.data()!;
      const uid = req.user.uid;
      const isAdminUser = req.user?.admin === true;

      if (!isAdminUser && existing.ownerMemberId !== uid) {
        return res.status(403).json({ error: "Access denied" });
      }

      const mergedOverrides = { ...existing.overrides, ...overrides };
      const resolved = resolveFields(existing.baseSnapshot, mergedOverrides);

      const update: Record<string, any> = {
        overrides: mergedOverrides,
        resolved,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (metadata !== undefined) update.metadata = metadata;
      if (status !== undefined) update.status = status;

      await ref.update(update);

      console.log(`[MemberInstances] Updated instance ${id}`);
      res.json({ success: true, instanceId: id, resolved });
    } catch (err: any) {
      console.error("[MemberInstances] patch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create or update a packet from a member instance ─────────────────────
  // Packet is an attached artifact — lineage is written back onto the instance

  // ── Admin: list all member instances across all members ──────────────────
  app.get("/api/admin/member-catalog-instances", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      let query: any = db.collection(MEMBER_INSTANCES_COLLECTION).orderBy("createdAt", "desc");
      if (req.query.memberId) query = query.where("ownerMemberId", "==", req.query.memberId);
      if (req.query.sourceAdminInstanceId) query = query.where("sourceAdminInstanceId", "==", req.query.sourceAdminInstanceId);

      const snap = await query.limit(200).get();
      const instances = snap.docs.map((doc: any) => {
        const d = doc.data();
        return { id: doc.id, ...d, createdAt: d.createdAt?.toDate?.() || null, updatedAt: d.updatedAt?.toDate?.() || null };
      });

      res.json({ success: true, instances, count: instances.length });
    } catch (err: any) {
      console.error("[MemberInstances] admin-list error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}
