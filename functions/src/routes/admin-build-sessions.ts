import { resolveBuildDestination, destinationMetadata } from '../services/build-destination';
import { resolveInstance as resolveFields } from '../services/instance-resolver';
import { buildPacketImageOrder, instanceCatalogImages, masterBlankImages, resolveCatalogImages } from "../../../shared/productImages";
import { requireBuilderSnapshot } from '../../../shared/builderSnapshot';
import { validatePacketComposition, packetPrintifyArtwork } from '../services/assembly-store';
import { readGeneratedBuild, existingBuildInstance, saveBuildInstance, saveGeneratedBuildArtifact } from '../services/build-session-state';
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
import { allocateQrgInstance } from '../services/qrg-instance-allocator';
import { writeBldDefinition, writeAutoAssembly } from '../services/bld-builder';
import { isValidQrgBlankId } from '../../../shared/qrgCodes';

const BUILD_SESSIONS_COLLECTION = 'admin_build_sessions';
const ADMIN_INSTANCES_COLLECTION = 'admin_catalog_instances';
const MASTER_CATALOG_COLLECTION = 'master_catalog';
const PRODUCT_PACKETS_COLLECTION = 'productPackets';

const SESSION_EXPIRY_DAYS = 7;


/**
 * Sanitize an arbitrary value for safe Firestore writes.
 * JSON round-trip guarantees: no undefined, no NaN/Infinity, no class instances,
 * no Symbols — only plain JSON-compatible values survive.
 * Returns null if the value is not serializable.
 */
