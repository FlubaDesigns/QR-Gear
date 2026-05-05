"use strict";
/**
 * functions/src/routes/bld.ts
 *
 * BLD (Build Definition Schema) — admin-only API routes.
 *
 * POST /admin/bld
 *   Write a BLD definition + instances sub-collection from a builder
 *   working-state snapshot. Called by the commit flow in admin-build-sessions.ts
 *   after a QRG instance is allocated.
 *
 * POST /admin/bld/create
 *   Admin direct-create: accepts { context, layout, name, instances[] }.
 *   Writes a flat bld_definitions doc (instances embedded in the doc, not a sub-collection).
 *
 * GET /admin/bld
 *   List all BLD definitions (both builder-generated and admin-created).
 *
 * GET /admin/bld/:bldId
 *   Fetch a BLD header document.
 *
 * GET /admin/bld/:bldId/instances
 *   Fetch all ordered instance documents for a BLD (sub-collection — builder-generated only).
 *
 * PATCH /admin/bld/:bldId
 *   Update name and/or flat instances array on an admin-created BLD.
 *
 * DELETE /admin/bld/:bldId
 *   Permanently delete a BLD definition.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBld = registerBld;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const bld_builder_1 = require("../services/bld-builder");
const qrgCodes_1 = require("../../../shared/qrgCodes");
const BLD_DEFINITIONS_COLLECTION = 'bld_definitions';
const BLD_COUNTERS_COLLECTION = 'bld_counters';
const VALID_CONTEXTS = ['S', 'U'];
const VALID_LAYOUTS = ['Z', 'P'];
const VALID_TYPES = ['txt', 'img', 'qrc', 'act', 'vid', 'doc'];
function convertTimestamps(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && typeof v.toDate === 'function') {
            out[k] = v.toDate().toISOString();
        }
        else if (Array.isArray(v)) {
            out[k] = v.map(item => item && typeof item === 'object' ? convertTimestamps(item) : item);
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
async function incrementCounter(key, context, layout) {
    const ref = core_1.db.collection(BLD_COUNTERS_COLLECTION).doc(key);
    let count = 0;
    await core_1.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            count = 1;
            tx.set(ref, { count: 1, key, context, layout, createdAt: core_1.admin.firestore.FieldValue.serverTimestamp() });
        }
        else {
            count = (snap.data().count || 0) + 1;
            tx.update(ref, { count, updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp() });
        }
    });
    return count;
}
function registerBld(app) {
    // ── GET /admin/bld ────────────────────────────────────────────────────────
    // List all BLD definitions; optionally filter by ?context=S&layout=Z
    // MUST be registered before /admin/bld/:bldId to avoid route collision.
    app.get('/admin/bld', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { context, layout } = req.query;
            const snap = await core_1.db.collection(BLD_DEFINITIONS_COLLECTION).orderBy('createdAt', 'desc').get();
            let defs = snap.docs.map(doc => {
                const d = doc.data();
                const converted = convertTimestamps(d);
                return {
                    id: doc.id,
                    ...converted,
                    // Normalise: builder docs use `layoutMode`, admin-direct docs use `layout`
                    layout: converted.layout ?? converted.layoutMode ?? null,
                    // Normalise instance count
                    instanceCount: typeof converted.instanceCount === 'number'
                        ? converted.instanceCount
                        : (Array.isArray(converted.instances) ? converted.instances.length : 0),
                    source: converted.graphicLayoutMode !== undefined ? 'builder' : 'admin',
                };
            });
            if (context)
                defs = defs.filter(d => d.context === context);
            if (layout)
                defs = defs.filter(d => d.layout === layout);
            res.json({ success: true, definitions: defs, count: defs.length });
        }
        catch (err) {
            console.error('[BLD] GET /admin/bld error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── POST /admin/bld/create ────────────────────────────────────────────────
    // Admin direct-create: { context, layout, name?, instances[] }
    // Instances are stored as an embedded array on the doc (not a sub-collection).
    // MUST be registered before /admin/bld/:bldId.
    app.post('/admin/bld/create', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { context, layout, name, instances = [] } = req.body;
            if (!context || !layout) {
                res.status(400).json({ error: 'Missing required fields: context, layout' });
                return;
            }
            if (!VALID_CONTEXTS.includes(context)) {
                res.status(400).json({ error: `Invalid context. Must be one of: ${VALID_CONTEXTS.join(', ')}` });
                return;
            }
            if (!VALID_LAYOUTS.includes(layout)) {
                res.status(400).json({ error: `Invalid layout. Must be one of: ${VALID_LAYOUTS.join(', ')}` });
                return;
            }
            // U-context uses layout modes I/V/D (reserved, not yet implemented).
            // Z and P are S-context only. Reject the cross-contamination.
            if (context === 'U' && (layout === 'Z' || layout === 'P')) {
                res.status(400).json({ error: `Layout "${layout}" is only valid for S-context BLDs. U-context layout modes (I, V, D) are reserved.` });
                return;
            }
            if (!Array.isArray(instances)) {
                res.status(400).json({ error: 'instances must be an array' });
                return;
            }
            for (const inst of instances) {
                if (!inst.seq || !inst.type) {
                    res.status(400).json({ error: 'Each instance must have seq and type' });
                    return;
                }
                if (!VALID_TYPES.includes(inst.type)) {
                    res.status(400).json({ error: `Invalid instance type "${inst.type}". Must be one of: ${VALID_TYPES.join(', ')}` });
                    return;
                }
            }
            const counterKey = `${context}${layout}`;
            const buildSeq = await incrementCounter(counterKey, context, layout);
            const seqPadded = String(buildSeq).padStart(3, '0');
            const instanceCount = instances.length;
            const bldId = `BLD-${context}${layout}${instanceCount}-${seqPadded}`;
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const defData = {
                bldId,
                context,
                layout,
                name: name || bldId,
                instances,
                instanceCount,
                buildSequence: buildSeq,
                source: 'admin',
                createdAt: now,
                updatedAt: now,
                isActive: true,
            };
            await core_1.db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).set(defData);
            const created = await core_1.db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).get();
            const out = convertTimestamps(created.data());
            console.log(`[BLD] Admin-created ${bldId} with ${instanceCount} instances`);
            res.json({ success: true, bldId, definition: { id: created.id, ...out } });
        }
        catch (err) {
            console.error('[BLD] POST /admin/bld/create error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── POST /admin/bld ───────────────────────────────────────────────────────
    // Write a new BLD definition from a builder working-state snapshot.
    app.post('/admin/bld', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { working, sourceSessionId, sourceInstanceId, qrgBlankId, qrgBaseCode, packetId, } = req.body;
            if (!working || typeof working !== 'object') {
                res.status(400).json({ error: 'working (builder snapshot) is required' });
                return;
            }
            if (!qrgBlankId) {
                res.status(400).json({ error: 'qrgBlankId is required — a BLD must be linked to a valid QRG blank at creation time' });
                return;
            }
            if (!(0, qrgCodes_1.isValidQrgBlankId)(String(qrgBlankId))) {
                res.status(400).json({ error: `qrgBlankId "${qrgBlankId}" is not a valid STNNN blank ID (S=1-6, T=1-9, NNN=000-999)` });
                return;
            }
            const result = await (0, bld_builder_1.writeBldDefinition)({
                working,
                sourceSessionId: sourceSessionId || null,
                sourceInstanceId: sourceInstanceId || null,
                qrgBlankId: qrgBlankId || null,
                qrgBaseCode: qrgBaseCode || null,
                packetId: packetId || null,
            });
            res.json({
                success: true,
                bldId: result.bldId,
                instanceCount: result.instanceCount,
                buildSequence: result.buildSequence,
            });
        }
        catch (err) {
            console.error('[BLD] POST /admin/bld error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── GET /admin/bld/:bldId ─────────────────────────────────────────────────
    app.get('/admin/bld/:bldId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { bldId } = req.params;
            const doc = await core_1.db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).get();
            if (!doc.exists) {
                res.status(404).json({ error: `BLD not found: ${bldId}` });
                return;
            }
            const d = doc.data();
            res.json({
                success: true,
                bld: {
                    id: doc.id,
                    ...d,
                    createdAt: d.createdAt?.toDate?.() || null,
                    updatedAt: d.updatedAt?.toDate?.() || null,
                },
            });
        }
        catch (err) {
            console.error('[BLD] GET /admin/bld/:bldId error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── GET /admin/bld/:bldId/instances ───────────────────────────────────────
    app.get('/admin/bld/:bldId/instances', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { bldId } = req.params;
            const snap = await core_1.db
                .collection(BLD_DEFINITIONS_COLLECTION)
                .doc(bldId)
                .collection('instances')
                .orderBy('seq', 'asc')
                .get();
            const instances = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            res.json({ success: true, bldId, instances, count: instances.length });
        }
        catch (err) {
            console.error('[BLD] GET /admin/bld/:bldId/instances error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── PATCH /admin/bld/:bldId ───────────────────────────────────────────────
    // Update name and/or flat instances array on an admin-created BLD definition.
    app.patch('/admin/bld/:bldId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { bldId } = req.params;
            const { name, instances } = req.body;
            const docRef = core_1.db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: `BLD definition not found: ${bldId}` });
                return;
            }
            const updates = {
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            };
            if (name !== undefined) {
                updates.name = name;
            }
            if (instances !== undefined) {
                if (!Array.isArray(instances)) {
                    res.status(400).json({ error: 'instances must be an array' });
                    return;
                }
                for (const inst of instances) {
                    if (!inst.seq || !inst.type) {
                        res.status(400).json({ error: 'Each instance must have seq and type' });
                        return;
                    }
                    if (!VALID_TYPES.includes(inst.type)) {
                        res.status(400).json({ error: `Invalid instance type "${inst.type}". Must be one of: ${VALID_TYPES.join(', ')}` });
                        return;
                    }
                }
                updates.instances = instances;
                updates.instanceCount = instances.length;
            }
            await docRef.update(updates);
            const updated = await docRef.get();
            const out = convertTimestamps(updated.data());
            console.log(`[BLD] Updated ${bldId}`);
            res.json({ success: true, definition: { id: updated.id, ...out } });
        }
        catch (err) {
            console.error('[BLD] PATCH /admin/bld/:bldId error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // ── DELETE /admin/bld/:bldId ──────────────────────────────────────────────
    // Permanently delete a BLD definition document.
    // Blocks if any Assembly references this bldId (Fix 7).
    // Cascades to sub-collection instances before deleting header (Fix 6).
    app.delete('/admin/bld/:bldId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { bldId } = req.params;
            const docRef = core_1.db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
            const doc = await docRef.get();
            if (!doc.exists) {
                res.status(404).json({ error: `BLD definition not found: ${bldId}` });
                return;
            }
            // Fix 7: Block delete if any Assembly references this bldId
            const asmSnap = await core_1.db.collection('assemblies').where('bldId', '==', bldId).limit(10).get();
            if (!asmSnap.empty) {
                const referencingIds = asmSnap.docs.map(d => d.id);
                res.status(409).json({
                    error: `Cannot delete BLD "${bldId}" — it is referenced by ${asmSnap.size} Assembly record(s). Unlink or delete those assemblies first.`,
                    referencingAssemblyIds: referencingIds,
                });
                return;
            }
            // Fix 6: Delete sub-collection instances before deleting the header doc.
            // Firestore does not auto-delete sub-collections.
            const instancesSnap = await docRef.collection('instances').get();
            if (!instancesSnap.empty) {
                const batch = core_1.db.batch();
                instancesSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`[BLD] Deleted ${instancesSnap.size} sub-collection instances for ${bldId}`);
            }
            await docRef.delete();
            console.log(`[BLD] Deleted ${bldId}`);
            res.json({ success: true, bldId, instancesDeleted: instancesSnap.size });
        }
        catch (err) {
            console.error('[BLD] DELETE /admin/bld/:bldId error:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
}
//# sourceMappingURL=bld.js.map