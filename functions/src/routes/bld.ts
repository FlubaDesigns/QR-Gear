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
 * GET /admin/bld/:bldId
 *   Fetch a BLD header document.
 *
 * GET /admin/bld/:bldId/instances
 *   Fetch all ordered instance documents for a BLD.
 */

import express, { Request, Response } from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { writeBldDefinition, WriteBldResult } from '../services/bld-builder';

const BLD_DEFINITIONS_COLLECTION = 'bld_definitions';

export function registerBld(app: express.Express): void {

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
  app.get('/admin/bld/:bldId/instances', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { bldId } = req.params;
      const snap = await db
        .collection(BLD_DEFINITIONS_COLLECTION)
        .doc(bldId)
        .collection('instances')
        .orderBy('seq', 'asc')
        .get();
      const instances = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ success: true, bldId, instances, count: instances.length });
    } catch (err: any) {
      console.error('[BLD] GET /admin/bld/:bldId/instances error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

}