function sanitizeForFirestore(obj: any): any {
  try {
    return JSON.parse(JSON.stringify(obj, (_k, v) => {
      if (v === undefined) return null;
      if (typeof v === 'number' && !isFinite(v)) return null;
      return v;
    }));
  } catch (e: any) {
    throw new Error(`sanitizeForFirestore: value is not serializable — ${e.message}`);
  }
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
      const { sourceMasterId, catalogId, blankKey: bodyBlankKey, shelfItemId, forceNew = false, initialWorking } = req.body;
      if (typeof forceNew !== 'boolean' || (initialWorking !== undefined && !forceNew)) {
        res.status(400).json({ error: 'initialWorking requires forceNew: true.' }); return;
      }
      let templateWorking: Record<string, any> | null = null;
      if (initialWorking !== undefined) {
        try { templateWorking = requireBuilderSnapshot(initialWorking); }
        catch (error: any) { res.status(400).json({ error: error.message }); return; }
        if (templateWorking.metadata.selectedProductDocId !== sourceMasterId) {
          res.status(400).json({ error: 'Template product identity must match sourceMasterId.' }); return;
        }
      }

      if (!sourceMasterId) {
        res.status(400).json({ error: 'sourceMasterId is required' });
        return;
      }

      const ownerAdminId = (req as any).user?.uid || null;
      if (!ownerAdminId) {
        res.status(401).json({ error: 'Admin UID required' });
        return;
      }

      // P6: catalog-scope check — non-blocking warning only.
      // A stale catalogId on the shelf doc (e.g. after a catalog rebuild) must not
      // permanently lock the admin out of a product. Log for investigation, then continue.
      if (shelfItemId && catalogId) {
        const shelfDoc = await db.collection("admin_build_shelf").doc(shelfItemId).get();
        if (!shelfDoc.exists) {
          console.warn(`[from-master] P6 warning: shelfItem ${shelfItemId} not found in admin_build_shelf — continuing without catalog-scope validation`);
        } else if (shelfDoc.data()?.catalogId !== catalogId) {
          console.warn(`[from-master] P6 warning: shelfItem ${shelfItemId} has catalogId="${shelfDoc.data()?.catalogId}" but request sent catalogId="${catalogId}" — mismatch, continuing anyway`);
        }
      }

      // Filter status in-memory to avoid requiring a composite Firestore index.
      const rawSessions = forceNew ? { docs: [] } : await db.collection(BUILD_SESSIONS_COLLECTION)
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
        working: templateWorking || {
          title: master.title || null,
          description: master.description || null,
          images: master.images || [],
          pricing: null,
          graphics: null,
          qrConfig: null,
          layoutConfig: null,
          // bld.layout.zones is populated on first autosave per BLD.md canonical schema
          bld: null,
          // Seed product identity into metadata so DraftResumeHandler can resolve
          // the source product even if autosave never fires (e.g. user navigates
          // away before the 1.5-second debounce elapses or before flush-on-unmount
          // captures auth headers).
          metadata: {
            selectedProductDocId: masterDoc.id,
            selectedProductBlueprintId: (master as any).printifyBlueprintId ?? (master as any).blueprintId ?? null,
            fulfillmentProvider: (master as any).fulfillmentProvider ?? (
              (master as any).printifyBlueprintId ? 'printify' :
              (master as any).printfulProductId ? 'printful' : 'printify'
            ),
          },
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
      if (draftName !== undefined && typeof draftName !== 'string') {
        res.status(400).json({ error: 'Draft name must be text.' }); return;
      }

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
        updatePayload.working = sanitizeForFirestore(working);
        console.log(`[BuildSessions] patch ${id} | working keys: ${Object.keys(updatePayload.working).join(',')}`);
      }

      if (draftName !== undefined) {
        updatePayload.draftName = draftName.trim();
        // An explicitly saved draft remains resumable until the admin deletes it.
        updatePayload.expiresAt = draftName.trim() ? null : Timestamp.fromDate(new Date(Date.now() + SESSION_EXPIRY_DAYS * 86400000));
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

      const packetId = await saveGeneratedBuildArtifact(db, id, packetFields, FieldValue.serverTimestamp());

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
      const {
        catalogId,
        pricing: bodyPricing,
        channelId: bodyChannelId,
        channelName: bodyChannelName,
        storeId: bodyStoreId,
        storeName: bodyStoreName,
        collectionName: bodyCollectionName,
      } = req.body;

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
          packetId: session.generated?.packetId || null,
          bldId: session.bldId || null,
          assemblyId: session.assemblyId || null,
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

      // Render, BLD and Assembly must consume the same captured build inputs.
      try {
        session.working = await readGeneratedBuild(db, { ...session, id });
      } catch (error: any) { res.status(400).json({ error: error.message }); return; }
      const previousInstance = await existingBuildInstance(db, { ...session, id });

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
      let curatedImages = masterBlankImages(master);
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
            curatedImages = resolveCatalogImages(curatedImages, blankImages[lookupKey]);
          }
        } catch (error) { throw new Error("Could not load the catalog image selection; try again."); }
      }

      // Capture the admin-curated colors/sizes from the packet for enabledColors/enabledSizes.
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
      // resolved.images starts from admin-curated catalog images.
      // Placement mockup images are written afterward by the client calling /rebuild-images.
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
      const destination = await resolveBuildDestination(db, {
        storeId: bodyStoreId || meta.selectedStore?.id,
        channelId: bodyChannelId || meta.selectedChannel?.id,
        collectionId: bodyCollectionName && bodyCollectionName !== meta.selectedCollection?.name ? null : meta.selectedCollection?.id,
        collectionName: bodyCollectionName || meta.selectedCollection?.name,
      });
      const { selectedStore, selectedChannel, selectedCollection } = destinationMetadata(destination);
      const folderPath = destination.folderPath;
      session.working.metadata = { ...meta, ...destinationMetadata(destination) };

      // ── Gate 1: Validate QRG blank identity ────────────────────────────────
      const masterQrgBlankId: string | null = master.qrgBlankId || null;
      if (!masterQrgBlankId || !isValidQrgBlankId(masterQrgBlankId)) {
        res.status(400).json({
          error: `Master ${session.sourceMasterId} has no valid qrgBlankId — cannot commit without QRG identity. ` +
                 `Set a valid STNNN blank ID (e.g. qrg_11001) on the master catalog entry.`,
        });
        return;
      }

      // ── Gate 2: Allocate QRG instance (atomically minted — never hand-coded) ──
      const qrgIdentity = previousInstance ? {
        qrgBlankId: previousInstance.qrgBlankId, qrgContext: previousInstance.qrgContext,
        instanceNumber: previousInstance.instanceNumber, qrgBaseCode: previousInstance.qrgBaseCode,
        variantCode: previousInstance.variantCode ?? null, qrgFullCode: previousInstance.qrgFullCode ?? null,
      } : await allocateQrgInstance({ qrgBlankId: masterQrgBlankId, context: 'I' });
      const qrgScanUrl  = `${process.env.APP_URL || 'https://qrgear.com'}/scan/${qrgIdentity.qrgBaseCode}`;
      console.log(`[BuildSessions] QRG allocated: ${qrgIdentity.qrgBaseCode} → ${qrgScanUrl}`);

      // ── Gate 3: Register GRF assets from packet (BLOCKING — Assembly requires real IDs) ──
      let grfIds: { backgroundGrfId: string | null; qrGrfId: string | null; compositeGrfId: string | null; landingSnapshotGrfId: string | null } = {
        backgroundGrfId: null, qrGrfId: null, compositeGrfId: null, landingSnapshotGrfId: null,
      };
      if (newPacketId) {
        try {
          const packetSnap = await db.collection(PRODUCT_PACKETS_COLLECTION).doc(newPacketId).get();
          if (packetSnap.exists) {
            const { registerPacketGrfAssets } = await import('../services/grf-registrar');
            grfIds = await registerPacketGrfAssets(packetSnap.data() as Record<string, any>, id, newPacketId);
            console.log(`[BuildSessions] GRF assets registered: bg=${grfIds.backgroundGrfId} qr=${grfIds.qrGrfId} comp=${grfIds.compositeGrfId}`);
            // Back-fill GRF IDs onto packet for schema traceability
            await db.collection(PRODUCT_PACKETS_COLLECTION).doc(newPacketId).update({
              ...destination,
            builderSnapshot: { ...session.working, metadata: session.working.metadata },
              backgroundGrfId:      grfIds.backgroundGrfId      || null,
              qrGrfId:              grfIds.qrGrfId              || null,
              compositeGrfId:       grfIds.compositeGrfId       || null,
              landingSnapshotGrfId: grfIds.landingSnapshotGrfId || null,
              qrgBaseCode:          qrgIdentity.qrgBaseCode,
              qrgScanUrl,
              updatedAt: now,
            });
          }
        } catch (grfErr: any) {
          console.error(`[BuildSessions] GRF registration FAILED (blocking):`, grfErr.message);
          res.status(500).json({
            error: `Schema commit failed at GRF asset registration: ${grfErr.message}. ` +
                   `Cannot write Assembly without registered GRF IDs.`,
          });
          return;
        }
      }

      // ── Gate 4: Write BLD definition (BLOCKING — commit fails if BLD write fails) ──
      let bldId: string | null = null;
      try {
        const bldResult = await writeBldDefinition({ working: session.working || {}, packetId: newPacketId });
        bldId = bldResult.bldId;
        console.log(`[BuildSessions] BLD written: ${bldId} (${bldResult.instanceCount} instances)`);
      } catch (bldErr: any) {
        console.error(`[BuildSessions] BLD write FAILED (blocking):`, bldErr.message);
        res.status(500).json({
          error: `Schema commit failed at BLD write: ${bldErr.message}`,
        });
        return;
      }

      // ── Gate 5: Write Assembly with real GRF IDs (BLOCKING) ─────────────────
      let assemblyId: string | null = null;
      try {
        const asmResult = await writeAutoAssembly({
          working:         session.working || {},
          qrgId:           qrgIdentity.qrgBlankId,
          bldId:           bldId!,
          sourceSessionId: id,
          packetId:        newPacketId,
          grfIds,
        });
        assemblyId = asmResult.assemblyId;
        console.log(`[BuildSessions] Assembly written: ${assemblyId} (${asmResult.mappingCount} mappings)`);
      } catch (asmErr: any) {
        console.error(`[BuildSessions] Assembly write FAILED (blocking):`, asmErr.message);
        res.status(500).json({
          error: `Schema commit failed at Assembly write: ${asmErr.message}`,
        });
        return;
      }

      // ── Gate 6: Create admin_catalog_instance (all schema records exist) ────
      const instanceRef = await saveBuildInstance(db, { ...session, id }, {
        instanceType: 'admin', sourceMasterId: session.sourceMasterId, sourceSessionId: id,
        catalogId: effectiveCatalogId, ownerAdminId: session.ownerAdminId,
        baseSnapshot, overrides, resolved,
        // QRG identity — canonical schema: QRG-[STNNN]-[C]-[NNNNNN]
        qrgBlankId:     qrgIdentity.qrgBlankId,
        qrgContext:     qrgIdentity.qrgContext,
        instanceNumber: qrgIdentity.instanceNumber,
        qrgBaseCode:    qrgIdentity.qrgBaseCode,
        qrgScanUrl,
        variantCode:    qrgIdentity.variantCode,
        qrgFullCode:    qrgIdentity.qrgFullCode,
        // Schema chain IDs — all must be present before instance creation
        bldId,
        assemblyId,
        backgroundGrfId:      grfIds.backgroundGrfId      || null,
        qrGrfId:              grfIds.qrGrfId              || null,
        compositeGrfId:       grfIds.compositeGrfId       || null,
        landingSnapshotGrfId: grfIds.landingSnapshotGrfId || null,
        // Admin-curated selections from the builder
        enabledColors: packetEnabledColors,
        enabledSizes: packetEnabledSizes,
        currentPacketId: newPacketId, currentTemplateId: session.generated?.templateId || null,
        currentGraphicSetId: session.generated?.graphicSetId || null,
        storeId: selectedStore?.id || null, storeName: selectedStore?.name || null,
        channelId: selectedChannel?.id || null, channelName: selectedChannel?.name || null,
        collectionId: selectedCollection?.id || null, collectionName: selectedCollection?.name || null,
        folderPath,
        status: 'active', isVisible: true, createdAt: now, updatedAt: now,
      });
      const instanceId = instanceRef.id;
      console.log(`[BuildSessions] Created instance ${instanceId} (QRG=${qrgIdentity.qrgBaseCode} BLD=${bldId} ASM=${assemblyId})`);

      res.json({
        success: true,
        sessionId: id,
        instanceId,
        sourceMasterId: session.sourceMasterId,
        packetId:   newPacketId,
        bldId,
        assemblyId,
        qrgBaseCode: qrgIdentity.qrgBaseCode,
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
      const disposable = stale.docs.filter((doc: any) => !doc.data().draftName);
      disposable.forEach((doc: any) => {
        batch.update(doc.ref, { status: 'abandoned' });
      });
      await batch.commit();

      res.json({ success: true, cleaned: disposable.length });
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

      // All available graphic placements — exclude label/tag placements (inside labels are not graphic areas)
      const LABEL_PLACEMENTS = new Set(['label', 'inside_label', 'neck_label', 'outside_label']);
      const allGraphicPlacements: string[] = (packet.placements || ['front'])
        .filter((p: string) => !LABEL_PLACEMENTS.has(p));

      // ── 1. Front composite (with header/footer) ───────────────────────────
      const frontPlacement = allGraphicPlacements[0] || 'front';
      const frontDataUrl = await cfGeneratePrintifyComposite(
        qrContent, topText, bottomText,
        1200, 1800, 'black', frontPlacement, graphicLayoutMode, qrSizePercent
      );
      const frontBuf = Buffer.from(frontDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
      const { publicUrl: compositeUrl } = await cfUploadBufferToStorage(frontBuf, 'image/png', folder);

      // ── 2. Sleeve composites (QR code only — no header/footer) ───────────
      const SLEEVE_PLACEMENTS = ['left_sleeve', 'right_sleeve'];
      const packetPlacements: string[] = allGraphicPlacements;
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
      const packetUpdate: Record<string, any> = {
        compositeUrl, qrOnlyUrl, sleeveCompositeUrl, sleeveCompositeUrls: sleeveUrls,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await packetRef.update(packetUpdate);

      // ── 5. Build resolved.images for catalog instance ─────────────────────
      const instanceSnap = await db.collection(ADMIN_INSTANCES_COLLECTION)
        .where('currentPacketId', '==', packetId).limit(1).get();
      if (!instanceSnap.empty) {
        const instRef = instanceSnap.docs[0].ref;
        const instData = instanceSnap.docs[0].data();
        const updatedImages = buildPacketImageOrder({ ...packet, ...packetUpdate }, instanceCatalogImages(instData));
        await instRef.update({
          'resolved.images': updatedImages,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // ── 6. Auto re-publish to Printify if instances are already live ─────────
      // Fire-and-forget: response goes out immediately, republish runs in background
      import('../services/printify-republish').then(({ republishAllInstancesForPacket }) => {
        republishAllInstancesForPacket(packetId).catch((e: any) =>
          console.error('[AutoRepublish] background error for packet', packetId, e.message)
        );
      }).catch(() => {});

      res.json({ success: true, packetId, compositeUrl, sleeveCompositeUrl, qrOnlyUrl, imageCount: buildPacketImageOrder({ ...packet, ...packetUpdate }).length });
    } catch (err: any) {
      console.error('[QRG] regenerate-composite error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Publish Packet to Printify ────────────────────────────────────────────
  // Creates a Printify product from the packet's composites, stores printifyProductId
  // and a full color/size → variantId map back on the packet so orders can be fulfilled.
  app.post('/admin/qrg/publish-to-printify/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { packetId } = req.params;
      // printProviderId and colors can be overridden via body
      const overrideProviderId: number | undefined = req.body.printProviderId
        ? parseInt(req.body.printProviderId, 10)
        : undefined;
      const overrideColors: string[] | undefined = Array.isArray(req.body.colors)
        ? (req.body.colors as string[]).map((c: string) => String(c).trim()).filter(Boolean)
        : undefined;

      const packetDoc = await db.collection('productPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        res.status(404).json({ error: `Packet ${packetId} not found` });
        return;
      }
      const packet = packetDoc.data()!;
      try { await validatePacketComposition(db, packetId, packet); }
      catch (e: any) { res.status(400).json({ error: e.message }); return; }
      if (packet.fulfillmentProvider && packet.fulfillmentProvider !== 'printify') { res.status(400).json({ error: 'This packet is not a Printify product.' }); return; }


      if (!packet.blueprintId) {
        res.status(400).json({ error: 'Packet is missing blueprintId' });
        return;
      }
      if (!packet.compositeUrl) {
        res.status(400).json({ error: 'Packet is missing compositeUrl — regenerate composite first' });
        return;
      }
      if (!packet.assemblyId) {
        res.status(400).json({ error: 'Packet is missing assemblyId — complete the QRG → BLD → GRF chain in the Library before publishing to Printify' });
        return;
      }

      let artwork: Array<{ position: string; imageUrl: string }>;
      try { artwork = await packetPrintifyArtwork(db, packet); }
      catch (e: any) { res.status(400).json({ error: e.message }); return; }
      const blueprintId = parseInt(packet.blueprintId, 10);
      const printProviderId = overrideProviderId || packet.printProviderId || 99;

      // ── 1. Resolve enabled colors + sizes ──────────────────────────────────
      const rawColors: string[] = overrideColors || (packet.colors || packet.enabledColors || []);
      const enabledColors: string[] = rawColors.map((c: any) =>
        typeof c === 'string' ? c : c?.name || c?.label || String(c)
      ).filter(Boolean);
      const enabledSizes: string[] = (packet.sizes || packet.enabledSizes || []).map((s: any) =>
        typeof s === 'string' ? s : s?.name || s?.label || String(s)
      ).filter(Boolean);

      if (enabledColors.length === 0 || enabledSizes.length === 0) {
        res.status(400).json({ error: 'Packet has no enabled colors or sizes — add them before publishing' });
        return;
      }

      // ── 2. Fetch Printify variants for this blueprint + provider ───────────
      const { printifyClient } = await import('../services/printify');
      const variantsData = await printifyClient.getVariants(blueprintId, printProviderId);
      const allVariants: Array<{ id: number; title: string; options?: any }> = variantsData.variants || [];

      // Match variants: Printify variant title is typically "Color / Size"
      const matchedVariants = allVariants.filter((v) => {
        const parts = (v.title || '').split(' / ');
        const vColor = parts[0]?.trim();
        const vSize = parts[1]?.trim();
        if (!vColor || !vSize) return false;
        const colorMatch = enabledColors.some(
          (c) => c.toLowerCase() === vColor.toLowerCase()
        );
        const sizeMatch = enabledSizes.some((s) => s === vSize);
        return colorMatch && sizeMatch;
      });

      if (matchedVariants.length === 0) {
        res.status(400).json({
          error: `No Printify variants matched for colors [${enabledColors.join(', ')}] and sizes [${enabledSizes.join(', ')}] on blueprint ${blueprintId} / provider ${printProviderId}. Check spelling or choose a different print provider.`,
        });
        return;
      }

      const priceInCents = Math.round((packet.pricing?.customerPrice || 29.99) * 100);
      const variantObjs = matchedVariants.map((v) => ({
        id: v.id,
        price: priceInCents,
        is_enabled: true,
      }));
      const variantIds = variantObjs.map((v) => v.id);

      // Build color/size → variantId lookup map stored on the packet
      const printifyVariantMap: Record<string, number> = {};
      for (const v of matchedVariants) {
        const parts = (v.title || '').split(' / ');
        const vColor = parts[0]?.trim();
        const vSize = parts[1]?.trim();
        if (vColor && vSize) printifyVariantMap[`${vColor}/${vSize}`] = v.id;
      }

      // ── 3. Upload composite images to Printify (generic — driven by placements array) ──
      const placeholders: Array<{
        position: string;
        images: Array<{ id: string; x: number; y: number; scale: number; angle: number }>;
      }> = [];

      for (const { position: placement, imageUrl } of artwork) {
        const upload = await printifyClient.uploadImage(`${packetId}-${placement}.png`, imageUrl);
        console.log(`[PublishToPrintify] ${placement} image uploaded: ${upload.id}`);
        placeholders.push({
          position: placement,
          images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
        });
      }

      if (placeholders.length === 0) {
        res.status(400).json({ error: 'No placement images could be uploaded — check compositeUrl and placement fields' });
        return;
      }

      // ── 4. Create the Printify product ─────────────────────────────────────
      const productTitle = packet.productName || packet.title || 'QR Gear T-Shirt';
      const printifyProduct = await printifyClient.createProduct({
        title: productTitle,
        description: packet.productDescription || packet.description || '',
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: variantObjs,
        print_areas: [{ variant_ids: variantIds, placeholders }],
      });
      console.log(`[PublishToPrintify] Product created: ${printifyProduct.id} for packet ${packetId}`);

      // ── 5. Persist back to packet ──────────────────────────────────────────
      await db.collection('productPackets').doc(packetId).update({
        printifyProductId: printifyProduct.id,
        printProviderId,
        printifyVariantMap,
        printifyPublishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.json({
        success: true,
        printifyProductId: printifyProduct.id,
        printProviderId,
        variantCount: variantObjs.length,
        printifyVariantMap,
        enabledColors,
        printifyPublishedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[PublishToPrintify] error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Manual republish: re-push composite images to existing Printify product ─
  app.post('/admin/qrg/republish/:instanceId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { instanceId } = req.params;
      const { republishInstanceToPrintify } = await import('../services/printify-republish');

      const instanceDoc = await db.collection('admin_catalog_instances').doc(instanceId).get();
      if (!instanceDoc.exists) {
        res.status(404).json({ error: 'Instance not found' });
        return;
      }
      if (!instanceDoc.data()!.printifyProductId) {
        res.status(400).json({ error: 'Instance has no printifyProductId — publish it first via /admin/qrg/publish-to-printify/:packetId' });
        return;
      }

      await db.collection('admin_catalog_instances').doc(instanceId).update({
        publishStatus: 'pending',
      });

      const result = await republishInstanceToPrintify(instanceId);
      if (result.success) {
        res.json({ success: true, instanceId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (err: any) {
      console.error('[ManualRepublish] error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── QRG Instance Number Allocation ────────────────────────────────────────
  // Allocates the next sequential instanceNumber for a given blank+context pair.
  // Schema: QRG-[STNNN]-[C]-[NNNNNN]
  //   qrgBlankId  = 5-digit STNNN (e.g. "11101")
  //   contextCode = I | M | E | O  (Internal / Member / External / Owner)
  //   instanceNumber returned as 6-digit zero-padded string e.g. "000001"
  //   packetCode  = QRG-11101-I-000001  (no SSCC — that is barcode-only)
  app.post('/admin/qrg/allocate', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { qrgBlankId, contextCode } = req.body;

      if (!qrgBlankId || !/^[1-6][1-9][0-9]{3}$/.test(qrgBlankId)) {
        res.status(400).json({ error: 'qrgBlankId is required and must be 5-digit STNNN (e.g. "11101")' });
        return;
      }
      if (!contextCode || !/^[IMEO]$/.test(contextCode)) {
        res.status(400).json({ error: 'contextCode is required and must be I, M, E, or O' });
        return;
      }

      const qrgIdentityResult = await allocateQrgInstance({ qrgBlankId, context: contextCode as 'I' | 'M' | 'E' | 'O' });

      res.json({
        success: true,
        qrgBaseCode:    qrgIdentityResult.qrgBaseCode,
        qrgBlankId:     qrgIdentityResult.qrgBlankId,
        contextCode:    qrgIdentityResult.qrgContext,
        instanceNumber: qrgIdentityResult.instanceNumber,
      });
    } catch (err: any) {
      console.error('[QRG] allocate error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
}

