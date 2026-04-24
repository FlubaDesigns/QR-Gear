/**
 * Admin Build Sessions
 *
 * Temporary working records that prevent orphan admin_catalog_instances.
 * A session is created when admin starts editing a master product.
 * A real admin_catalog_instance is only created after artifact generation succeeds (commit).
 *
 * Flow:
 *   select master product
 *   → create/load admin_build_session (temp, safe to abandon)
 *   → edit working state (title, description, QR config, graphics, etc.)
 *   → generate artifact (packet/template/graphics)
 *   → commit → creates real admin_catalog_instance, binds artifacts, marks session committed
 *
 * Permanent collections are NEVER written before commit.
 */

import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";

const BUILD_SESSIONS_COLLECTION = "admin_build_sessions";
const ADMIN_INSTANCES_COLLECTION = "admin_catalog_instances";
const MASTER_CATALOG_COLLECTION = "master_catalog";
const PRODUCT_PACKETS_COLLECTION = "productPackets";

const SESSION_EXPIRY_DAYS = 7;

function resolveFields(base: Record<string, any>, overrides: Record<string, any>): Record<string, any> {
  const resolved: Record<string, any> = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== null && val !== undefined && val !== "") {
      resolved[key] = val;
    }
  }
  return resolved;
}

export function registerAdminBuildSessionRoutes(app: Express): void {

  // ── List build sessions for admin ────────────────────────────────────────
  app.get("/api/admin/build-sessions", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      // Single equality filter only — no orderBy — avoids any composite index requirement.
      // Firestore auto-indexes single-field equality; sorting and filtering happen in code.
      const snap = await db.collection(BUILD_SESSIONS_COLLECTION)
        .where("ownerAdminId", "==", req.user?.uid || "")
        .limit(200)
        .get();

      let sessions = snap.docs.map((doc: any) => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || null,
          updatedAt: d.updatedAt?.toDate?.() || null,
          lastActiveAt: d.lastActiveAt?.toDate?.() || null,
          expiresAt: d.expiresAt?.toDate?.() || null,
        };
      });

      // In-code filters and sort
      if (req.query.status) {
        sessions = sessions.filter((s: any) => s.status === req.query.status);
      }
      if (req.query.sourceMasterId) {
        sessions = sessions.filter((s: any) => s.sourceMasterId === req.query.sourceMasterId);
      }
      // Sort descending by updatedAt in code
      sessions.sort((a: any, b: any) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
      sessions = sessions.slice(0, 50);

      res.json({ success: true, sessions, count: sessions.length });
    } catch (err: any) {
      console.error("[BuildSessions] list error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get single build session ─────────────────────────────────────────────
  app.get("/api/admin/build-sessions/:id", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const doc = await db.collection(BUILD_SESSIONS_COLLECTION).doc(req.params.id).get();
      if (!doc.exists) {
        console.error(`[BuildSessions] Session not found: ${req.params.id}`);
        return res.status(404).json({ error: "Build session not found" });
      }

      const d = doc.data()!;
      res.json({
        success: true,
        session: {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || null,
          updatedAt: d.updatedAt?.toDate?.() || null,
          lastActiveAt: d.lastActiveAt?.toDate?.() || null,
          expiresAt: d.expiresAt?.toDate?.() || null,
        },
      });
    } catch (err: any) {
      console.error("[BuildSessions] get error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create or load a build session from a master catalog item ────────────
  // If an active session already exists for this admin + master product, returns it.
  // Never creates a real admin_catalog_instance.
  app.post("/api/admin/build-sessions/from-master", isAdmin, async (req: any, res) => {
    try {
      const { sourceMasterId, catalogId, blankKey: bodyBlankKey } = req.body;

      if (!sourceMasterId) {
        return res.status(400).json({ error: "sourceMasterId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue, Timestamp } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();
      const ownerAdminId = req.user?.uid || null;

      if (!ownerAdminId) {
        return res.status(401).json({ error: "Admin UID required" });
      }

      // Check for an existing active/working session for this product + admin.
      // Filter status in-memory to avoid requiring a composite Firestore index.
      const rawSessions = await db.collection(BUILD_SESSIONS_COLLECTION)
        .where("ownerAdminId", "==", ownerAdminId)
        .where("sourceMasterId", "==", sourceMasterId)
        .get();

      const activeDocs = rawSessions.docs
        .filter(d => ["working", "artifact_ready"].includes(d.data().status))
        .sort((a, b) => {
          const aTime = a.data().updatedAt?.toMillis?.() || 0;
          const bTime = b.data().updatedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      const existing = { empty: activeDocs.length === 0, docs: activeDocs };

      if (!existing.empty) {
        const doc = existing.docs[0];
        const d = doc.data();

        // Touch lastActiveAt and back-fill blankKey/catalogId if the session predates those fields
        const existingPatch: Record<string, any> = { lastActiveAt: FieldValue.serverTimestamp() };
        if (bodyBlankKey && !d.blankKey) existingPatch.blankKey = bodyBlankKey;
        if (catalogId && !d.catalogId) existingPatch.catalogId = catalogId;
        await doc.ref.update(existingPatch);

        console.log(`[BuildSessions] Returning existing session ${doc.id} for master ${sourceMasterId}`);
        return res.json({
          success: true,
          sessionId: doc.id,
          isExisting: true,
          session: {
            id: doc.id,
            ...d,
            blankKey: d.blankKey || bodyBlankKey || null,
            catalogId: d.catalogId || catalogId || null,
            createdAt: d.createdAt?.toDate?.() || null,
            updatedAt: d.updatedAt?.toDate?.() || null,
          },
        });
      }

      // Fetch master catalog item to seed working defaults.
      // sourceMasterId may be a Firestore doc ID (preferred) or a legacy numeric blueprint ID string.
      let masterDoc = await db.collection(MASTER_CATALOG_COLLECTION).doc(sourceMasterId).get();
      if (!masterDoc.exists) {
        // Fallback: try querying by printifyBlueprintId (legacy numeric ID sent by old clients)
        const numericId = Number(sourceMasterId);
        if (!isNaN(numericId)) {
          const qSnap = await db.collection(MASTER_CATALOG_COLLECTION)
            .where("printifyBlueprintId", "==", numericId)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            masterDoc = qSnap.docs[0] as any;
            console.log(`[BuildSessions] Resolved blueprint ${numericId} → doc ${masterDoc.id}`);
          }
        }
      }
      if (!masterDoc.exists) {
        console.error(`[BuildSessions] Master catalog item not found: ${sourceMasterId}`);
        return res.status(404).json({ error: `Master catalog item not found: ${sourceMasterId}` });
      }
      const master = masterDoc.data()!;

      const now = FieldValue.serverTimestamp();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      );

      const sessionData = {
        sessionType: "admin_build",
        sourceMasterId,
        ownerAdminId,
        catalogId: catalogId || null,
        blankKey: bodyBlankKey || null,

        // Working state seeded from master — admin edits diverge from here
        working: {
          title: master.title || null,
          description: master.description || null,
          images: master.images || [],
          pricing: null,
          graphics: null,
          qrConfig: null,
          layoutConfig: null,
          zones: null,
          metadata: null,
        },

        // Artifact refs — only populated after generate-artifact
        generated: {
          packetId: null,
          templateId: null,
          graphicSetId: null,
          artifactReady: false,
        },

        status: "working",
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        expiresAt,
        committedInstanceId: null,
      };

      const ref = await db.collection(BUILD_SESSIONS_COLLECTION).add(sessionData);

      console.log(`[BuildSessions] Created session ${ref.id} from master ${sourceMasterId} for admin ${ownerAdminId}`);
      res.json({
        success: true,
        sessionId: ref.id,
        isExisting: false,
        session: { id: ref.id, ...sessionData, createdAt: null, updatedAt: null },
      });
    } catch (err: any) {
      console.error("[BuildSessions] from-master error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Update working state / draftName — no permanent instance created ──────
  app.patch("/api/admin/build-sessions/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { working, draftName } = req.body;

      if (!working && draftName === undefined) {
        return res.status(400).json({ error: "working object or draftName is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        console.error(`[BuildSessions] Patch — session not found: ${id}`);
        return res.status(404).json({ error: "Build session not found" });
      }

      const existing = doc.data()!;

      // draftName is a display-only label — allow it on any session status.
      // Only block working-state writes on sessions that are already finalized.
      const isDraftNameOnly = draftName !== undefined && !working;
      if (!isDraftNameOnly && (existing.status === "committed" || existing.status === "abandoned")) {
        return res.status(409).json({
          error: `Cannot update a ${existing.status} session. Start a new session instead.`,
        });
      }

      const updatePayload: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
      };

      if (working && typeof working === "object") {
        updatePayload.working = { ...existing.working, ...working };
      }

      if (draftName !== undefined) {
        updatePayload.draftName = draftName;
      }

      await ref.update(updatePayload);

      console.log(`[BuildSessions] Updated session ${id}:`, Object.keys(updatePayload));
      res.json({ success: true, sessionId: id });
    } catch (err: any) {
      console.error("[BuildSessions] patch error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Generate artifact — saves packet/template refs, gates commit ─────────
  // Caller supplies packet fields built from working state.
  // Sets generated.artifactReady = true and status = 'artifact_ready'.
  app.post("/api/admin/build-sessions/:id/generate-artifact", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const packetFields = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        console.error(`[BuildSessions] GenerateArtifact — session not found: ${id}`);
        return res.status(404).json({ error: "Build session not found" });
      }

      const session = doc.data()!;

      if (session.status === "committed") {
        return res.status(409).json({ error: "Session already committed. Regenerate from the committed instance." });
      }
      if (session.status === "abandoned") {
        return res.status(409).json({ error: "Cannot generate artifact for an abandoned session." });
      }

      const now = FieldValue.serverTimestamp();

      let packetId: string;

      if (packetFields.existingPacketId) {
        // Caller already created the packet via POST /api/packets — just link it to this session
        packetId = packetFields.existingPacketId;
        await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).update({
          ownerType: "admin_build_session",
          buildSessionId: id,
          sourceMasterId: session.sourceMasterId,
          sourceAdminInstanceId: null,
          updatedAt: now,
        });
        console.log(`[BuildSessions] Linked existing packet ${packetId} to session ${id}`);
      } else {
        // Build packet data from session working state + caller-supplied fields
        const packetData = {
          ownerType: "admin_build_session",
          buildSessionId: id,
          sourceMasterId: session.sourceMasterId,
          sourceAdminInstanceId: null, // not committed yet

          masterTitle: session.working?.title || null,
          adminCatalogTitle: session.working?.title || null,
          effectiveTitle: session.working?.title || null,
          masterDescription: session.working?.description || null,
          adminCatalogDescription: session.working?.description || null,
          effectiveDescription: session.working?.description || null,
          productImageUrl: session.working?.images?.[0] || null,

          // Caller-supplied fields (QR config, graphics, layout, etc.)
          ...packetFields,

          createdAt: now,
          updatedAt: now,
        };

        if (session.generated?.packetId) {
          // Regenerate — update existing packet
          await db.collection(PRODUCT_PACKETS_COLLECTION)
            .doc(session.generated.packetId)
            .update({ ...packetData, createdAt: FieldValue.delete(), updatedAt: now });
          packetId = session.generated.packetId;
          console.log(`[BuildSessions] Regenerated packet ${packetId} for session ${id}`);
        } else {
          const packetRef = await db.collection(PRODUCT_PACKETS_COLLECTION).add(packetData);
          packetId = packetRef.id;
          console.log(`[BuildSessions] Created packet ${packetId} for session ${id}`);
        }
      }

      // Update session with generated refs and flip to artifact_ready
      await ref.update({
        "generated.packetId": packetId,
        "generated.artifactReady": true,
        status: "artifact_ready",
        updatedAt: now,
        lastActiveAt: now,
      });

      res.json({ success: true, sessionId: id, packetId, artifactReady: true });
    } catch (err: any) {
      console.error("[BuildSessions] generate-artifact error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Commit — creates real admin_catalog_instance from session ────────────
  // Only allowed when generated.artifactReady = true.
  // After commit the session is marked committed and the UI switches to the instance.
  app.post("/api/admin/build-sessions/:id/commit", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { catalogId, pricing: bodyPricing } = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        console.error(`[BuildSessions] Commit — session not found: ${id}`);
        return res.status(404).json({ error: "Build session not found" });
      }

      const session = doc.data()!;

      if (session.status === "committed") {
        return res.json({
          success: true,
          alreadyCommitted: true,
          instanceId: session.committedInstanceId,
          sessionId: id,
        });
      }

      if (session.status === "abandoned") {
        return res.status(409).json({ error: "Cannot commit an abandoned session." });
      }

      if (!session.generated?.artifactReady) {
        return res.status(422).json({
          error: "Artifact must be generated before committing. Call generate-artifact first.",
        });
      }

      const masterDoc = await db.collection(MASTER_CATALOG_COLLECTION).doc(session.sourceMasterId).get();
      if (!masterDoc.exists) {
        console.error(`[BuildSessions] Commit — master not found: ${session.sourceMasterId}`);
        return res.status(404).json({ error: `Master catalog item not found: ${session.sourceMasterId}` });
      }
      const master = masterDoc.data()!;

      const now = FieldValue.serverTimestamp();
      const effectiveCatalogId = catalogId || session.catalogId || null;

      // ── Resolve curated title, description, and image list from catalog overrides ──
      // Priority: catalog blankTitles/blankDescriptions/blankImages > master catalog
      let curatedTitle: string = master.title || "";
      let curatedDescription: string | null = master.description || null;
      let curatedImages: string[] = master.images || [];
      if (effectiveCatalogId) {
        try {
          const catDoc = await db.collection("catalogs").doc(effectiveCatalogId).get();
          if (catDoc.exists) {
            const catData = catDoc.data() as any;
            const blankTitles = catData.blankTitles || {};
            const blankDescriptions = catData.blankDescriptions || {};
            const blankImages = catData.blankImages || {};
            // blankKey is the correct lookup key (e.g. "pf:71" or "36").
            // sourceMasterId is the Firestore doc ID — wrong key for blankImages.
            const lookupKey = session.blankKey || session.sourceMasterId;
            if (blankTitles[lookupKey]) curatedTitle = blankTitles[lookupKey];
            if (blankDescriptions[lookupKey]) curatedDescription = blankDescriptions[lookupKey];
            const trimmed: string[] = blankImages[lookupKey] || [];
            if (trimmed.length > 0) curatedImages = trimmed;
          }
        } catch (_) { /* fall back to master values */ }
      }

      // ── Fetch packet for priorityMockupUrl + admin-curated enabledColors/enabledSizes ──
      const packetId = session.generated?.packetId || null;
      let mockupUrl: string | null = null;
      let packetEnabledColors: string[] | null = null;
      let packetEnabledSizes: string[] | null = null;
      if (packetId) {
        try {
          const packetDoc = await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
          if (packetDoc.exists) {
            const pkt = packetDoc.data() as any;
            mockupUrl = pkt.priorityMockupUrl || null;
            const rawColors = pkt.colors || pkt.enabledColors || [];
            const rawSizes = pkt.sizes || pkt.enabledSizes || [];
            const normalizedColors = rawColors
              .map((c: any) => (typeof c === "string" ? c : c?.name || c?.label || null))
              .filter(Boolean) as string[];
            const normalizedSizes = rawSizes
              .filter((s: any) => typeof s === "string" && s.length > 0) as string[];
            if (normalizedColors.length > 0) packetEnabledColors = normalizedColors;
            if (normalizedSizes.length > 0) packetEnabledSizes = normalizedSizes;
          }
        } catch (_) { /* no mockup */ }
      }
      const finalImages = mockupUrl ? [mockupUrl, ...curatedImages] : curatedImages;
      // ────────────────────────────────────────────────────────────────────────────

      const baseSnapshot = {
        title: curatedTitle,
        description: curatedDescription,
        images: finalImages,
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

      const overrides: Record<string, any> = {};
      const w = session.working || {};
      if (w.title && w.title !== master.title) overrides.title = w.title;
      if (w.description && w.description !== master.description) overrides.description = w.description;
      // When a catalog is active, curatedImages is the authority — do NOT stomp with working.images
      if (!effectiveCatalogId && w.images?.length) overrides.images = w.images;
      const effectivePricing = bodyPricing || w.pricing || null;
      if (effectivePricing) overrides.pricing = effectivePricing;
      if (w.metadata) overrides.metadata = w.metadata;

      const resolved = resolveFields(baseSnapshot, overrides);

      const meta = w.metadata || {};
      const selectedStore = meta.selectedStore || null;
      const selectedChannel = meta.selectedChannel || null;
      const selectedCollection = meta.selectedCollection || null;
      const folderPath = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name]
        .filter(Boolean).join(" / ") || null;

      const instanceRef = await db.collection(ADMIN_INSTANCES_COLLECTION).add({
        instanceType: "admin",
        sourceMasterId: session.sourceMasterId,
        sourceSessionId: id,
        catalogId: effectiveCatalogId,
        ownerAdminId: session.ownerAdminId,
        baseSnapshot,
        overrides,
        resolved,
        enabledColors: packetEnabledColors,
        enabledSizes: packetEnabledSizes,
        currentPacketId: packetId,
        currentTemplateId: session.generated?.templateId || null,
        currentGraphicSetId: session.generated?.graphicSetId || null,
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || null,
        channelId: selectedChannel?.id || null,
        channelName: selectedChannel?.name || null,
        collectionId: selectedCollection?.id || null,
        collectionName: selectedCollection?.name || null,
        folderPath,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      const instanceId = instanceRef.id;

      if (packetId) {
        await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).update({
          ownerType: "admin",
          ownerInstanceId: instanceId,
          sourceAdminInstanceId: instanceId,
          updatedAt: now,
        });
      }

      await ref.update({
        status: "committed",
        committedInstanceId: instanceId,
        updatedAt: now,
      });

      console.log(`[BuildSessions] Committed session ${id} → admin instance ${instanceId} (master: ${session.sourceMasterId})`);
      res.json({
        success: true,
        sessionId: id,
        instanceId,
        sourceMasterId: session.sourceMasterId,
        packetId,
      });
    } catch (err: any) {
      console.error("[BuildSessions] commit error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Abandon a session ────────────────────────────────────────────────────
  app.post("/api/admin/build-sessions/:id/abandon", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Build session not found" });
      }

      const session = doc.data()!;
      if (session.status === "committed") {
        return res.status(409).json({ error: "Cannot abandon a committed session." });
      }

      await ref.update({
        status: "abandoned",
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[BuildSessions] Abandoned session ${id}`);
      res.json({ success: true, sessionId: id });
    } catch (err: any) {
      console.error("[BuildSessions] abandon error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cleanup stale sessions (admin-triggered, safe to run anytime) ────────
  app.post("/api/admin/build-sessions/cleanup", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { Timestamp } = await import("firebase-admin/firestore");
      const db = getFirestoreDb();

      const cutoff = Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000));

      const stale = await db.collection(BUILD_SESSIONS_COLLECTION)
        .where("status", "in", ["working", "artifact_ready"])
        .where("lastActiveAt", "<", cutoff)
        .limit(100)
        .get();

      const batch = db.batch();
      stale.docs.forEach((doc: any) => {
        batch.update(doc.ref, { status: "abandoned" });
      });
      await batch.commit();

      console.log(`[BuildSessions] Cleanup marked ${stale.size} stale sessions as abandoned`);
      res.json({ success: true, cleaned: stale.size });
    } catch (err: any) {
      console.error("[BuildSessions] cleanup error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
}
