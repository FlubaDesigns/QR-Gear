/**
 * functions/src/routes/bld.ts
 *
 * BLD (Build Definition Schema) — admin-only API routes.
 *
 * All BLDs use a single storage shape: instances[] embedded as a flat array
 * in the root bld_definitions doc. No sub-collections. No dual strategies.
 *
 * POST /admin/bld
 *   Write a BLD definition from a builder working-state snapshot.
 *   Called by the commit flow in admin-build-sessions.ts.
 *
 * POST /admin/bld/create
 *   Admin direct-create: accepts { context, layout, name, instances[] }.
 *
 * GET /admin/bld
 *   List all BLD definitions.
 *
 * GET /admin/bld/:bldId
 *   Fetch a BLD root document (includes instances[]).
 *
 * GET /admin/bld/:bldId/instances
 *   Fetch the ordered instances array for a BLD (reads from root doc).
 *
 * PATCH /admin/bld/:bldId
 *   Update name and/or instances array on a BLD.
 *
 * DELETE /admin/bld/:bldId
 *   Permanently delete a BLD definition.
 */

import express, { Request, Response } from 'express';
import { db, admin } from '../core';
import { requireAdmin } from '../middleware';
import { writeBldDefinition, WriteBldResult } from '../services/bld-builder';
import { isValidQrgBlankId } from '../../../shared/qrgCodes';

const BLD_DEFINITIONS_COLLECTION = 'bld_definitions';
const BLD_COUNTERS_COLLECTION     = 'bld_counters';

type BldContext      = 'S' | 'U';
type BldLayout       = 'Z' | 'P' | 'I' | 'V' | 'D';
type BldInstanceType = 'txt' | 'img' | 'qrc' | 'act' | 'vid' | 'doc';

const VALID_CONTEXTS: BldContext[]      = ['S', 'U'];
// S-context layouts: Z (Zone), P (Palette)
// U-context layouts: I (Image), V (Video), D (Document)
const S_LAYOUTS: BldLayout[] = ['Z', 'P'];
const U_LAYOUTS: BldLayout[] = ['I', 'V', 'D'];
const VALID_LAYOUTS: BldLayout[] = [...S_LAYOUTS, ...U_LAYOUTS];
const VALID_TYPES:    BldInstanceType[] = ['txt', 'img', 'qrc', 'act', 'vid', 'doc'];

