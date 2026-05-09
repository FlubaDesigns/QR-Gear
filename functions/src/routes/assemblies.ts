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
import { isValidGrfId, parseGrfId } from '../../../shared/GRF_engine';

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

// Allowed channel:purpose pairs per Assembly slot vehicle type.
// D4 is channel-relative (GRF-[D1][D2][D3][D4][D5]-[NNNNNN]), so we check
// the channel+purpose combination — not purpose alone.
//
// img slots accept:
//   print/qr_composite (1:1), store/glamor_shot (2:1), store/front (2:2),
//   store/back (2:3), url/graphic (3:2), assets/original (4:1),
//   assets/cropped (4:2), assets/background (4:3), assets/template (4:4)
//
// qrc slots must be strictly print/qr_standalone (1:2) with output artifact (D1=2).
const IMG_ALLOWED_CH_PURPOSE = new Set([
  '1:1', // print · qr_composite
  '2:1', // store · glamor_shot
  '2:2', // store · front
  '2:3', // store · back
  '3:2', // url · graphic
  '4:1', // assets · original
  '4:2', // assets · cropped
  '4:3', // assets · background
  '4:4', // assets · template
]);
const QRC_REQUIRED_CH_PURPOSE = '1:2'; // print · qr_standalone

/**
 * Validate a mappings array.
 * Returns a human-readable error string, or null if valid.
 * Includes GRF format validity and slot-type compatibility checks (Fix 9).
 * Does NOT check Firestore existence — that is done by validateGrfIdsExist (Fix 8).
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
      return `mapping seq ${m.seq} type "${m.type}" requires a valid grfId — pending or placeholder values are not allowed`;
    }
    if ((m.type === 'vid' || m.type === 'doc') && !m.grfId && !m.value) {
      return `mapping seq ${m.seq} type "${m.type}" requires either grfId or value (URL)`;
    }

    if (m.grfId) {
      if (!isValidGrfId(String(m.grfId))) {
        return `mapping seq ${m.seq}: grfId "${m.grfId}" is not a valid GRF ID (format: GRF-DDDDD-NNNNNN)`;
      }
      const parsed = parseGrfId(String(m.grfId));
      const chPurpose = `${parsed.channel}:${parsed.purpose}`;

      if (m.type === 'img') {
        if (!IMG_ALLOWED_CH_PURPOSE.has(chPurpose)) {
          return (
            `mapping seq ${m.seq}: grfId "${m.grfId}" has channel/purpose "${chPurpose}" ` +
            `(${parsed.channelName}/${parsed.purposeName}) which is not compatible with slot type "img". ` +
            `Allowed channel:purpose pairs for "img": ${Array.from(IMG_ALLOWED_CH_PURPOSE).join(', ')}`
          );
        }
      }

      if (m.type === 'qrc') {
        if (chPurpose !== QRC_REQUIRED_CH_PURPOSE) {
          return (
            `mapping seq ${m.seq}: grfId "${m.grfId}" has channel/purpose "${chPurpose}" ` +
            `(${parsed.channelName}/${parsed.purposeName}) but qrc slots require "${QRC_REQUIRED_CH_PURPOSE}" (print/qr_standalone)`
          );
        }
        if (parsed.assetClass !== '2') {
          return (
            `mapping seq ${m.seq}: grfId "${m.grfId}" has assetClass "${parsed.assetClass}" ` +
            `but qrc slots require output artifacts (assetClass "2")`
          );
        }
      }
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

/**
 * Async validator — verifies every grfId in mappings exists in grf_assets and is active.
 * Returns a human-readable error string, or null if all grfIds are valid.
 */
async function validateGrfIdsExist(mappings: any[]): Promise<string | null> {
  const grfIdsToCheck = [
    ...new Set(
      mappings
        .filter((m: any) => m.grfId)
        .map((m: any) => String(m.grfId)),
    ),
  ];

  if (grfIdsToCheck.length === 0) return null;

  const results = await Promise.all(
    grfIdsToCheck.map((grfId) => db.collection('grf_assets').doc(grfId).get()),
  );

  for (let i = 0; i < results.length; i++) {
    const doc = results[i];
    const grfId = grfIdsToCheck[i];
    if (!doc.exists) {
      return `grfId "${grfId}" does not exist in the GRF asset library`;
    }
    if (doc.data()?.isActive === false) {
      return `grfId "${grfId}" has been archived and cannot be used in a new mapping`;
    }
  }

  return null;
}

/**
 * Fetch the referenced BLD and verify that every required slot has a corresponding mapping.
 * All BLDs store instances as a flat array in the root doc — single storage shape.
 * Returns a human-readable error string, or null if coverage is complete.
 */
async function validateBldSlotCoverage(bldId: string, mappings: any[]): Promise<string | null> {
  const bldDoc = await db.collection('bld_definitions').doc(bldId).get();
  if (!bldDoc.exists) {
    return `bldId "${bldId}" does not exist in bld_definitions`;
  }

  const bldData = bldDoc.data() as any;

  // All BLDs embed instances as a flat array in the root doc
  const rawInstances: any[] = Array.isArray(bldData.instances) ? bldData.instances : [];
  const slots: Array<{ seq: string; type: string; required?: boolean }> = rawInstances.map((inst: any) => ({
    seq:      String(inst.seq).padStart(2, '0'),
    type:     inst.type,
    required: inst.required !== false,
  }));

  if (slots.length === 0) return null; // No slots defined — nothing to cross-validate

  const filledSeqs = new Set(mappings.map((m: any) => m.seq));
  for (const slot of slots) {
    if (slot.required !== false && !filledSeqs.has(slot.seq)) {
      return `required BLD slot ${slot.seq} (type: ${slot.type}) in "${bldId}" has no corresponding mapping`;
    }
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
      if (!isValidQrgBlankId(String(qrgId))) {
        res.status(400).json({ error: `qrgId "${qrgId}" is not a valid STNNN blank ID (S=1-6, T=1-9, NNN=000-999)` });
        return;
      }
      if (!bldId)    { res.status(400).json({ error: 'bldId is required' });    return; }
      if (!mappings) { res.status(400).json({ error: 'mappings is required' }); return; }

      const validationError = validateMappings(mappings);
      if (validationError) { res.status(400).json({ error: validationError }); return; }

      // Fix 8: Verify every grfId in mappings exists in grf_assets and is active
      const grfExistenceError = await validateGrfIdsExist(mappings);
      if (grfExistenceError) { res.status(400).json({ error: grfExistenceError }); return; }

      // Fix 10: Cross-validate mappings against required BLD slots
      const bldSlotError = await validateBldSlotCoverage(bldId, mappings);
      if (bldSlotError) { res.status(400).json({ error: bldSlotError }); return; }

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
        const validationError = validateMappings(req.body.mappings);
        if (validationError) { res.status(400).json({ error: validationError }); return; }

        // Fix 8: Verify every grfId in updated mappings exists in grf_assets and is active
        const grfExistenceError = await validateGrfIdsExist(req.body.mappings);
        if (grfExistenceError) { res.status(400).json({ error: grfExistenceError }); return; }

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
