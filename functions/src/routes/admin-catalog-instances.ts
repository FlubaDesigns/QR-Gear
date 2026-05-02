/**
 * Admin Catalog Instances — Production Routes
 *
 * Architecture:
 *   provider sync → master_catalog (canonical, read-only from here)
 *   master_catalog → admin_catalog_instances (admin-editable derived copy)
 *   admin_catalog_instances → member_library_instances (per-member derived copy)
 *   instances → productPackets / templates / graphics (attached artifacts, not the product)
 *
 * NON-NEGOTIABLE:
 * - Master catalog is NEVER mutated here
 * - Admin instances are NEVER mutated by member routes
 * - resolveInstance() is the only place that computes resolved state
 * - Every packet carries full lineage back to master
 */

import express from 'express';
import { db, admin, stripUndef } from '../core';
import { requireAdmin } from '../middleware';
import { resolveInstance, mergeImagesByUrl } from '../services/instance-resolver';

const ADMIN_INSTANCES  = 'admin_catalog_instances';
const MASTER_CATALOG   = 'master_catalog';
const MEMBER_INSTANCES = 'member_library_instances';
const PACKETS          = 'productPackets';

function toSerializable(doc: FirebaseFirestore.DocumentSnapshot): Record<string, any> {
  const data = doc.data() as any;
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
    assignedAt: data.assignedAt?.toDate?.() ?? null,
  };
}

