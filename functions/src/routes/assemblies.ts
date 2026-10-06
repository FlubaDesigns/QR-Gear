import { validateComposition } from '../services/assembly-store';
/**
 * Assemblies — CRUD routes
 *
 * Assembly is the ONLY place where QRG, BLD, and GRF are linked together.
 * It holds no pricing, no product metadata — pure linking record.
 *
 * Collection: assemblies/{assemblyId}
 * ID format:  ASM-NNNNNN  (6-digit zero-padded, atomically minted from asm_counters/global)
 *
 * mappings[] entry types:
 *   txt / act → requires { seq, type, value }  + optional color
 *   img / qrc → requires { seq, type, grfId }
 *   vid / doc → requires { seq, type, grfId }  or { seq, type, value } (external URL)
 */

import express, { Request, Response } from 'express';
import { db, admin } from '../core';
import { requireAdmin } from '../middleware';
import { isValidQrgBlankId } from '../../../shared/qrgCodes';

const ASM_COUNTERS_COLLECTION = 'asm_counters';
const ASM_COUNTER_DOC         = 'global';
const ASSEMBLIES_COLLECTION   = 'assemblies';

function toSerializable(doc: FirebaseFirestore.DocumentSnapshot): Record<string, any> {
  const data = doc.data() as any;
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerAssemblies(app: express.Express): void {

  // ── POST /admin/assemblies — create ────────────────────────────────────────
  app.post('/admin/assemblies', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { qrgId, bldId, name, mappings } = req.body;

      if (!qrgId)    { res.status(400).json({ error: 'qrgId is required' });    return; }
      if (!isValidQrgBlankId(String(qrgId))) {
        res.status(400).json({ error: `qrgId "${qrgId}" is not a valid STNNN blank ID (S=1-6, T=1-9, NNN=000-999)` });
        return;
      }
      if (!bldId)    { res.status(400).json({ error: 'bldId is required' });    return; }
      if (!mappings) { res.status(400).json({ error: 'mappings is required' }); return; }

      try { await validateComposition(db, { qrgId, bldId, mappings }); }
      catch (e: any) { res.status(400).json({ error: e.message }); return; }

      // Sort mappings by seq before persisting
      const sortedMappings = [...mappings].sort((a: any, b: any) => a.seq.localeCompare(b.seq));

      const { assemblyId, sequence } = await db.runTransaction(async tx => {
        const ref = db.collection(ASM_COUNTERS_COLLECTION).doc(ASM_COUNTER_DOC);
        const count = (await tx.get(ref)).data()?.count ?? 0;
        if (!Number.isInteger(count) || count < 0 || count >= 999999) throw new Error('Invalid or exhausted Assembly counter.');
        const sequence = count + 1;
        const assemblyId = `ASM-${String(sequence).padStart(6, '0')}`;
        const asmRef = db.collection(ASSEMBLIES_COLLECTION).doc(assemblyId);
        if ((await tx.get(asmRef)).exists) throw new Error('Assembly counter collision.');
        tx.set(ref, { count: sequence }, { merge: true });
        tx.create(asmRef, { assemblyId, sequence, qrgId, bldId, mappings: sortedMappings, packetIds: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: (req as any).user?.uid || 'admin', ...(name ? { name: String(name).trim() } : {}) });
        return { assemblyId, sequence };
      });
      console.log(`[Assemblies] Created ${assemblyId} — qrgId=${qrgId} bldId=${bldId} mappings=${sortedMappings.length}`);

      res.status(201).json({
        success:      true,
        assemblyId,
        sequence,
        mappingCount: sortedMappings.length,
      });
    } catch (e: any) {
      console.error('[Assemblies] create error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /admin/assemblies — list ───────────────────────────────────────────
  // Optional query params: ?qrgId=  ?bldId=
  app.get('/admin/assemblies', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { qrgId, bldId } = req.query as Record<string, string>;

      // Single-field filter to avoid composite index requirements.
      // When both are supplied, primary filter is qrgId and bldId is applied in memory.
      let q: FirebaseFirestore.Query;
      if (qrgId) {
        q = db.collection(ASSEMBLIES_COLLECTION).where('qrgId', '==', qrgId).limit(200);
      } else if (bldId) {
        q = db.collection(ASSEMBLIES_COLLECTION).where('bldId', '==', bldId).limit(200);
      } else {
        q = db.collection(ASSEMBLIES_COLLECTION).orderBy('createdAt', 'desc').limit(200);
      }

      const snap = await q.get();
      let assemblies = snap.docs.map(toSerializable);

      // Secondary in-memory filter when both params present
      if (qrgId && bldId) {
        assemblies = assemblies.filter((a) => a.bldId === bldId);
      }

      // Sort by sequence descending (newest first) when a filter was used
      if (qrgId || bldId) {
        assemblies.sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0));
      }

      res.json({ success: true, assemblies, count: assemblies.length });
    } catch (e: any) {
      console.error('[Assemblies] list error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /admin/assemblies/:assemblyId — fetch single ──────────────────────
  app.get('/admin/assemblies/:assemblyId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { assemblyId } = req.params;
      const doc = await db.collection(ASSEMBLIES_COLLECTION).doc(assemblyId).get();
      if (!doc.exists) { res.status(404).json({ error: 'Assembly not found' }); return; }
      res.json({ success: true, assembly: toSerializable(doc) });
    } catch (e: any) {
      console.error('[Assemblies] fetch error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── PATCH /admin/assemblies/:assemblyId — update name / mappings ───────────
  app.patch('/admin/assemblies/:assemblyId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { assemblyId } = req.params;
      const docRef = db.collection(ASSEMBLIES_COLLECTION).doc(assemblyId);
      const existing = await docRef.get();
      if (!existing.exists) { res.status(404).json({ error: 'Assembly not found' }); return; }

      const existingData = existing.data() as any;
      const livePacketIds: string[] = existingData?.packetIds || [];

      // Fix 14: Block qrgId / bldId changes on live assemblies (ones already linked to packets)
      if (livePacketIds.length > 0) {
        if (req.body.qrgId !== undefined || req.body.bldId !== undefined) {
          res.status(409).json({
            error: `Cannot change qrgId or bldId on an Assembly that is already linked to ${livePacketIds.length} packet(s). ` +
              `Unlink all packets first, then update the Assembly.`,
            linkedPacketIds: livePacketIds,
          });
          return;
        }
      }

      const updates: Record<string, any> = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (req.body.name !== undefined) {
        updates.name = String(req.body.name).trim() || null;
      }
      if (req.body.qrgId !== undefined) {
        updates.qrgId = String(req.body.qrgId).trim();
      }
      if (req.body.bldId !== undefined) {
        updates.bldId = String(req.body.bldId).trim();
      }
      if (req.body.mappings !== undefined) {
        updates.mappings = [...req.body.mappings].sort((a: any, b: any) => a.seq.localeCompare(b.seq));
      }

      try { await validateComposition(db, { ...existingData, ...updates }); }
      catch (e: any) { res.status(400).json({ error: e.message }); return; }
      await docRef.update(updates);
      const updated = await docRef.get();

      res.json({ success: true, assembly: toSerializable(updated) });
    } catch (e: any) {
      console.error('[Assemblies] update error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /admin/assemblies/:assemblyId ───────────────────────────────────
  // Canon (ASSEMBLY.md): returns 409 if Assembly has any linked Packets.
  // Admin must manually unlink all Packets before deletion is allowed.
  // No auto-clearing — silent unlinking violates canon.
  app.delete('/admin/assemblies/:assemblyId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { assemblyId } = req.params;
      const doc = await db.collection(ASSEMBLIES_COLLECTION).doc(assemblyId).get();
      if (!doc.exists) { res.status(404).json({ error: 'Assembly not found' }); return; }

      const data = doc.data() as any;
      const packetIds: string[] = data?.packetIds || [];

      // Block delete if any Packets are still linked — canon requires manual unlinking first
      if (packetIds.length > 0) {
        res.status(409).json({
          error: `Cannot delete Assembly "${assemblyId}" — it is linked to ${packetIds.length} packet(s). Unlink all packets from this assembly first.`,
          linkedPacketIds: packetIds,
        });
        return;
      }

      await doc.ref.delete();
      console.log(`[Assemblies] Deleted ${assemblyId}`);
      res.json({ success: true, assemblyId });
    } catch (e: any) {
      console.error('[Assemblies] delete error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });
}
