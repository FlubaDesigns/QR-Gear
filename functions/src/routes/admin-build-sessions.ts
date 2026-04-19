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
import { db } from '../core';
import { requireAdmin } from '../middleware';

const BUILD_SESSIONS_COLLECTION = 'admin_build_sessions';
const ADMIN_INSTANCES_COLLECTION = 'admin_catalog_instances';
const MASTER_CATALOG_COLLECTION = 'master_catalog';
const PRODUCT_PACKETS_COLLECTION = 'productPackets';

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
      let query: any = db.collection(BUILD_SESSIONS_COLLECTION)
        .where('ownerAdminId', '==', uid)
        .orderBy('updatedAt', 'desc');

      if ((req.query as any).status) {
        query = query.where('status', '==', (req.query as any).status);
      }
      if ((req.query as any).sourceMasterId) {
        query = query.where('sourceMasterId', '==', (req.query as any).sourceMasterId);
      }

      const snap = await query.limit(50).get();
      const sessions = snap.docs.map((doc: any) => {
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
      const { sourceMasterId, catalogId } = req.body;

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
        await doc.ref.update({ lastActiveAt: FieldValue.serverTimestamp() });
        res.json({
          success: true,
          sessionId: doc.id,
          isExisting: true,
          session: {
            id: doc.id,
            ...d,
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

      if (existing.status === 'committed' || existing.status === 'abandoned') {
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

      await ref.update({
        'generated.packetId': packetId,
        'generated.artifactReady': true,
        status: 'artifact_ready',
        updatedAt: now,
        lastActiveAt: now,
      });

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
      const { catalogId } = req.body;

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

      const baseSnapshot = {
        title: master.title || '',
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

      const overrides: Record<string, any> = {};
      const w = session.working || {};
      if (w.title && w.title !== master.title) overrides.title = w.title;
      if (w.description && w.description !== master.description) overrides.description = w.description;
      if (w.images?.length) overrides.images = w.images;
      if (w.pricing) overrides.pricing = w.pricing;
      if (w.metadata) overrides.metadata = w.metadata;

      const resolved = resolveFields(baseSnapshot, overrides);

      const instanceData = {
        instanceType: 'admin',
        sourceMasterId: session.sourceMasterId,
        sourceSessionId: id,
        catalogId: effectiveCatalogId,
        ownerAdminId: session.ownerAdminId,
        baseSnapshot,
        overrides,
        resolved,
        currentPacketId: session.generated?.packetId || null,
        currentTemplateId: session.generated?.templateId || null,
        currentGraphicSetId: session.generated?.graphicSetId || null,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };

      const instanceRef = await db.collection(ADMIN_INSTANCES_COLLECTION).add(instanceData);
      const instanceId = instanceRef.id;

      if (session.generated?.packetId) {
        await db.collection(PRODUCT_PACKETS_COLLECTION).doc(session.generated.packetId).update({
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
        packetId: session.generated?.packetId || null,
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
}
