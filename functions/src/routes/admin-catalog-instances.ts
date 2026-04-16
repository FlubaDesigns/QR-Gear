/**
 * Admin Catalog Instances — Production Routes
 *
 * Architecture:
 *   provider handlers → master_catalog (canonical, read-only)
 *   master_catalog item → admin_catalog_instances (admin-editable derived copy)
 *   admin_catalog_instances → member_library_instances (per-member derived copy)
 *   instances → productPackets / productTemplates / productGraphics (attached artifacts)
 *
 * Every instance carries full lineage back to its master catalog source.
 * NEVER mutate master_catalog from here. NEVER mutate admin instances from member routes.
 */

import express from 'express';
import { db, admin, stripUndef } from '../core';
import { requireAdmin, requireAuth } from '../middleware';

const ADMIN_INSTANCES = 'admin_catalog_instances';
const MASTER_CATALOG  = 'master_catalog';
const MEMBER_INSTANCES = 'member_library_instances';
const PACKETS = 'productPackets';

function resolveFields(base: Record<string, any>, overrides: Record<string, any>): Record<string, any> {
  const resolved: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== null && v !== undefined && v !== '') resolved[k] = v;
  }
  return resolved;
}

export function register(app: express.Express): void {

  // ── List admin instances ─────────────────────────────────────────────────
  app.get('/admin/catalog-instances', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      let q: any = db.collection(ADMIN_INSTANCES).orderBy('createdAt', 'desc');
      if (req.query.catalogId) q = q.where('catalogId', '==', req.query.catalogId);
      if (req.query.sourceMasterId) q = q.where('sourceMasterId', '==', req.query.sourceMasterId);
      const snap = await q.limit(200).get();
      const instances = snap.docs.map((d: any) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null };
      });
      res.json({ success: true, instances, count: instances.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Get single admin instance ────────────────────────────────────────────
  app.get('/admin/catalog-instances/:id', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const doc = await db.collection(ADMIN_INSTANCES).doc(req.params.id).get();
      if (!doc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }
      const data = doc.data() as any;
      res.json({ success: true, instance: { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null } });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Create admin instance from master catalog item ───────────────────────
  // Master catalog item is cloned into baseSnapshot — master doc is NEVER touched.
  app.post('/admin/catalog-instances/from-master', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { sourceMasterId, catalogId, metadata } = req.body;
      if (!sourceMasterId) { res.status(400).json({ error: 'sourceMasterId is required' }); return; }
      if (!catalogId) { res.status(400).json({ error: 'catalogId is required' }); return; }

      const masterDoc = await db.collection(MASTER_CATALOG).doc(sourceMasterId).get();
      if (!masterDoc.exists) { res.status(404).json({ error: `Master catalog item not found: ${sourceMasterId}` }); return; }
      const master = masterDoc.data() as any;

      const now = admin.firestore.FieldValue.serverTimestamp();

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

      const instanceData = {
        instanceType: 'admin',
        sourceMasterId,
        catalogId,
        ownerAdminId: req.user?.uid || null,
        baseSnapshot,
        overrides: {},
        resolved: { ...baseSnapshot },
        currentPacketId: null,
        currentTemplateId: null,
        currentGraphicSetId: null,
        status: 'active',
        metadata: metadata || null,
        createdAt: now,
        updatedAt: now,
      };

      const ref = await db.collection(ADMIN_INSTANCES).add(instanceData);
      console.log(`[AdminInstances] Created ${ref.id} from master ${sourceMasterId}`);
      res.json({ success: true, instanceId: ref.id, sourceMasterId });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Save admin overrides — NEVER touches master catalog ──────────────────
  app.patch('/admin/catalog-instances/:id', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { overrides, metadata, status } = req.body;
      const ref = db.collection(ADMIN_INSTANCES).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }

      const existing = doc.data() as any;
      const mergedOverrides = { ...existing.overrides, ...overrides };
      const resolved = resolveFields(existing.baseSnapshot, mergedOverrides);

      const update: Record<string, any> = {
        overrides: mergedOverrides,
        resolved,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (metadata !== undefined) update.metadata = metadata;
      if (status !== undefined) update.status = status;

      await ref.update(update);
      console.log(`[AdminInstances] Updated ${req.params.id}`);
      res.json({ success: true, instanceId: req.params.id, resolved });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Create or update packet from admin instance ───────────────────────────
  // Packet is an attached artifact. Lineage is written back onto the instance.
  app.post('/admin/catalog-instances/:id/create-packet', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { id } = req.params;
      const packetFields = req.body;

      const instanceRef = db.collection(ADMIN_INSTANCES).doc(id);
      const instanceDoc = await instanceRef.get();
      if (!instanceDoc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }

      const instance = instanceDoc.data() as any;
      const now = admin.firestore.FieldValue.serverTimestamp();

      const packetData = stripUndef({
        // Lineage — mandatory on every packet
        ownerType: 'admin',
        ownerInstanceId: id,
        sourceMasterId: instance.sourceMasterId,
        sourceAdminInstanceId: id,
        sourceMemberInstanceId: null,

        // Identity from instance resolved state
        masterTitle: instance.baseSnapshot?.title || null,
        adminCatalogTitle: instance.resolved?.title || null,
        effectiveTitle: instance.resolved?.title || instance.baseSnapshot?.title || null,
        masterDescription: instance.baseSnapshot?.description || null,
        adminCatalogDescription: instance.resolved?.description || null,
        effectiveDescription: instance.resolved?.description || instance.baseSnapshot?.description || null,
        productImageUrl: instance.resolved?.images?.[0] || null,
        blueprintId: instance.resolved?.printifyBlueprintId || null,
        category: instance.resolved?.category || null,
        colors: instance.resolved?.colors || [],
        sizes: instance.resolved?.sizes || [],

        // Caller-supplied packet fields (QR, graphics, layout, etc.)
        ...packetFields,

        updatedAt: now,
      });

      let packetId: string;
      if (instance.currentPacketId) {
        const { createdAt: _omit, ...updateFields } = packetData;
        await db.collection(PACKETS).doc(instance.currentPacketId).update({ ...updateFields, updatedAt: now });
        packetId = instance.currentPacketId;
      } else {
        packetData.createdAt = now;
        const packetRef = await db.collection(PACKETS).add(packetData);
        packetId = packetRef.id;
      }

      // Write packet reference back onto the instance
      await instanceRef.update({ currentPacketId: packetId, updatedAt: now });

      console.log(`[AdminInstances] Packet ${packetId} linked to instance ${id}`);
      res.json({ success: true, packetId, instanceId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Push admin instance to member → creates member library instance ───────
  app.post('/admin/catalog-instances/:id/push-to-member', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { id } = req.params;
      const { memberId, libraryId } = req.body;
      if (!memberId) { res.status(400).json({ error: 'memberId is required' }); return; }

      const instanceDoc = await db.collection(ADMIN_INSTANCES).doc(id).get();
      if (!instanceDoc.exists) { res.status(404).json({ error: 'Admin instance not found' }); return; }

      const instance = instanceDoc.data() as any;
      const now = admin.firestore.FieldValue.serverTimestamp();
      const baseSnapshot = { ...instance.resolved };

      const memberData = {
        instanceType: 'member',
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
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const memberRef = await db.collection(MEMBER_INSTANCES).add(memberData);
      console.log(`[AdminInstances] Pushed instance ${id} → member instance ${memberRef.id} for member ${memberId}`);
      res.json({ success: true, memberInstanceId: memberRef.id, adminInstanceId: id, sourceMasterId: instance.sourceMasterId });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
