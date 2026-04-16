/**
 * Member Library Instances — Production Routes
 *
 * Member instances are derived from admin instances (or directly from master
 * when admin allows it). Members customise their own copy without touching:
 *   - the master_catalog
 *   - the admin_catalog_instance they were derived from
 *
 * Lineage is always preserved on every write.
 *
 * Endpoint prefix: /member/library-instances (Firestore: member_library_instances)
 */

import express from 'express';
import { db, admin, stripUndef } from '../core';
import { requireAuth, requireAdmin } from '../middleware';
import { resolveInstance } from '../services/instance-resolver';

const MEMBER_INSTANCES = 'member_library_instances';
const PACKETS          = 'productPackets';

function toSerializable(doc: FirebaseFirestore.DocumentSnapshot): Record<string, any> {
  const data = doc.data() as any;
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

export function register(app: express.Express): void {

  // ── GET /member/library-instances ───────────────────────────────────────────
  // Returns the authenticated member's own instances.
  // Admin can additionally filter by memberId.
  app.get('/member/library-instances', requireAuth, async (req: any, res: any): Promise<void> => {
    try {
      const uid     = req.user?.uid as string;
      const isAdmin = req.user?.admin === true;

      let q: FirebaseFirestore.Query = db.collection(MEMBER_INSTANCES).orderBy('createdAt', 'desc');

      if (isAdmin && req.query.memberId) {
        q = q.where('ownerMemberId', '==', req.query.memberId);
      } else if (!isAdmin) {
        q = q.where('ownerMemberId', '==', uid);
      }

      if (req.query.sourceAdminInstanceId) q = q.where('sourceAdminInstanceId', '==', req.query.sourceAdminInstanceId);
      if (req.query.status)                q = q.where('status',                '==', req.query.status);

      const snap      = await q.limit(200).get();
      const instances = snap.docs.map(toSerializable);
      res.json({ success: true, instances, count: instances.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /member/library-instances/:id ───────────────────────────────────────
  app.get('/member/library-instances/:id', requireAuth, async (req: any, res: any): Promise<void> => {
    try {
      const doc = await db.collection(MEMBER_INSTANCES).doc(req.params.id).get();
      if (!doc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }
      const data = doc.data() as any;
      if (req.user?.admin !== true && data.ownerMemberId !== req.user?.uid) {
        res.status(403).json({ error: 'Access denied' }); return;
      }
      res.json({ success: true, instance: toSerializable(doc) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── PATCH /member/library-instances/:id ─────────────────────────────────────
  // Save member overrides. resolveInstance is recomputed.
  // Admin instance and master catalog are NEVER touched.
  app.patch('/member/library-instances/:id', requireAuth, async (req: any, res: any): Promise<void> => {
    try {
      const { overrides: incomingOverrides, status } = req.body;

      const ref = db.collection(MEMBER_INSTANCES).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }
      const existing = doc.data() as any;

      if (req.user?.admin !== true && existing.ownerMemberId !== req.user?.uid) {
        res.status(403).json({ error: 'Access denied' }); return;
      }

      const mergedOverrides = { ...existing.overrides, ...incomingOverrides };
      const resolved        = resolveInstance(existing.baseSnapshot, mergedOverrides);

      const update: Record<string, any> = {
        overrides: mergedOverrides,
        resolved,
        version:   (existing.version ?? 1) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user?.uid ?? 'system',
      };
      if (status !== undefined) update.status = status;

      await ref.update(update);
      res.json({ success: true, instanceId: req.params.id, resolved, version: update.version });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /member/library-instances/:id/create-packet ────────────────────────
  // Create or update a packet attached to this member instance.
  // Packet carries full lineage: master + admin instance + member instance.
  app.post('/member/library-instances/:id/create-packet', requireAuth, async (req: any, res: any): Promise<void> => {
    try {
      const { id }       = req.params;
      const packetFields = req.body;

      const instanceRef = db.collection(MEMBER_INSTANCES).doc(id);
      const instanceDoc = await instanceRef.get();
      if (!instanceDoc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }

      const instance = instanceDoc.data() as any;
      if (req.user?.admin !== true && instance.ownerMemberId !== req.user?.uid) {
        res.status(403).json({ error: 'Access denied' }); return;
      }

      const resolved = instance.resolved ?? {};
      const now      = admin.firestore.FieldValue.serverTimestamp();

      const packetData = stripUndef({
        // ── Lineage — mandatory on every packet ────────────────────────────
        ownerType:              'member',
        ownerInstanceId:        id,
        sourceMasterId:         instance.sourceMasterId,
        sourceAdminInstanceId:  instance.sourceAdminInstanceId ?? null,
        sourceMemberInstanceId: id,

        // ── Effective identity from member resolved state ───────────────────
        effectiveTitle:       resolved.title       ?? null,
        effectiveDescription: resolved.description ?? null,
        productImageUrl:      resolved.images?.[0]?.url ?? resolved.images?.[0] ?? null,
        category:             resolved.category    ?? null,
        colors:               resolved.colors      ?? [],
        sizes:                resolved.sizes       ?? [],

        // ── Caller-supplied packet fields ────────────────────────────────────
        ...packetFields,

        updatedAt: now,
        updatedBy: req.user?.uid ?? 'system',
      });

      let packetId: string;
      if (instance.currentPacketId) {
        const { createdAt: _omit, createdBy: _omit2, ...updateFields } = packetData;
        await db.collection(PACKETS).doc(instance.currentPacketId).update({ ...updateFields, updatedAt: now });
        packetId = instance.currentPacketId;
      } else {
        packetData.createdAt = now;
        packetData.createdBy = req.user?.uid ?? 'system';
        const packetRef = await db.collection(PACKETS).add(packetData);
        packetId = packetRef.id;
      }

      await instanceRef.update({
        currentPacketId: packetId,
        updatedAt:       now,
        updatedBy:       req.user?.uid ?? 'system',
        version:         admin.firestore.FieldValue.increment(1),
      });

      console.log(`[MemberInstances] Packet ${packetId} linked to member instance ${id}`);
      res.json({ success: true, packetId, instanceId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /admin/member-catalog-instances ─────────────────────────────────────
  // Admin-only: view all member instances across all members.
  app.get('/admin/member-catalog-instances', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      let q: FirebaseFirestore.Query = db.collection(MEMBER_INSTANCES).orderBy('createdAt', 'desc');
      if (req.query.memberId)            q = q.where('ownerMemberId',         '==', req.query.memberId);
      if (req.query.sourceAdminInstanceId) q = q.where('sourceAdminInstanceId', '==', req.query.sourceAdminInstanceId);
      if (req.query.sourceMasterId)      q = q.where('sourceMasterId',         '==', req.query.sourceMasterId);
      const snap      = await q.limit(200).get();
      const instances = snap.docs.map(toSerializable);
      res.json({ success: true, instances, count: instances.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