export function register(app: express.Express): void {

  // ── GET /admin/catalog-instances ────────────────────────────────────────────
  // Filters by storeId in Firestore (indexed), then applies channelId /
  // collectionName in memory so legacy instances (committed before folder-path
  // CF update, channelId=null) still surface instead of silently disappearing.
  app.get('/admin/catalog-instances', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const {
        storeId, channelId, collectionName, folderPath,
        catalogId, sourceMasterId, status,
      } = req.query as Record<string, string>;

      // Use storeId as the primary Firestore filter when available — it's the
      // most reliable field (set even on pre-folder-path instances).
      // Avoid combining orderBy with inequality filters to sidestep index requirements.
      let q: FirebaseFirestore.Query = (storeId || catalogId || sourceMasterId)
        ? db.collection(ADMIN_INSTANCES)
        : db.collection(ADMIN_INSTANCES).orderBy('createdAt', 'desc');

      if (catalogId)      q = q.where('catalogId',      '==', catalogId);
      if (sourceMasterId) q = q.where('sourceMasterId', '==', sourceMasterId);
      if (status)         q = q.where('status',         '==', status);
      if (storeId)        q = q.where('storeId',        '==', storeId);
      // folderPath exact-match only when no sub-filters present
      if (folderPath && !channelId && !collectionName) {
        q = q.where('folderPath', '==', folderPath);
      }

      const snap = await q.limit(500).get();
      let instances = snap.docs.map(toSerializable);

      // Default: hide soft-deleted / invisible instances unless the caller
      // explicitly requests a specific status (e.g. status=deleted for audit).
      if (!status) {
        instances = instances.filter(inst =>
          inst.status !== 'deleted' && inst.isVisible !== false
        );
      }

      // In-memory filters for channel / collection.
      // An instance with null/missing channelId is treated as belonging to ALL
      // channels within its store (backward compat with pre-folder-path commits).
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

      // Sort newest-first when Firestore orderBy was skipped
      if (storeId || catalogId || sourceMasterId) {
        instances.sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });
      }

      res.json({ success: true, instances, count: instances.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /admin/catalog-instances/:id ────────────────────────────────────────
  app.get('/admin/catalog-instances/:id', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const doc = await db.collection(ADMIN_INSTANCES).doc(req.params.id).get();
      if (!doc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }
      res.json({ success: true, instance: toSerializable(doc) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /admin/catalog-instances/from-master ────────────────────────────────
  // Clone a master catalog item into a new admin instance.
  // Master doc is NEVER touched.
  app.post('/admin/catalog-instances/from-master', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { sourceMasterId, catalogId } = req.body;
      if (!sourceMasterId) { res.status(400).json({ error: 'sourceMasterId is required' }); return; }
      if (!catalogId)      { res.status(400).json({ error: 'catalogId is required' }); return; }

      const masterDoc = await db.collection(MASTER_CATALOG).doc(sourceMasterId).get();
      if (!masterDoc.exists) {
        res.status(404).json({ error: `Master catalog item not found: ${sourceMasterId}` });
        return;
      }
      const master = masterDoc.data() as any;
      const now = admin.firestore.FieldValue.serverTimestamp();

      // Normalize images into ImageRecord[] at creation time
      const normalizedImages = mergeImagesByUrl(master.images ?? [], []);

      // Normalize master colors to strings — master_catalog stores {name, hex} objects
      const normalizedColors = (master.colors ?? [])
        .map((c: any) => (typeof c === 'string' ? c : (c?.name ?? c?.hex ?? '')))
        .filter(Boolean) as string[];

      // Preserve name→hex mapping so the UI can render accurate color swatches
      const colorMap: Record<string, string> = {};
      for (const c of (master.colors ?? [])) {
        if (typeof c === 'object' && c?.name && c?.hex) colorMap[c.name] = c.hex;
      }

      const baseSnapshot = {
        title:               master.title              ?? '',
        description:         master.description        ?? null,
        images:              normalizedImages,
        brand:               master.brand              ?? null,
        colors:              normalizedColors,
        sizes:               master.sizes              ?? [],
        category:            master.category           ?? null,
        originCountry:       master.originCountry      ?? null,
        minPrice:            master.minPrice           ?? null,
        maxPrice:            master.maxPrice           ?? null,
        printifyBlueprintId: master.printifyBlueprintId ?? null,
        printfulProductId:   master.printfulProductId  ?? null,
      };

      const overrides = {};
      const resolved  = resolveInstance(baseSnapshot, overrides);

      const instanceData = {
        instanceType:       'admin' as const,
        sourceMasterId,
        catalogId,
        ownerAdminId:       req.user?.uid ?? null,
        assignedAt:         now,
        baseSnapshot,
        overrides,
        resolved,
        colorMap:           Object.keys(colorMap).length > 0 ? colorMap : null,
        currentPacketId:    null,
        currentTemplateId:  null,
        currentGraphicSetId: null,
        status:             'draft' as const,
        version:            1,
        createdAt:          now,
        updatedAt:          now,
        createdBy:          req.user?.uid ?? 'system',
        updatedBy:          req.user?.uid ?? 'system',
      };

      const ref = await db.collection(ADMIN_INSTANCES).add(instanceData);
      console.log(`[AdminInstances] Created ${ref.id} from master ${sourceMasterId}`);
      res.json({ success: true, instanceId: ref.id, sourceMasterId });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── PATCH /admin/catalog-instances/:id ──────────────────────────────────────
  // Save admin overrides. resolveInstance is recomputed. Master is NEVER touched.
  // Also accepts top-level listing controls: enabledColors, enabledSizes,
  // customerPrice, and folderUpdate (for moving an instance to a different folder).
  app.patch('/admin/catalog-instances/:id', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const {
        overrides: rawOverrides = {},
        status,
        enabledColors,
        enabledSizes,
        customerPrice,
        folderUpdate,
      } = req.body;

      const topLevelMetadata = req.body.metadata;
      const incomingOverrides = topLevelMetadata !== undefined
        ? { ...rawOverrides, metadata: topLevelMetadata }
        : rawOverrides;

      const ref = db.collection(ADMIN_INSTANCES).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }
      const existing = doc.data() as any;

      // Merge incoming overrides on top of stored overrides (object-level merge)
      const mergedOverrides = { ...existing.overrides, ...incomingOverrides };

      // Single source of truth for resolved state
      const resolved = resolveInstance(existing.baseSnapshot, mergedOverrides);

      const update: Record<string, any> = {
        overrides:  mergedOverrides,
        resolved,
        version:    (existing.version ?? 1) + 1,
        updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
        updatedBy:  req.user?.uid ?? 'system',
      };
      if (status !== undefined) update.status = status;

      // Listing controls — stored at top level, not inside overrides
      if (enabledColors !== undefined) update.enabledColors = enabledColors;
      if (enabledSizes  !== undefined) update.enabledSizes  = enabledSizes;
      if (customerPrice !== undefined) update.customerPrice = customerPrice;

      // Folder move — allowlisted keys written to top level atomically
      if (folderUpdate) {
        const allowed = ['storeId','storeName','channelId','channelName','collectionId','collectionName','folderPath'];
        for (const key of allowed) {
          if (folderUpdate[key] !== undefined) update[key] = folderUpdate[key];
        }
      }

      await ref.update(update);
      console.log(`[AdminInstances] Updated ${req.params.id} → v${update.version}`);
      res.json({ success: true, instanceId: req.params.id, resolved, version: update.version });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── DELETE /admin/catalog-instances/:id ─────────────────────────────────────
  // Soft-deletes so the public store immediately hides the item without losing data.
  app.delete('/admin/catalog-instances/:id', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const ref = db.collection(ADMIN_INSTANCES).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }
      const now = admin.firestore.FieldValue.serverTimestamp();
      await ref.update({
        isVisible: false,
        status: 'deleted',
        deletedAt: now,
        deletedBy: req.user?.uid ?? 'system',
        updatedAt: now,
        updatedBy: req.user?.uid ?? 'system',
      });
      // Best-effort: clean up matching legacy storeProductLinks
      try {
        const instance = doc.data() as any;
        const toDelete: FirebaseFirestore.DocumentReference[] = [];

        // Match by instanceId (set on links created after instance-linking was added)
        const byInstanceId = await db.collection('storeProductLinks')
          .where('instanceId', '==', req.params.id)
          .get();
        byInstanceId.docs.forEach(d => toDelete.push(d.ref));

        // Also match by packetId for links created before instanceId was stored
        if (instance.currentPacketId) {
          const byPacketId = await db.collection('storeProductLinks')
            .where('packetId', '==', instance.currentPacketId)
            .get();
          byPacketId.docs.forEach(d => {
            if (!toDelete.find(r => r.id === d.id)) toDelete.push(d.ref);
          });
        }

        if (toDelete.length > 0) {
          const batch = db.batch();
          toDelete.forEach(ref => batch.delete(ref));
          await batch.commit();
          console.log(`[AdminInstances] Removed ${toDelete.length} legacy storeProductLink(s) for instance ${req.params.id}`);
        }
      } catch (_) { /* non-fatal */ }
      console.log(`[AdminInstances] Soft-deleted ${req.params.id}`);
      res.json({ success: true, instanceId: req.params.id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /admin/catalog-instances/:id/create-packet ─────────────────────────
  // Create or update a packet attached to this admin instance.
  // The packet is an artifact — it carries full lineage.
  app.post('/admin/catalog-instances/:id/create-packet', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { id }       = req.params;
      const packetFields = req.body;

      const instanceRef = db.collection(ADMIN_INSTANCES).doc(id);
      const instanceDoc = await instanceRef.get();
      if (!instanceDoc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }

      const instance = instanceDoc.data() as any;
      const resolved = instance.resolved ?? {};
      const now      = admin.firestore.FieldValue.serverTimestamp();

      const packetData = stripUndef({
        // ── Lineage — mandatory on every packet ────────────────────────────
        ownerType:             'admin',
        ownerInstanceId:       id,
        sourceMasterId:        instance.sourceMasterId,
        sourceAdminInstanceId: id,
        sourceMemberInstanceId: null,

        // ── Effective identity from resolved state ──────────────────────────
        effectiveTitle:       resolved.title       ?? null,
        effectiveDescription: resolved.description ?? null,
        productImageUrl:      resolved.images?.[0]?.url ?? resolved.images?.[0] ?? null,
        category:             resolved.category    ?? null,
        colors:               resolved.colors      ?? [],
        sizes:                resolved.sizes       ?? [],
        blueprintId:          instance.baseSnapshot?.printifyBlueprintId ?? null,

        // ── Caller-supplied packet fields (QR, graphics, layout, etc.) ──────
        ...packetFields,

        updatedAt: now,
        updatedBy: req.user?.uid ?? 'system',
      });

      let packetId: string;
      if (instance.currentPacketId) {
        // Update existing packet
        const { createdAt: _omit, createdBy: _omit2, ...updateFields } = packetData;
        await db.collection(PACKETS).doc(instance.currentPacketId).update({ ...updateFields, updatedAt: now });
        packetId = instance.currentPacketId;
      } else {
        // Create new packet
        packetData.createdAt = now;
        packetData.createdBy = req.user?.uid ?? 'system';
        const packetRef = await db.collection(PACKETS).add(packetData);
        packetId = packetRef.id;
      }

      // Write packet reference back onto the instance
      await instanceRef.update({
        currentPacketId: packetId,
        updatedAt:       now,
        updatedBy:       req.user?.uid ?? 'system',
        version:         admin.firestore.FieldValue.increment(1),
      });

      console.log(`[AdminInstances] Packet ${packetId} linked to instance ${id}`);
      res.json({ success: true, packetId, instanceId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /admin/catalog-instances/:id/requeue-mockups ───────────────────────
  // Re-queue mockup generation for an existing instance's packet.
  // Use this to fix instances that were created before the mockupsByColor
  // write-back fix, or when colors are added/changed on an existing instance.
  app.post('/admin/catalog-instances/:id/requeue-mockups', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { id } = req.params;
      const { colors: requestedColors } = req.body; // optional: specific colors to re-queue

      const instanceDoc = await db.collection(ADMIN_INSTANCES).doc(id).get();
      if (!instanceDoc.exists) { res.status(404).json({ error: 'Instance not found' }); return; }

      const instance = instanceDoc.data() as any;
      if (!instance.currentPacketId) {
        res.status(400).json({ error: 'Instance has no linked packet. Create a packet first via /create-packet.' });
        return;
      }

      const packetDoc = await db.collection(PACKETS).doc(instance.currentPacketId).get();
      if (!packetDoc.exists) { res.status(404).json({ error: 'Packet not found' }); return; }

      const packet = packetDoc.data() as any;
      const artworkUrl: string | null = packet.artworkUrl || packet.compositeUrl || packet.productGraphicUrl || null;
      if (!artworkUrl) {
        res.status(400).json({ error: 'Packet has no artworkUrl. Upload artwork to the packet before generating mockups.' });
        return;
      }

      const blueprintId: number | null = packet.blueprintId || instance.baseSnapshot?.printifyBlueprintId || null;
      if (!blueprintId) {
        res.status(400).json({ error: 'Packet has no blueprintId. Link a blueprint before generating mockups.' });
        return;
      }

      const printProviderId: number = packet.printProviderId || 39;
      const fulfillmentProvider: string = packet.fulfillmentProvider || 'printify';

      // Resolve color list: caller override → packet colors → instance enabledColors → resolved colors
      const rawColors: any[] = packet.colors || packet.enabledColors || instance.enabledColors || instance.resolved?.colors || [];
      const allColors: Array<{ name: string; hex: string }> = rawColors.map((c: any) =>
        typeof c === 'string' ? { name: c, hex: '#000000' } : { name: c.name || c.label || String(c), hex: c.hex || c.color || '#000000' }
      ).filter((c: any) => c.name);

      const colorsToQueue = requestedColors?.length
        ? allColors.filter(c => requestedColors.includes(c.name))
        : allColors;

      if (colorsToQueue.length === 0) {
        res.status(400).json({ error: 'No colors found to generate mockups for.' });
        return;
      }

      const productIdForMockups = `packet_${instance.currentPacketId}`;
      const placements = ['front'];
      const qrSizes = ['small', 'medium', 'large'];
      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();
      let jobsQueued = 0;

      for (const color of colorsToQueue) {
        for (const placement of placements) {
          for (const qrSize of qrSizes) {
            const jobRef = db.collection('mockup_jobs').doc();
            batch.set(jobRef, {
              productId: productIdForMockups,
              colorName: color.name,
              colorHex: color.hex,
              qrSize,
              placement,
              jobData: {
                blueprintId,
                printProviderId,
                artworkUrl,
                artworkVariant: 'black',
                fulfillmentProvider,
              },
              status: 'pending',
              priority: jobsQueued,
              attempts: 0,
              maxAttempts: 5,
              createdAt: now,
              updatedAt: now,
            });
            jobsQueued++;
          }
        }
      }
      await batch.commit();
      console.log(`[AdminInstances] Queued ${jobsQueued} mockup jobs for instance ${id} / packet ${instance.currentPacketId}`);

      res.json({
        success: true,
        instanceId: id,
        packetId: instance.currentPacketId,
        jobsQueued,
        colors: colorsToQueue.map(c => c.name),
        message: `Queued ${jobsQueued} mockup jobs for ${colorsToQueue.length} color(s). Jobs will process in the background.`,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /admin/catalog-instances/:id/push-to-member ────────────────────────
  // Derive a member_library_instance from an admin instance.
  // Admin instance is NEVER mutated here.
  app.post('/admin/catalog-instances/:id/push-to-member', requireAdmin, async (req: any, res: any): Promise<void> => {
    try {
      const { id }                 = req.params;
      const { memberId, libraryId } = req.body;
      if (!memberId) { res.status(400).json({ error: 'memberId is required' }); return; }

      const instanceDoc = await db.collection(ADMIN_INSTANCES).doc(id).get();
      if (!instanceDoc.exists) { res.status(404).json({ error: 'Admin instance not found' }); return; }

      const instance   = instanceDoc.data() as any;
      const now        = admin.firestore.FieldValue.serverTimestamp();
      const baseSnapshot = { ...instance.resolved };
      const overrides    = {};
      const resolved     = resolveInstance(baseSnapshot, overrides);

      const memberData = {
        instanceType:          'member' as const,
        sourceMasterId:        instance.sourceMasterId,
        sourceAdminInstanceId: id,
        ownerMemberId:         memberId,
        libraryId:             libraryId ?? null,
        baseSnapshot,
        overrides,
        resolved,
        currentPacketId:       null,
        currentTemplateId:     null,
        currentGraphicSetId:   null,
        status:                'draft' as const,
        version:               1,
        createdAt:             now,
        updatedAt:             now,
        createdBy:             req.user?.uid ?? 'system',
        updatedBy:             req.user?.uid ?? 'system',
      };

      const memberRef = await db.collection(MEMBER_INSTANCES).add(memberData);
      console.log(`[AdminInstances] Pushed ${id} → member instance ${memberRef.id} for ${memberId}`);
      res.json({
        success:          true,
        memberInstanceId: memberRef.id,
        adminInstanceId:  id,
        sourceMasterId:   instance.sourceMasterId,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
