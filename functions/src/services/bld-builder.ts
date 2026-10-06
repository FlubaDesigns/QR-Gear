/** Builder BLD adapter; schema and persistence are shared with direct creation. */
import { db, admin } from '../core';
import { builderBldLayoutMode, extractBldInstances } from '../../../shared/bldCodes';
import { createBldDefinition } from './bld-store';
export { extractBldInstances } from '../../../shared/bldCodes';
export type { BldContext, BldLayoutMode, BldInstance } from '../../../shared/bldCodes';

export interface WriteBldOptions { working: Record<string, any> }
export interface WriteBldResult { bldId: string; instanceCount: number; buildSequence: number }

export async function writeBldDefinition({ working }: WriteBldOptions): Promise<WriteBldResult> {
  const definition = await createBldDefinition(db, () => admin.firestore.FieldValue.serverTimestamp(), {
    context: 'S',
    layoutMode: builderBldLayoutMode(working.graphics?.content?.graphicLayoutMode),
    instances: extractBldInstances(working),
    source: 'builder',
  });
  return { bldId: definition.bldId, instanceCount: definition.instanceCount, buildSequence: definition.buildSequence };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assembly auto-creation from builder working state
// ─────────────────────────────────────────────────────────────────────────────

const ASM_COUNTERS_COLLECTION = 'asm_counters';
const ASSEMBLIES_COLLECTION   = 'assemblies';

export interface AutoAssemblyMapping {
  seq:       string;
  type:      string;
  value?:    string;    // txt / act → text content
  color?:    string;    // txt / act → color override
  imageUrl?: string;    // img → original URL (preserved for reference)
  grfId?:    string;    // img / qrc → canonical GRF ID (must be real, never pending)
}

export interface WriteAutoAssemblyOptions {
  working:          Record<string, any>;
  qrgId:            string;           // e.g. "11101"
  bldId:            string;           // e.g. "BLD-SZ9-001"
  sourceSessionId:  string | null;
  packetId:         string | null;
  /** Real GRF IDs for asset slots — must be registered before calling this */
  grfIds?: {
    backgroundGrfId?:      string | null;
    qrGrfId?:              string | null;
    compositeGrfId?:       string | null;
    landingSnapshotGrfId?: string | null;
  };
}

export interface WriteAutoAssemblyResult {
  assemblyId:   string;
  sequence:     number;
  mappingCount: number;
}

/**
 * Walk the builder working-state snapshot and extract ordered Assembly mappings.
 * Mirrors extractBldInstances in sequence order but captures content values
 * (text strings, image URLs) rather than styling metadata.
 *
 * Asset slots (img, qrc) require real GRF IDs — pass them via grfIds.
 * Throws if an asset slot is present but no GRF ID is provided.
 */
export function extractAssemblyMappings(
  working: Record<string, any>,
  grfIds?: {
    backgroundGrfId?: string | null;
    qrGrfId?:         string | null;
  },
): AutoAssemblyMapping[] {
  const graphics = (working.graphics || {}) as Record<string, any>;
  const content  = (graphics.content  || {}) as Record<string, any>;

  const mappings: AutoAssemblyMapping[] = [];
  let seq = 1;
  const pad = (n: number) => String(n).padStart(2, '0');

  // ── 01 img — background image ─────────────────────────────────────────────
  const bgUrl      = graphics.loadedBackground?.url || null;
  const areaImgUrl = content.areaImageUrl || null;
  const imageUrl   = bgUrl || areaImgUrl || null;
  if (imageUrl) {
    const grfId = grfIds?.backgroundGrfId || null;
    if (!grfId) {
      throw new Error(
        `[Assembly] Background image slot has no registered GRF ID. ` +
        `Register the asset via registerGrfAsset() before writing Assembly.`,
      );
    }
    mappings.push({ seq: pad(seq++), type: 'img', grfId, imageUrl });
  }

  // ── 02 qrc — QR code slot ─────────────────────────────────────────────────
  // Only written when a real GRF ID exists. External QR service URLs
  // (api.qrserver.com) are not stored assets and are skipped by
  // registerPacketGrfAssets — so grfId will be null in that case,
  // which is valid. The Assembly records structure-only for the QR slot;
  // the actual QR image is generated at render time from qrgBaseCode.
  {
    const grfId = grfIds?.qrGrfId || null;
    if (grfId) {
      mappings.push({ seq: pad(seq++), type: 'qrc', grfId });
    }
    // No grfId → QR code is rendered dynamically at display time; no mapping needed.
  }

  // ── 03 txt — header ───────────────────────────────────────────────────────
  const header = content.headerStyle || {};
  if (header.enabled && header.text) {
    const m: AutoAssemblyMapping = { seq: pad(seq++), type: 'txt', value: header.text };
    if (header.color) m.color = header.color;
    mappings.push(m);
  }

  // ── 04 txt — footer ───────────────────────────────────────────────────────
  const footer = content.footerStyle || {};
  if (footer.enabled && footer.text) {
    const m: AutoAssemblyMapping = { seq: pad(seq++), type: 'txt', value: footer.text };
    if (footer.color) m.color = footer.color;
    mappings.push(m);
  }

  // ── 05 txt — sub-bottom ───────────────────────────────────────────────────
  const subBottom = content.subBottomStyle || {};
  if (subBottom.enabled && subBottom.text) {
    const m: AutoAssemblyMapping = { seq: pad(seq++), type: 'txt', value: subBottom.text };
    if (subBottom.color) m.color = subBottom.color;
    mappings.push(m);
  }

  // ── 06+ txt — landing text blocks ─────────────────────────────────────────
  const landingBlocks: any[] = Array.isArray(content.landingTextBlocks)
    ? content.landingTextBlocks : [];
  for (const block of landingBlocks) {
    if (!block.enabled || !block.text) continue;
    const m: AutoAssemblyMapping = { seq: pad(seq++), type: 'txt', value: block.text };
    if (block.color) m.color = block.color;
    mappings.push(m);
  }

  return mappings;
}

/**
 * Mint an ASM ID atomically and write an Assembly document to Firestore.
 * Called automatically at build-session commit (after writeBldDefinition).
 * @throws if any asset slot (img, qrc) is missing a registered GRF ID.
 * Callers must register all GRF assets via registerGrfAsset() first.
 */
export async function writeAutoAssembly(opts: WriteAutoAssemblyOptions): Promise<WriteAutoAssemblyResult> {
  const { working, qrgId, bldId, sourceSessionId, packetId, grfIds } = opts;

  const mappings = extractAssemblyMappings(working, grfIds);

  // Atomically mint the next ASM sequence number
  const counterRef = db.collection(ASM_COUNTERS_COLLECTION).doc('global');
  const sequence = await db.runTransaction(async (txn) => {
    const doc = await txn.get(counterRef);
    const current = doc.exists ? (doc.data()?.count ?? 0) : 0;
    const next = current + 1;
    txn.set(counterRef, { count: next }, { merge: true });
    return next;
  });

  const assemblyId = `ASM-${String(sequence).padStart(6, '0')}`;
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Strip undefined from each mapping so Firestore doesn't choke
  const cleanMappings = mappings.map((m) => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(m)) {
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    }
    return clean;
  });

  await db.collection(ASSEMBLIES_COLLECTION).doc(assemblyId).set({
    assemblyId,
    sequence,
    qrgId,
    bldId,
    mappings:        cleanMappings,
    packetIds:       packetId ? [packetId] : [],
    sourceSessionId: sourceSessionId || null,
    source:          'auto_commit',
    createdAt:       now,
    createdBy:       'system',
  });

  console.log(`[Assembly] Auto-wrote ${assemblyId} — qrgId=${qrgId} bldId=${bldId} mappings=${cleanMappings.length}`);

  return { assemblyId, sequence, mappingCount: cleanMappings.length };
}
