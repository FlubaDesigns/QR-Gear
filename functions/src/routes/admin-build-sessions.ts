/**
 * Admin Build Sessions (Cloud Functions port)
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
 */

import express, { Request, Response } from 'express';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db, storage } from '../core';
import { requireAdmin } from '../middleware';
import { cfGeneratePrintifyComposite, cfUploadBufferToStorage } from '../services/composite-image';

const BUILD_SESSIONS_COLLECTION = 'admin_build_sessions';
const ADMIN_INSTANCES_COLLECTION = 'admin_catalog_instances';
const MASTER_CATALOG_COLLECTION = 'master_catalog';
const PRODUCT_PACKETS_COLLECTION = 'productPackets';
const QRG_COUNTERS_COLLECTION = 'qrg_counters';

const SESSION_EXPIRY_DAYS = 7;

function resolveFields(base: Record<string, any>, overrides: Record<string, any>): Record<string, any> {
  const resolved: Record<string, any> = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== null && val !== undefined && val !== '') {
      resolved[key] = val;
    }
  }
  return resolved;
}

export function registerAdminBuildSessions(app: express.Express): void {

  // ── List build sessions for admin ─────────────────────────────────────────
  app.get('/admin/build-sessions', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const uid = (req as any).user?.uid || '';
      // Single equality filter only — no orderBy — avoids any composite index requirement.
      // Firestore auto-indexes single-field equality; sorting and filtering happen in code.
      const snap = await db.collection(BUILD_SESSIONS_COLLECTION)
        .where('ownerAdminId', '==', uid)
        .limit(200)
        .get();

      let sessions: any[] = snap.docs.map((doc: any) => {
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
      const statusFilter = (req.query as any).status;
      const masterFilter = (req.query as any).sourceMasterId;
      if (statusFilter) sessions = sessions.filter((s) => s.status === statusFilter);
      if (masterFilter) sessions = sessions.filter((s) => s.sourceMasterId === masterFilter);
      sessions.sort((a: any, b: any) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
      sessions = sessions.slice(0, 50);

      res.json({ success: true, sessions, count: sessions.length });
    } catch (err: any) {
      console.error('[BuildSessions] list error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Get single build session ──────────────────────────────────────────────
  app.get('/admin/build-sessions/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const doc = await db.collection(BUILD_SESSIONS_COLLECTION).doc(req.params.id).get();
      if (!doc.exists) {
        res.status(404).json({ error: 'Build session not found' });
        return;
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
      console.error('[BuildSessions] get error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Create or load a build session from a master catalog item ─────────────
  app.post('/admin/build-sessions/from-master', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { sourceMasterId, catalogId, blankKey: bodyBlankKey } = req.body;

      if (!sourceMasterId) {
        res.status(400).json({ error: 'sourceMasterId is required' });
        return;
      }

      const ownerAdminId = (req as any).user?.uid || null;
      if (!ownerAdminId) {
        res.status(401).json({ error: 'Admin UID required' });
        return;
      }

      // Filter status in-memory to avoid requiring a composite Firestore index.
      const rawSessions = await db.collection(BUILD_SESSIONS_COLLECTION)
        .where('ownerAdminId', '==', ownerAdminId)
        .where('sourceMasterId', '==', sourceMasterId)
        .get();

      const activeDocs = rawSessions.docs
        .filter((d: any) => ['working', 'artifact_ready'].includes(d.data().status))
        .sort((a: any, b: any) => {
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
        res.json({
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
        return;
      }

      // sourceMasterId may be a Firestore doc ID (preferred) or a legacy numeric blueprint ID string.
      let masterDoc = await db.collection(MASTER_CATALOG_COLLECTION).doc(sourceMasterId).get();
      if (!masterDoc.exists) {
        // Fallback: try querying by printifyBlueprintId (legacy numeric ID sent by old clients)
        const numericId = Number(sourceMasterId);
        if (!isNaN(numericId)) {
          const qSnap = await db.collection(MASTER_CATALOG_COLLECTION)
            .where('printifyBlueprintId', '==', numericId)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            masterDoc = qSnap.docs[0] as any;
            console.log(`[BuildSessions] Resolved blueprint ${numericId} → doc ${masterDoc.id}`);
          }
        }
      }
      if (!masterDoc.exists) {
        res.status(404).json({ error: `Master catalog item not found: ${sourceMasterId}` });
        return;
      }
      const master = masterDoc.data()!;

      const now = FieldValue.serverTimestamp();
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      );

      const sessionData = {
        sessionType: 'admin_build',
        sourceMasterId,
        ownerAdminId,
        catalogId: catalogId || null,
        blankKey: bodyBlankKey || null,
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
        generated: {
          packetId: null,
          templateId: null,
          graphicSetId: null,
          artifactReady: false,
        },
        status: 'working',
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        expiresAt,
        committedInstanceId: null,
      };

      const ref = await db.collection(BUILD_SESSIONS_COLLECTION).add(sessionData);
      res.json({
        success: true,
        sessionId: ref.id,
        isExisting: false,
        session: { id: ref.id, ...sessionData, createdAt: null, updatedAt: null },
      });
    } catch (err: any) {
      console.error('[BuildSessions] from-master error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Clone a session into a fresh working draft ────────────────────────────
  app.post('/admin/build-sessions/clone', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { sourceSessionId } = req.body;
      if (!sourceSessionId) { res.status(400).json({ error: 'sourceSessionId is required' }); return; }

      const uid = (req as any).user?.uid || null;
      const sourceDoc = await db.collection(BUILD_SESSIONS_COLLECTION).doc(sourceSessionId).get();
      if (!sourceDoc.exists) { res.status(404).json({ error: 'Source session not found' }); return; }

      const source = sourceDoc.data()!;
      const now = FieldValue.serverTimestamp();
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000));

      const newSession = {
        sessionType: 'admin_build',
        sourceMasterId: source.sourceMasterId,
        catalogId: source.catalogId || null,
        ownerAdminId: uid,
        working: source.working || {},
        draftName: source.draftName ? `${source.draftName} (copy)` : null,
        generated: { packetId: null, templateId: null, graphicSetId: null, artifactReady: false },
        status: 'working',
        clonedFromSessionId: sourceSessionId,
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        expiresAt,
        committedInstanceId: null,
      };

      const ref = await db.collection(BUILD_SESSIONS_COLLECTION).add(newSession);
      console.log(`[BuildSessions] Cloned ${sourceSessionId} → ${ref.id}`);
      res.json({ success: true, sessionId: ref.id, clonedFrom: sourceSessionId });
    } catch (err: any) {
      console.error('[BuildSessions] clone error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Update working state / draftName ──────────────────────────────────────
  app.patch('/admin/build-sessions/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { working, draftName } = req.body;

      if (!working && draftName === undefined) {
        res.status(400).json({ error: 'working object or draftName is required' });
        return;
      }

      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Build session not found' });
        return;
      }

      const existing = doc.data()!;

      // draftName is a display-only label — allow it on any session status.
      // Only block working-state writes on sessions that are already finalized.
      const isDraftNameOnly = draftName !== undefined && !working;
      if (!isDraftNameOnly && (existing.status === 'committed' || existing.status === 'abandoned')) {
        res.status(409).json({
          error: `Cannot update a ${existing.status} session. Start a new session instead.`,
        });
        return;
      }

      const updatePayload: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
      };

      if (working && typeof working === 'object') {
        updatePayload.working = { ...existing.working, ...working };
      }

      if (draftName !== undefined) {
        updatePayload.draftName = draftName;
      }

      await ref.update(updatePayload);
      res.json({ success: true, sessionId: id });
    } catch (err: any) {
      console.error('[BuildSessions] patch error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Generate artifact ─────────────────────────────────────────────────────
  app.post('/admin/build-sessions/:id/generate-artifact', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const packetFields = req.body;

      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Build session not found' });
        return;
      }

      const session = doc.data()!;

      if (session.status === 'committed') {
        res.status(409).json({ error: 'Session already committed.' });
        return;
      }
      if (session.status === 'abandoned') {
        res.status(409).json({ error: 'Cannot generate artifact for an abandoned session.' });
        return;
      }

      const now = FieldValue.serverTimestamp();
      let packetId: string;

      if (packetFields.existingPacketId) {
        packetId = packetFields.existingPacketId;
        await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).update({
          ownerType: 'admin_build_session',
          buildSessionId: id,
          sourceMasterId: session.sourceMasterId,
          sourceAdminInstanceId: null,
          updatedAt: now,
        });
      } else {
        const packetData = {
          ownerType: 'admin_build_session',
          buildSessionId: id,
          sourceMasterId: session.sourceMasterId,
          sourceAdminInstanceId: null,
          masterTitle: session.working?.title || null,
          adminCatalogTitle: session.working?.title || null,
          effectiveTitle: session.working?.title || null,
          masterDescription: session.working?.description || null,
          adminCatalogDescription: session.working?.description || null,
          effectiveDescription: session.working?.description || null,
          productImageUrl: session.working?.images?.[0] || null,
          ...packetFields,
          createdAt: now,
          updatedAt: now,
        };

        if (session.generated?.packetId) {
          const { createdAt: _c, ...updateFields } = packetData as any;
          await db.collection(PRODUCT_PACKETS_COLLECTION)
            .doc(session.generated.packetId)
            .update({ ...updateFields, updatedAt: now });
          packetId = session.generated.packetId;
        } else {
          const packetRef = await db.collection(PRODUCT_PACKETS_COLLECTION).add(packetData);
          packetId = packetRef.id;
        }
      }

      const sessionUpdate: Record<string, any> = {
        'generated.packetId': packetId,
        'generated.artifactReady': true,
        status: 'artifact_ready',
        updatedAt: now,
        lastActiveAt: now,
      };
      if (packetFields.previewImageUrl) {
        sessionUpdate['generated.previewImageUrl'] = packetFields.previewImageUrl;
      }
      await ref.update(sessionUpdate);

      res.json({ success: true, sessionId: id, packetId, artifactReady: true });
    } catch (err: any) {
      console.error('[BuildSessions] generate-artifact error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Commit — creates real admin_catalog_instance ──────────────────────────
  app.post('/admin/build-sessions/:id/commit', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { catalogId, pricing: bodyPricing } = req.body;

      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Build session not found' });
        return;
      }

      const session = doc.data()!;

      if (session.status === 'committed') {
        res.json({
          success: true,
          alreadyCommitted: true,
          instanceId: session.committedInstanceId,
          sessionId: id,
        });
        return;
      }

      if (session.status === 'abandoned') {
        res.status(409).json({ error: 'Cannot commit an abandoned session.' });
        return;
      }

      if (!session.generated?.artifactReady) {
        res.status(422).json({
          error: 'Artifact must be generated before committing. Call generate-artifact first.',
        });
        return;
      }

      const masterDoc = await db.collection(MASTER_CATALOG_COLLECTION).doc(session.sourceMasterId).get();
      if (!masterDoc.exists) {
        res.status(404).json({ error: `Master catalog item not found: ${session.sourceMasterId}` });
        return;
      }
      const master = masterDoc.data()!;

      const now = FieldValue.serverTimestamp();
      const effectiveCatalogId = catalogId || session.catalogId || null;

      // --- Resolve curated title, description, and image list from catalog overrides ---
      // Priority: catalog blankTitles/blankDescriptions/blankImages > master catalog
      let curatedTitle: string = master.title || '';
      let curatedDescription: string | null = master.description || null;
      let curatedImages: string[] = master.images || [];
      if (effectiveCatalogId) {
        try {
          const catDoc = await db.collection('catalogs').doc(effectiveCatalogId).get();
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

      // Capture the admin-curated colors/sizes from the packet for enabledColors/enabledSizes.
      // NOTE: mockup URL is intentionally NOT baked into resolved.images — the gallery reads it
      // dynamically from pkt.priorityMockupUrl at request time and appends it after catalog images.
      const packetId = session.generated?.packetId || null;
      let packetEnabledColors: string[] | null = null;
      let packetEnabledSizes: string[] | null = null;
      if (packetId) {
        try {
          const packetDoc = await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
          if (packetDoc.exists) {
            const pkt = packetDoc.data() as any;
            const rawColors = pkt.colors || pkt.enabledColors || [];
            const rawSizes = pkt.sizes || pkt.enabledSizes || [];
            const normalizedColors = rawColors
              .map((c: any) => (typeof c === 'string' ? c : c?.name || c?.label || null))
              .filter(Boolean) as string[];
            const normalizedSizes = rawSizes
              .filter((s: any) => typeof s === 'string' && s.length > 0) as string[];
            if (normalizedColors.length > 0) packetEnabledColors = normalizedColors;
            if (normalizedSizes.length > 0) packetEnabledSizes = normalizedSizes;
          }
        } catch (_) { /* no packet */ }
      }
      // resolved.images = only the admin-curated catalog images (mockup appended by gallery at read time)
      const finalImages = curatedImages;
      // ----------------------------------------

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
      // When a catalog is active, curatedImages (embedded in finalImages / baseSnapshot) is the
      // authority for images — do NOT let working.images blindly stomp it.
      // working.images starts from master.images and will restore deleted images if applied.
      if (!effectiveCatalogId && w.images?.length) overrides.images = w.images;
      const effectivePricing = bodyPricing || w.pricing || null;
      if (effectivePricing) overrides.pricing = effectivePricing;
      if (w.metadata) overrides.metadata = w.metadata;

      const resolved = resolveFields(baseSnapshot, overrides);

      const newPacketId = session.generated?.packetId || null;

      const meta = w.metadata || {};
      const selectedStore = meta.selectedStore || null;
      const selectedChannel = meta.selectedChannel || null;
      const selectedCollection = meta.selectedCollection || null;
      const folderPath = [selectedStore?.name, selectedChannel?.name, selectedCollection?.name]
        .filter(Boolean).join(' / ') || null;

      // ── Always CREATE a new instance — every commit is a new catalog entry ──
      const instanceRef = await db.collection(ADMIN_INSTANCES_COLLECTION).add({
        instanceType: 'admin', sourceMasterId: session.sourceMasterId, sourceSessionId: id,
        catalogId: effectiveCatalogId, ownerAdminId: session.ownerAdminId,
        baseSnapshot, overrides, resolved,
        // Admin-curated selections from the builder — overrides full provider catalog at storefront
        enabledColors: packetEnabledColors,
        enabledSizes: packetEnabledSizes,
        currentPacketId: newPacketId, currentTemplateId: session.generated?.templateId || null,
        currentGraphicSetId: session.generated?.graphicSetId || null,
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || null,
        channelId: selectedChannel?.id || null,
        channelName: selectedChannel?.name || null,
        collectionId: selectedCollection?.id || null,
        collectionName: selectedCollection?.name || null,
        folderPath,
        status: 'draft', createdAt: now, updatedAt: now,
      });
      const instanceId = instanceRef.id;
      console.log(`[BuildSessions] Created new instance ${instanceId} from session ${id}`);

      if (newPacketId) {
        await db.collection(PRODUCT_PACKETS_COLLECTION).doc(newPacketId).update({
          ownerType: 'admin',
          ownerInstanceId: instanceId,
          sourceAdminInstanceId: instanceId,
          updatedAt: now,
        });
      }

      await ref.update({
        status: 'committed',
        committedInstanceId: instanceId,
        updatedAt: now,
      });

      res.json({
        success: true,
        sessionId: id,
        instanceId,
        sourceMasterId: session.sourceMasterId,
        packetId: newPacketId,
      });
    } catch (err: any) {
      console.error('[BuildSessions] commit error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Abandon a session ─────────────────────────────────────────────────────
  app.post('/admin/build-sessions/:id/abandon', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Build session not found' });
        return;
      }

      const session = doc.data()!;
      if (session.status === 'committed') {
        res.status(409).json({ error: 'Cannot abandon a committed session.' });
        return;
      }

      await ref.update({
        status: 'abandoned',
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.json({ success: true, sessionId: id });
    } catch (err: any) {
      console.error('[BuildSessions] abandon error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Reopen a committed session for editing ────────────────────────────────
  app.post('/admin/build-sessions/:id/reopen', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();
      if (!doc.exists) { res.status(404).json({ error: 'Session not found' }); return; }
      const session = doc.data()!;

      if (session.status !== 'committed') {
        res.json({ success: true, sessionId: id, status: session.status, committedInstanceId: session.committedInstanceId || null, alreadyOpen: true });
        return;
      }

      await ref.update({
        status: 'working',
        updatedAt: FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
      });

      console.log(`[BuildSessions] Reopened session ${id} (committed → working, keeps instanceId: ${session.committedInstanceId})`);
      res.json({ success: true, sessionId: id, status: 'working', committedInstanceId: session.committedInstanceId || null });
    } catch (err: any) {
      console.error('[BuildSessions] reopen error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Permanently delete a build session ───────────────────────────────────
  app.delete('/admin/build-sessions/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const ref = db.collection(BUILD_SESSIONS_COLLECTION).doc(id);
      const doc = await ref.get();

      if (!doc.exists) {
        res.status(404).json({ error: 'Build session not found' });
        return;
      }

      await ref.delete();
      console.log(`[BuildSessions] Deleted session ${id}`);
      res.json({ success: true, sessionId: id });
    } catch (err: any) {
      console.error('[BuildSessions] delete error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Cleanup stale sessions ────────────────────────────────────────────────
  app.post('/admin/build-sessions/cleanup', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
      const cutoff = Timestamp.fromDate(
        new Date(Date.now() - SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      );

      const stale = await db.collection(BUILD_SESSIONS_COLLECTION)
        .where('status', 'in', ['working', 'artifact_ready'])
        .where('lastActiveAt', '<', cutoff)
        .limit(100)
        .get();

      const batch = db.batch();
      stale.docs.forEach((doc: any) => {
        batch.update(doc.ref, { status: 'abandoned' });
      });
      await batch.commit();

      res.json({ success: true, cleaned: stale.size });
    } catch (err: any) {
      console.error('[BuildSessions] cleanup error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── QRG Composite Regeneration ────────────────────────────────────────────
  app.post('/admin/qrg/regenerate-composite/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { packetId } = req.params;
      const packetRef = db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId);
      const packetDoc = await packetRef.get();
      if (!packetDoc.exists) { res.status(404).json({ error: 'Packet not found' }); return; }

      const packet = packetDoc.data()!;
      const qrContent: string = packet.qrContent;
      if (!qrContent) { res.status(400).json({ error: 'Packet has no qrContent' }); return; }

      const STORAGE_BUCKET = 'qrgear-c1ffd.firebasestorage.app';
      const folder = `content/canvas/admin/${packetId}`;

      const resolveImageUrl = (url: string): string => {
        if (!url) return url;
        if (url.startsWith('/api/library-files/')) {
          const filename = url.replace('/api/library-files/', '');
          return `https://storage.googleapis.com/${STORAGE_BUCKET}/library-files/${filename}`;
        }
        return url;
      };

      const hs = packet.headerStyle;
      const fs = packet.footerStyle;
      const graphicLayoutMode = packet.graphicLayoutMode || 'zone';
      const qrSizePercent = packet.qrSizePercent ?? 75;

      const topText = hs?.enabled ? (
        hs.mode === 'image' && hs.imageUrl
          ? { text: '', fontFamily: 'Arial', fontSize: '14', mode: 'image' as const, imageUrl: resolveImageUrl(hs.imageUrl), imageScale: hs.imageScale ?? 100, horizontalOffset: hs.horizontalOffset ?? 50, verticalOffset: hs.verticalOffset ?? 50 }
          : hs.text ? { text: hs.text, fontFamily: hs.fontFamily || 'Arial', fontSize: hs.fontSize || '14', color: hs.color || '#000000', strokeColor: hs.strokeColor || '', strokeWidth: hs.strokeWidth || 0 } : null
      ) : null;

      const bottomText = fs?.enabled && fs.text ? {
        text: fs.text,
        fontFamily: fs.fontFamily || 'Arial',
        fontSize: fs.fontSize || '14',
        color: fs.color || '#000000',
        strokeColor: fs.strokeColor || '',
        strokeWidth: fs.strokeWidth || 0,
      } : null;

      // ── 1. Front composite (with header/footer) ───────────────────────────
      const frontPlacement = (packet.placements?.[0]) || 'front';
      const frontDataUrl = await cfGeneratePrintifyComposite(
        qrContent, topText, bottomText,
        1200, 1800, 'black', frontPlacement, graphicLayoutMode, qrSizePercent
      );
      const frontBuf = Buffer.from(frontDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
      const { publicUrl: compositeUrl } = await cfUploadBufferToStorage(frontBuf, 'image/png', folder);

      // ── 2. Sleeve composites (QR code only — no header/footer) ───────────
      const SLEEVE_PLACEMENTS = ['left_sleeve', 'right_sleeve'];
      const packetPlacements: string[] = packet.placements || [];
      const sleevePlacements = packetPlacements.filter((p: string) => SLEEVE_PLACEMENTS.includes(p));

      const sleeveUrls: Record<string, string> = {};
      for (const slv of sleevePlacements) {
        const slvDataUrl = await cfGeneratePrintifyComposite(
          qrContent, null, null,
          1200, 1500, 'black', slv, 'zone', 90
        );
        const slvBuf = Buffer.from(slvDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
        const { publicUrl } = await cfUploadBufferToStorage(slvBuf, 'image/png', folder);
        sleeveUrls[slv] = publicUrl;
      }
      const sleeveCompositeUrl = sleeveUrls['left_sleeve'] || sleeveUrls['right_sleeve'] || null;

      // ── 3. QR-only external URL ───────────────────────────────────────────
      const encodeUri = (s: string) => encodeURIComponent(s);
      const qrOnlyUrl = `https://api.qrserver.com/v1/create-qr-code/?size=3000x3000&data=${encodeUri(qrContent)}&format=png&qzone=0&ecc=H&color=000000&bgcolor=ffffff`;

      // ── 4. Save composites to packet ──────────────────────────────────────
      const packetUpdate: Record<string, any> = { compositeUrl, qrOnlyUrl, updatedAt: FieldValue.serverTimestamp() };
      if (sleeveCompositeUrl) packetUpdate.sleeveCompositeUrl = sleeveCompositeUrl;
      await packetRef.update(packetUpdate);

      // ── 5. Build resolved.images for catalog instance ─────────────────────
      // Order: front composite, sleeve composite(s), priority mockup, qr-only URL
      // Drop all stock images (images.printify.com) when we have ≥3 real images
      const priorityMockupUrl: string | null = packet.priorityMockupUrl || null;
      const realImages: string[] = [compositeUrl];
      for (const slv of sleevePlacements) { if (sleeveUrls[slv]) realImages.push(sleeveUrls[slv]); }
      if (priorityMockupUrl) realImages.push(priorityMockupUrl);
      realImages.push(qrOnlyUrl);

      // Use real images if ≥3; otherwise fall back to keeping existing non-stock images
      const instanceSnap = await db.collection(ADMIN_INSTANCES_COLLECTION)
        .where('currentPacketId', '==', packetId).limit(1).get();
      if (!instanceSnap.empty) {
        const instRef = instanceSnap.docs[0].ref;
        const instData = instanceSnap.docs[0].data();
        let updatedImages: string[];
        if (realImages.length >= 3) {
          // We have enough real images — drop all stock printify images
          updatedImages = realImages;
        } else {
          // Not enough real images yet — keep existing non-stock images and prepend composite
          const existingImages: string[] = (instData.resolved?.images || [])
            .filter((u: string) => !u.includes('images.printify.com'));
          updatedImages = [compositeUrl, ...existingImages.filter((u: string) => u !== compositeUrl)];
        }
        await instRef.update({
          'resolved.images': updatedImages,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      res.json({ success: true, packetId, compositeUrl, sleeveCompositeUrl, qrOnlyUrl, imageCount: realImages.length });
    } catch (err: any) {
      console.error('[QRG] regenerate-composite error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── QRG ID Allocation ─────────────────────────────────────────────────────
  app.post('/admin/qrg/allocate', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { source, blankCode } = req.body;
      if (!source || !blankCode) {
        res.status(400).json({ error: 'source and blankCode are required' });
        return;
      }
      const counterRef = db.collection(QRG_COUNTERS_COLLECTION).doc(`${source}-${blankCode}`);
      let buildNumber = 0;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        if (!snap.exists) {
          buildNumber = 1;
          tx.set(counterRef, { lastBuildNumber: 1, source, blankCode, createdAt: FieldValue.serverTimestamp() });
        } else {
          buildNumber = (snap.data()!.lastBuildNumber || 0) + 1;
          tx.update(counterRef, { lastBuildNumber: buildNumber, updatedAt: FieldValue.serverTimestamp() });
        }
      });
      const buildStr = String(buildNumber).padStart(3, '0');
      const qrgId = `QRG-${source}-${blankCode}-${buildStr}`;
      res.json({ success: true, qrgId, source, blankCode, buildNumber });
    } catch (err: any) {
      console.error('[QRG] allocate error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

