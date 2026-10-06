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
 *   Admin direct-create: accepts { context, layoutMode, name, instances[] }.
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
import { BldValidationError, validateBldStructure } from '../../../shared/bldCodes';
import { createBldDefinition } from '../services/bld-store';
import { BLD_DEFINITIONS_COLLECTION } from '../constants';

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
          validationError: validateBldStructure(d),
          instanceCount: typeof converted.instanceCount === 'number'
            ? converted.instanceCount
            : (Array.isArray(converted.instances) ? converted.instances.length : 0),
          source: converted.source ?? 'unknown',
        };
      });
      if (context) defs = defs.filter(d => d.context === context);
      if (layout)  defs = defs.filter(d => d.layoutMode === layout);
      res.json({ success: true, definitions: defs, count: defs.length });
    } catch (err: any) {
      console.error('[BLD] GET /admin/bld error:', err.message);
      res.status(err instanceof BldValidationError ? err.status : 500).json({ error: err.message });
    }
  });

  // ── POST /admin/bld/create ────────────────────────────────────────────────
  // Admin direct-create: { context, layoutMode, name?, instances[] }
  // Instances are stored as an embedded array on the doc (not a sub-collection).
  // MUST be registered before /admin/bld/:bldId.
  app.post('/admin/bld/create', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const defData = await createBldDefinition(db, () => admin.firestore.FieldValue.serverTimestamp(), {
        ...req.body, source: 'admin',
      });
      const { bldId, instanceCount } = defData;
      const created = await db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId).get();
      const out = convertTimestamps(created.data()!);

      console.log(`[BLD] Admin-created ${bldId} with ${instanceCount} instances`);
      res.json({ success: true, bldId, definition: { id: created.id, ...out } });
    } catch (err: any) {
      console.error('[BLD] POST /admin/bld/create error:', err.message);
      res.status(err instanceof BldValidationError ? err.status : 500).json({ error: err.message });
    }
  });

  // ── POST /admin/bld ───────────────────────────────────────────────────────
  // Write a new BLD definition from a builder working-state snapshot.
  app.post('/admin/bld', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { working } = req.body;
      if (!working || typeof working !== 'object' || Array.isArray(working)) {
        throw new BldValidationError('working (builder snapshot) is required');
      }
      const result: WriteBldResult = await writeBldDefinition({ working });

      res.json({
        success:       true,
        bldId:         result.bldId,
        instanceCount: result.instanceCount,
        buildSequence: result.buildSequence,
      });
    } catch (err: any) {
      console.error('[BLD] POST /admin/bld error:', err.message);
      res.status(err instanceof BldValidationError ? err.status : 500).json({ error: err.message });
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
      const error = validateBldStructure(d);
      if (error) throw new BldValidationError(error, 409);
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
      res.status(err instanceof BldValidationError ? err.status : 500).json({ error: err.message });
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
      const error = validateBldStructure(data);
      if (error) throw new BldValidationError(error, 409);
      const instances: any[] = data.instances;
      const sorted = [...instances].sort((a, b) => String(a.seq).localeCompare(String(b.seq)));
      res.json({ success: true, bldId, instances: sorted, count: sorted.length });
    } catch (err: any) {
      console.error('[BLD] GET /admin/bld/:bldId/instances error:', err.message);
      res.status(err instanceof BldValidationError ? err.status : 500).json({ error: err.message });
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
        updates.instances      = instances;
        updates.instanceCount  = Array.isArray(instances) ? instances.length : undefined;
      }

      const error = validateBldStructure({ ...doc.data(), ...updates });
      if (error) throw new BldValidationError(error);
      await docRef.update(updates);
      const updated = await docRef.get();
      const out = convertTimestamps(updated.data()!);
      console.log(`[BLD] Updated ${bldId}`);
      res.json({ success: true, definition: { id: updated.id, ...out } });
    } catch (err: any) {
      console.error('[BLD] PATCH /admin/bld/:bldId error:', err.message);
      res.status(err instanceof BldValidationError ? err.status : 500).json({ error: err.message });
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
      res.status(err instanceof BldValidationError ? err.status : 500).json({ error: err.message });
    }
  });

}