function convertTimestamps(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && typeof v.toDate === 'function') {
      out[k] = v.toDate().toISOString();
    } else if (Array.isArray(v)) {
      out[k] = v.map(item =>
        item && typeof item === 'object' ? convertTimestamps(item) : item
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function incrementCounter(key: string, context: BldContext, layout: BldLayout): Promise<number> {
  const ref = db.collection(BLD_COUNTERS_COLLECTION).doc(key);
  let count = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      count = 1;
      tx.set(ref, { count: 1, key, context, layout, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      count = (snap.data()!.count || 0) + 1;
      tx.update(ref, { count, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  });
  return count;
}

export function registerBld(app: express.Express): void {

  // ── GET /admin/bld ────────────────────────────────────────────────────────
  // List all BLD definitions; optionally filter by ?context=S&layout=Z
  // MUST be registered before /admin/bld/:bldId to avoid route collision.
  app.get('/admin/bld', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { context, layout } = req.query;
      const snap = await db.collection(BLD_DEFINITIONS_COLLECTION).orderBy('createdAt', 'desc').get();
      let defs: Record<string, any>[] = snap.docs.map(doc => {
        const d = doc.data();
        const converted = convertTimestamps(d);
        return {
          id: doc.id,
          ...converted,
          layout: converted.layout ?? converted.layoutMode ?? null,
          instanceCount: typeof converted.instanceCount === 'number'
            ? converted.instanceCount
            : (Array.isArray(converted.instances) ? converted.instances.length : 0),
          source: converted.source ?? 'unknown',
        };
      });
      if (context) defs = defs.filter(d => d.context === context);
      if (layout)  defs = defs.filter(d => d.layout  === layout);
      res.json({ success: true, definitions: defs, count: defs.length });
    } catch (err: any) {
      console.error('[BLD] GET /admin/bld error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /admin/bld/create ────────────────────────────────────────────────
  // Admin direct-create: { context, layout, name?, instances[] }
  // Instances are stored as an embedded array on the doc (not a sub-collection).
  // MUST be registered before /admin/bld/:bldId.
  app.post('/admin/bld/create', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { context, layout, name, instances = [] } = req.body;

      if (!context || !layout) {
        res.status(400).json({ error: 'Missing required fields: context, layout' });
        return;
      }
      if (!VALID_CONTEXTS.includes(context as BldContext)) {
        res.status(400).json({ error: `Invalid context. Must be one of: ${VALID_CONTEXTS.join(', ')}` });
        return;
      }
      if (!VALID_LAYOUTS.includes(layout as BldLayout)) {
        res.status(400).json({ error: `Invalid layout "${layout}". S-context: Z, P. U-context: I, V, D.` });
        return;
      }
      // Canon (BLD.md): S-context only allows Z/P; U-context only allows I/V/D.
      if (context === 'S' && U_LAYOUTS.includes(layout as BldLayout)) {
        res.status(400).json({ error: `Layout "${layout}" is only valid for U-context BLDs. S-context layouts are: Z, P.` });
        return;
      }
      if (context === 'U' && S_LAYOUTS.includes(layout as BldLayout)) {
        res.status(400).json({ error: `Layout "${layout}" is only valid for S-context BLDs. U-context layouts are: I, V, D.` });
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
        if (!VALID_TYPES.includes(inst.type as BldInstanceType)) {
          res.status(400).json({ error: `Invalid instance type "${inst.type}". Must be one of: ${VALID_TYPES.join(', ')}` });
          return;
        }
      }

      const counterKey    = `${context}${layout}` as string;
      const instanceCount = instances.length;

      // Canon (BLD.md): instanceCount is a single digit (0–9). Values above 9 are not supported in BLD v1.
      if (instanceCount > 9) {
        res.status(400).json({ error: `instanceCount ${instanceCount} exceeds maximum of 9 — BLD v1 supports single-digit instance counts only. Split into multiple BLDs if more layers are needed.` });
        return;
      }

      const buildSeq     = await incrementCounter(counterKey, context as BldContext, layout as BldLayout);
      const seqPadded    = String(buildSeq).padStart(3, '0');
      const bldId        = `BLD-${context}${layout}${instanceCount}-${seqPadded}`;

      const now = admin.firestore.FieldValue.serverTimestamp();
      const defData = {
        bldId,
        context,
        layout,
        name:          name || bldId,
        instances,
        instanceCount,
        buildSequence: buildSeq,
        source:        'admin',
        createdAt:     now,
        updatedAt:     now,
        isActive:      true,
      };

      await db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).set(defData);
      const created = await db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).get();
      const out = convertTimestamps(created.data()!);

      console.log(`[BLD] Admin-created ${bldId} with ${instanceCount} instances`);
      res.json({ success: true, bldId, definition: { id: created.id, ...out } });
    } catch (err: any) {
      console.error('[BLD] POST /admin/bld/create error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /admin/bld ───────────────────────────────────────────────────────
  // Write a new BLD definition from a builder working-state snapshot.
  app.post('/admin/bld', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        working,
        sourceSessionId,
        sourceInstanceId,
        qrgBlankId,
        qrgBaseCode,
        packetId,
      } = req.body;

      if (!working || typeof working !== 'object') {
        res.status(400).json({ error: 'working (builder snapshot) is required' });
        return;
      }
      if (!qrgBlankId) {
        res.status(400).json({ error: 'qrgBlankId is required — a BLD must be linked to a valid QRG blank at creation time' });
        return;
      }
      if (!isValidQrgBlankId(String(qrgBlankId))) {
        res.status(400).json({ error: `qrgBlankId "${qrgBlankId}" is not a valid STNNN blank ID (S=1-6, T=1-9, NNN=000-999)` });
        return;
      }

      const result: WriteBldResult = await writeBldDefinition({
        working,
        sourceSessionId:  sourceSessionId  || null,
        sourceInstanceId: sourceInstanceId || null,
        qrgBlankId:       qrgBlankId       || null,
        qrgBaseCode:      qrgBaseCode       || null,
        packetId:         packetId          || null,
      });

      res.json({
        success:       true,
        bldId:         result.bldId,
        instanceCount: result.instanceCount,
        buildSequence: result.buildSequence,
      });
    } catch (err: any) {
      console.error('[BLD] POST /admin/bld error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /admin/bld/:bldId ─────────────────────────────────────────────────
  app.get('/admin/bld/:bldId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { bldId } = req.params;
      const doc = await db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).get();
      if (!doc.exists) {
        res.status(404).json({ error: `BLD not found: ${bldId}` });
        return;
      }
      const d = doc.data()!;
      res.json({
        success: true,
        bld: {
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate?.() || null,
          updatedAt: d.updatedAt?.toDate?.() || null,
        },
      });
    } catch (err: any) {
      console.error('[BLD] GET /admin/bld/:bldId error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /admin/bld/:bldId/instances ───────────────────────────────────────
  // Reads instances[] from the root doc — no sub-collection query needed.
  app.get('/admin/bld/:bldId/instances', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { bldId } = req.params;
      const doc = await db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).get();
      if (!doc.exists) {
        res.status(404).json({ error: `BLD not found: ${bldId}` });
        return;
      }
      const data = doc.data() as any;
      const instances: any[] = Array.isArray(data.instances) ? data.instances : [];
      const sorted = [...instances].sort((a, b) => String(a.seq).localeCompare(String(b.seq)));
      res.json({ success: true, bldId, instances: sorted, count: sorted.length });
    } catch (err: any) {
      console.error('[BLD] GET /admin/bld/:bldId/instances error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /admin/bld/:bldId ───────────────────────────────────────────────
  // Update name and/or flat instances array on an admin-created BLD definition.
  app.patch('/admin/bld/:bldId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { bldId } = req.params;
      const { name, instances } = req.body;

      const docRef = db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
      const doc = await docRef.get();
      if (!doc.exists) {
        res.status(404).json({ error: `BLD definition not found: ${bldId}` });
        return;
      }

      const updates: Record<string, any> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
          if (!VALID_TYPES.includes(inst.type as BldInstanceType)) {
            res.status(400).json({ error: `Invalid instance type "${inst.type}". Must be one of: ${VALID_TYPES.join(', ')}` });
            return;
          }
        }
        // Canon (BLD.md): instanceCount is a single digit (0–9).
        if (instances.length > 9) {
          res.status(400).json({ error: `instanceCount ${instances.length} exceeds maximum of 9 — BLD v1 supports single-digit instance counts only.` });
          return;
        }
        updates.instances      = instances;
        updates.instanceCount  = instances.length;
      }

      await docRef.update(updates);
      const updated = await docRef.get();
      const out = convertTimestamps(updated.data()!);
      console.log(`[BLD] Updated ${bldId}`);
      res.json({ success: true, definition: { id: updated.id, ...out } });
    } catch (err: any) {
      console.error('[BLD] PATCH /admin/bld/:bldId error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── DELETE /admin/bld/:bldId ──────────────────────────────────────────────
  // Permanently delete a BLD definition document.
  // Blocks if any Assembly references this bldId.
  // No sub-collection cascade needed — instances are embedded in the root doc.
  app.delete('/admin/bld/:bldId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { bldId } = req.params;
      const docRef = db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
      const doc = await docRef.get();
      if (!doc.exists) {
        res.status(404).json({ error: `BLD definition not found: ${bldId}` });
        return;
      }

      // Block delete if any Assembly references this bldId
      const asmSnap = await db.collection('assemblies').where('bldId', '==', bldId).limit(10).get();
      if (!asmSnap.empty) {
        const referencingIds = asmSnap.docs.map(d => d.id);
        res.status(409).json({
          error: `Cannot delete BLD "${bldId}" — it is referenced by ${asmSnap.size} Assembly record(s). Unlink or delete those assemblies first.`,
          referencingAssemblyIds: referencingIds,
        });
        return;
      }

      await docRef.delete();
      console.log(`[BLD] Deleted ${bldId}`);
      res.json({ success: true, bldId });
    } catch (err: any) {
      console.error('[BLD] DELETE /admin/bld/:bldId error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

}
