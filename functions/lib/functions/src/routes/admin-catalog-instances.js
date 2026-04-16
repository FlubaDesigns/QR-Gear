"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const instance_resolver_1 = require("../services/instance-resolver");
const ADMIN_INSTANCES = 'admin_catalog_instances';
const MASTER_CATALOG = 'master_catalog';
const MEMBER_INSTANCES = 'member_library_instances';
const PACKETS = 'productPackets';
function toSerializable(doc) {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.() ?? null,
        assignedAt: data.assignedAt?.toDate?.() ?? null,
    };
}
function register(app) {
    // ── GET /admin/catalog-instances ────────────────────────────────────────────
    app.get('/admin/catalog-instances', middleware_1.requireAdmin, async (req, res) => {
        try {
            let q = core_1.db.collection(ADMIN_INSTANCES).orderBy('createdAt', 'desc');
            if (req.query.catalogId)
                q = q.where('catalogId', '==', req.query.catalogId);
            if (req.query.sourceMasterId)
                q = q.where('sourceMasterId', '==', req.query.sourceMasterId);
            if (req.query.status)
                q = q.where('status', '==', req.query.status);
            const snap = await q.limit(200).get();
            const instances = snap.docs.map(toSerializable);
            res.json({ success: true, instances, count: instances.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── GET /admin/catalog-instances/:id ────────────────────────────────────────
    app.get('/admin/catalog-instances/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection(ADMIN_INSTANCES).doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            res.json({ success: true, instance: toSerializable(doc) });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── POST /admin/catalog-instances/from-master ────────────────────────────────
    // Clone a master catalog item into a new admin instance.
    // Master doc is NEVER touched.
    app.post('/admin/catalog-instances/from-master', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { sourceMasterId, catalogId } = req.body;
            if (!sourceMasterId) {
                res.status(400).json({ error: 'sourceMasterId is required' });
                return;
            }
            if (!catalogId) {
                res.status(400).json({ error: 'catalogId is required' });
                return;
            }
            const masterDoc = await core_1.db.collection(MASTER_CATALOG).doc(sourceMasterId).get();
            if (!masterDoc.exists) {
                res.status(404).json({ error: `Master catalog item not found: ${sourceMasterId}` });
                return;
            }
            const master = masterDoc.data();
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            // Normalize images into ImageRecord[] at creation time
            const normalizedImages = (0, instance_resolver_1.mergeImagesByUrl)(master.images ?? [], []);
            // Normalize master colors to strings — master_catalog stores {name, hex} objects
            const normalizedColors = (master.colors ?? [])
                .map((c) => (typeof c === 'string' ? c : (c?.name ?? c?.hex ?? '')))
                .filter(Boolean);
            const baseSnapshot = {
                title: master.title ?? '',
                description: master.description ?? null,
                images: normalizedImages,
                brand: master.brand ?? null,
                colors: normalizedColors,
                sizes: master.sizes ?? [],
                category: master.category ?? null,
                originCountry: master.originCountry ?? null,
                minPrice: master.minPrice ?? null,
                maxPrice: master.maxPrice ?? null,
                printifyBlueprintId: master.printifyBlueprintId ?? null,
                printfulProductId: master.printfulProductId ?? null,
            };
            const overrides = {};
            const resolved = (0, instance_resolver_1.resolveInstance)(baseSnapshot, overrides);
            const instanceData = {
                instanceType: 'admin',
                sourceMasterId,
                catalogId,
                ownerAdminId: req.user?.uid ?? null,
                assignedAt: now,
                baseSnapshot,
                overrides,
                resolved,
                currentPacketId: null,
                currentTemplateId: null,
                currentGraphicSetId: null,
                status: 'draft',
                version: 1,
                createdAt: now,
                updatedAt: now,
                createdBy: req.user?.uid ?? 'system',
                updatedBy: req.user?.uid ?? 'system',
            };
            const ref = await core_1.db.collection(ADMIN_INSTANCES).add(instanceData);
            console.log(`[AdminInstances] Created ${ref.id} from master ${sourceMasterId}`);
            res.json({ success: true, instanceId: ref.id, sourceMasterId });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── PATCH /admin/catalog-instances/:id ──────────────────────────────────────
    // Save admin overrides. resolveInstance is recomputed. Master is NEVER touched.
    app.patch('/admin/catalog-instances/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            // Callers may pass overrides directly, or include metadata inside overrides.
            // metadata as a top-level convenience param is folded into overrides so
            // resolveInstance always sees the full picture.
            const { overrides: rawOverrides = {}, status } = req.body;
            const topLevelMetadata = req.body.metadata;
            const incomingOverrides = topLevelMetadata !== undefined
                ? { ...rawOverrides, metadata: topLevelMetadata }
                : rawOverrides;
            const ref = core_1.db.collection(ADMIN_INSTANCES).doc(req.params.id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            const existing = doc.data();
            // Merge incoming overrides on top of stored overrides (object-level merge)
            const mergedOverrides = { ...existing.overrides, ...incomingOverrides };
            // Single source of truth for resolved state — resolveInstance handles metadata
            const resolved = (0, instance_resolver_1.resolveInstance)(existing.baseSnapshot, mergedOverrides);
            const update = {
                overrides: mergedOverrides,
                resolved,
                version: (existing.version ?? 1) + 1,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: req.user?.uid ?? 'system',
            };
            if (status !== undefined)
                update.status = status;
            await ref.update(update);
            console.log(`[AdminInstances] Updated ${req.params.id} → v${update.version}`);
            res.json({ success: true, instanceId: req.params.id, resolved, version: update.version });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── POST /admin/catalog-instances/:id/create-packet ─────────────────────────
    // Create or update a packet attached to this admin instance.
    // The packet is an artifact — it carries full lineage.
    app.post('/admin/catalog-instances/:id/create-packet', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const packetFields = req.body;
            const instanceRef = core_1.db.collection(ADMIN_INSTANCES).doc(id);
            const instanceDoc = await instanceRef.get();
            if (!instanceDoc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            const instance = instanceDoc.data();
            const resolved = instance.resolved ?? {};
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const packetData = (0, core_1.stripUndef)({
                // ── Lineage — mandatory on every packet ────────────────────────────
                ownerType: 'admin',
                ownerInstanceId: id,
                sourceMasterId: instance.sourceMasterId,
                sourceAdminInstanceId: id,
                sourceMemberInstanceId: null,
                // ── Effective identity from resolved state ──────────────────────────
                effectiveTitle: resolved.title ?? null,
                effectiveDescription: resolved.description ?? null,
                productImageUrl: resolved.images?.[0]?.url ?? resolved.images?.[0] ?? null,
                category: resolved.category ?? null,
                colors: resolved.colors ?? [],
                sizes: resolved.sizes ?? [],
                blueprintId: instance.baseSnapshot?.printifyBlueprintId ?? null,
                // ── Caller-supplied packet fields (QR, graphics, layout, etc.) ──────
                ...packetFields,
                updatedAt: now,
                updatedBy: req.user?.uid ?? 'system',
            });
            let packetId;
            if (instance.currentPacketId) {
                // Update existing packet
                const { createdAt: _omit, createdBy: _omit2, ...updateFields } = packetData;
                await core_1.db.collection(PACKETS).doc(instance.currentPacketId).update({ ...updateFields, updatedAt: now });
                packetId = instance.currentPacketId;
            }
            else {
                // Create new packet
                packetData.createdAt = now;
                packetData.createdBy = req.user?.uid ?? 'system';
                const packetRef = await core_1.db.collection(PACKETS).add(packetData);
                packetId = packetRef.id;
            }
            // Write packet reference back onto the instance
            await instanceRef.update({
                currentPacketId: packetId,
                updatedAt: now,
                updatedBy: req.user?.uid ?? 'system',
                version: core_1.admin.firestore.FieldValue.increment(1),
            });
            console.log(`[AdminInstances] Packet ${packetId} linked to instance ${id}`);
            res.json({ success: true, packetId, instanceId: id });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── POST /admin/catalog-instances/:id/push-to-member ────────────────────────
    // Derive a member_library_instance from an admin instance.
    // Admin instance is NEVER mutated here.
    app.post('/admin/catalog-instances/:id/push-to-member', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { memberId, libraryId } = req.body;
            if (!memberId) {
                res.status(400).json({ error: 'memberId is required' });
                return;
            }
            const instanceDoc = await core_1.db.collection(ADMIN_INSTANCES).doc(id).get();
            if (!instanceDoc.exists) {
                res.status(404).json({ error: 'Admin instance not found' });
                return;
            }
            const instance = instanceDoc.data();
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const baseSnapshot = { ...instance.resolved };
            const overrides = {};
            const resolved = (0, instance_resolver_1.resolveInstance)(baseSnapshot, overrides);
            const memberData = {
                instanceType: 'member',
                sourceMasterId: instance.sourceMasterId,
                sourceAdminInstanceId: id,
                ownerMemberId: memberId,
                libraryId: libraryId ?? null,
                baseSnapshot,
                overrides,
                resolved,
                currentPacketId: null,
                currentTemplateId: null,
                currentGraphicSetId: null,
                status: 'draft',
                version: 1,
                createdAt: now,
                updatedAt: now,
                createdBy: req.user?.uid ?? 'system',
                updatedBy: req.user?.uid ?? 'system',
            };
            const memberRef = await core_1.db.collection(MEMBER_INSTANCES).add(memberData);
            console.log(`[AdminInstances] Pushed ${id} → member instance ${memberRef.id} for ${memberId}`);
            res.json({
                success: true,
                memberInstanceId: memberRef.id,
                adminInstanceId: id,
                sourceMasterId: instance.sourceMasterId,
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=admin-catalog-instances.js.map