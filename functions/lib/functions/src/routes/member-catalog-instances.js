"use strict";
/**
 * Member Catalog Instances — Production Routes
 *
 * Member instances are derived from admin instances.
 * Members can customize their own copy without mutating:
 *   - the master catalog
 *   - the admin instance it was derived from
 *
 * Lineage is always preserved:
 *   sourceMasterId + sourceAdminInstanceId on every member instance and its packets.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const MEMBER_INSTANCES = 'member_library_instances';
const PACKETS = 'productPackets';
function resolveFields(base, overrides) {
    const resolved = { ...base };
    for (const [k, v] of Object.entries(overrides)) {
        if (v !== null && v !== undefined && v !== '')
            resolved[k] = v;
    }
    return resolved;
}
function register(app) {
    // ── List member instances (own, or all if admin) ─────────────────────────
    app.get('/member/catalog-instances', middleware_1.requireAuth, async (req, res) => {
        try {
            const uid = req.user?.uid;
            const isAdmin = req.user?.admin === true;
            let q = core_1.db.collection(MEMBER_INSTANCES).orderBy('createdAt', 'desc');
            if (!isAdmin) {
                q = q.where('ownerMemberId', '==', uid);
            }
            else if (req.query.memberId) {
                q = q.where('ownerMemberId', '==', req.query.memberId);
            }
            if (req.query.sourceAdminInstanceId)
                q = q.where('sourceAdminInstanceId', '==', req.query.sourceAdminInstanceId);
            const snap = await q.limit(200).get();
            const instances = snap.docs.map((d) => {
                const data = d.data();
                return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null };
            });
            res.json({ success: true, instances, count: instances.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── Get single member instance ───────────────────────────────────────────
    app.get('/member/catalog-instances/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            const doc = await core_1.db.collection(MEMBER_INSTANCES).doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            const data = doc.data();
            const uid = req.user?.uid;
            if (req.user?.admin !== true && data.ownerMemberId !== uid) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            res.json({ success: true, instance: { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null } });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── Save member overrides — NEVER touches admin instance or master ─────────
    app.patch('/member/catalog-instances/:id', middleware_1.requireAuth, async (req, res) => {
        try {
            const { overrides, metadata, status } = req.body;
            const ref = core_1.db.collection(MEMBER_INSTANCES).doc(req.params.id);
            const doc = await ref.get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            const existing = doc.data();
            if (req.user?.admin !== true && existing.ownerMemberId !== req.user?.uid) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            const mergedOverrides = { ...existing.overrides, ...overrides };
            const resolved = resolveFields(existing.baseSnapshot, mergedOverrides);
            const update = {
                overrides: mergedOverrides,
                resolved,
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            };
            if (metadata !== undefined)
                update.metadata = metadata;
            if (status !== undefined)
                update.status = status;
            await ref.update(update);
            res.json({ success: true, instanceId: req.params.id, resolved });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── Create or update packet from member instance ──────────────────────────
    // Packet is an attached artifact. Lineage is written back onto the instance.
    app.post('/member/catalog-instances/:id/create-packet', middleware_1.requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const packetFields = req.body;
            const instanceRef = core_1.db.collection(MEMBER_INSTANCES).doc(id);
            const instanceDoc = await instanceRef.get();
            if (!instanceDoc.exists) {
                res.status(404).json({ error: 'Instance not found' });
                return;
            }
            const instance = instanceDoc.data();
            if (req.user?.admin !== true && instance.ownerMemberId !== req.user?.uid) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const packetData = (0, core_1.stripUndef)({
                // Lineage — mandatory
                ownerType: 'member',
                ownerInstanceId: id,
                sourceMasterId: instance.sourceMasterId,
                sourceAdminInstanceId: instance.sourceAdminInstanceId,
                sourceMemberInstanceId: id,
                // Identity from member resolved state
                masterTitle: instance.baseSnapshot?.title || null,
                effectiveTitle: instance.resolved?.title || instance.baseSnapshot?.title || null,
                masterDescription: instance.baseSnapshot?.description || null,
                effectiveDescription: instance.resolved?.description || instance.baseSnapshot?.description || null,
                productImageUrl: instance.resolved?.images?.[0] || null,
                category: instance.resolved?.category || null,
                colors: instance.resolved?.colors || [],
                sizes: instance.resolved?.sizes || [],
                // Caller-supplied packet fields
                ...packetFields,
                updatedAt: now,
            });
            let packetId;
            if (instance.currentPacketId) {
                const { createdAt: _omit, ...updateFields } = packetData;
                await core_1.db.collection(PACKETS).doc(instance.currentPacketId).update({ ...updateFields, updatedAt: now });
                packetId = instance.currentPacketId;
            }
            else {
                packetData.createdAt = now;
                const packetRef = await core_1.db.collection(PACKETS).add(packetData);
                packetId = packetRef.id;
            }
            await instanceRef.update({ currentPacketId: packetId, updatedAt: now });
            console.log(`[MemberInstances] Packet ${packetId} linked to member instance ${id}`);
            res.json({ success: true, packetId, instanceId: id });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ── Admin: view all member instances across all members ───────────────────
    app.get('/admin/member-catalog-instances', middleware_1.requireAdmin, async (req, res) => {
        try {
            let q = core_1.db.collection(MEMBER_INSTANCES).orderBy('createdAt', 'desc');
            if (req.query.memberId)
                q = q.where('ownerMemberId', '==', req.query.memberId);
            if (req.query.sourceAdminInstanceId)
                q = q.where('sourceAdminInstanceId', '==', req.query.sourceAdminInstanceId);
            const snap = await q.limit(200).get();
            const instances = snap.docs.map((d) => {
                const data = d.data();
                return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null };
            });
            res.json({ success: true, instances, count: instances.length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=member-catalog-instances.js.map