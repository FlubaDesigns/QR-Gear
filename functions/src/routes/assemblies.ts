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

const ASM_COUNTERS_COLLECTION = 'asm_counters';
const ASM_COUNTER_DOC         = 'global';
const ASSEMBLIES_COLLECTION   = 'assemblies';

const VALID_TYPES = new Set(['txt', 'img', 'qrc', 'act', 'vid', 'doc']);

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAsmId(seq: number): string {
  return `ASM-${String(seq).padStart(6, '0')}`;
}

/** Atomically increment asm_counters/global and return the new sequence number. */
async function mintAsmId(): Promise<{ assemblyId: string; sequence: number }> {
  const counterRef = db.collection(ASM_COUNTERS_COLLECTION).doc(ASM_COUNTER_DOC);
  const next = await db.runTransaction(async (txn) => {
    const doc = await txn.get(counterRef);
    const current = doc.exists ? (doc.data()?.count ?? 0) : 0;
    const n = current + 1;
    txn.set(counterRef, { count: n }, { merge: true });
    return n;
  });
  return { assemblyId: formatAsmId(next), sequence: next };
}

/**
 * Validate a mappings array.
 * Returns a human-readable error string, or null if valid.
 */
function validateMappings(mappings: any[]): string | null {
  if (!Array.isArray(mappings))    return 'mappings must be an array';
  if (mappings.length === 0)       return 'mappings must contain at least one entry';

  for (const m of mappings) {
    if (!m.seq || !/^\d{2}$/.test(m.seq)) {
      return `mapping seq must be a 2-digit string (e.g. "01") — got: ${JSON.stringify(m.seq)}`;
    }
    if (!m.type || !VALID_TYPES.has(m.type)) {
      return `mapping type must be one of: txt, img, qrc, act, vid, doc — got: ${JSON.stringify(m.type)}`;
    }
    if ((m.type === 'txt' || m.type === 'act') && !m.value) {
      return `mapping seq ${m.seq} type "${m.type}" requires a non-empty value`;
    }
    if ((m.type === 'img' || m.type === 'qrc') && !m.grfId) {
      return `mapping seq ${m.seq} type "${m.type}" requires a grfId`;
    }
    if ((m.type === 'vid' || m.type === 'doc') && !m.grfId && !m.value) {
      return `mapping seq ${m.seq} type "${m.type}" requires either grfId or value (URL)`;
    }
  }

  // Duplicate seq check
  const seqs = mappings.map((m: any) => m.seq);
  const unique = new Set(seqs);
  if (unique.size !== seqs.length) {
    return 'mapping seq values must be unique within an assembly';
  }

  return null;
}

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
      if (!bldId)    { res.status(400).json({ error: 'bldId is required' });    return; }
      if (!mappings) { res.status(400).json({ error: 'mappings is required' }); return; }

      const validationError = validateMappings(mappings);
      if (validationError) { res.status(400).json({ error: validationError }); return; }

      // Sort mappings by seq before persisting
      const sortedMappings = [...mappings].sort((a: any, b: any) => a.seq.localeCompare(b.seq));

      const { assemblyId, sequence } = await mintAsmId();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const uid = (req as any).user?.uid || 'admin';

      const docData: Record<string, any> = {
        assemblyId,
        sequence,
        qrgId:    String(qrgId).trim(),
        bldId:    String(bldId).trim(),
        mappings: sortedMappings,
        createdAt: now,
        createdBy:  uid,
        packetIds: [],
      };
      if (name) docData.name = String(name).trim();

      await db.collection(ASSEMBLIES_COLLECTION).doc(assemblyId).set(docData);

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
        const validationError = validateMappings(req.body.mappings);
        if (validationError) { res.status(400).json({ error: validationError }); return; }
        updates.mappings = [...req.body.mappings].sort((a: any, b: any) => a.seq.localeCompare(b.seq));
      }

      await docRef.update(updates);
      const updated = await docRef.get();

      res.json({ success: true, assembly: toSerializable(updated) });
    } catch (e: any) {
      console.error('[Assemblies] update error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /admin/assemblies/:assemblyId ───────────────────────────────────
  app.delete('/admin/assemblies/:assemblyId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const { assemblyId } = req.params;
      const doc = await db.collection(ASSEMBLIES_COLLECTION).doc(assemblyId).get();
      if (!doc.exists) { res.status(404).json({ error: 'Assembly not found' }); return; }
      await doc.ref.delete();
      console.log(`[Assemblies] Deleted ${assemblyId}`);
      res.json({ success: true, assemblyId });
    } catch (e: any) {
      console.error('[Assemblies] delete error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });
}
