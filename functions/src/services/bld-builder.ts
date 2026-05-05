/**
 * functions/src/services/bld-builder.ts
 *
 * BLD (Build Definition Schema) — ID generation, instance extraction,
 * and Firestore write helpers.
 *
 * BLD ID format:
 *   BLD-[context][layoutMode][instanceCount]-[buildSeq:001-999]
 *
 *   [context]       S = Shirt graphic  |  U = URL destination
 *   [layoutMode]    S: Z = Zone, P = Palette  |  U: I = Image, V = Video, D = Document
 *   [instanceCount] Total ordered layers in this build (integer, 0+)
 *   [buildSeq]      001–999, atomically allocated per context+layoutMode branch
 *
 *   Examples:
 *     BLD-SZ9-001   Shirt · Zone · 9 instances · build #001
 *     BLD-SP3-001   Shirt · Palette · 3 instances · build #001
 *
 * bld_counters key is the two-char prefix (e.g. "SZ", "SP").
 * Counters are shared between builder-generated and admin-created BLDs.
 * Incremented atomically via Firestore transaction.
 */

import { db, admin } from '../core';

const BLD_DEFINITIONS_COLLECTION = 'bld_definitions';
const BLD_COUNTERS_COLLECTION     = 'bld_counters';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BldContext    = 'S' | 'U';
export type BldLayoutMode = 'Z' | 'P';  // S context only
export type BldEngine     = 'T' | 'I' | 'Q' | 'A';

export interface BldInstance {
  seq:        string;   // two-digit render order: "01" … "09"
  type:       'txt' | 'img' | 'qrc' | 'act' | 'vid' | 'doc';
  role?:      string;
  // txt / act fields
  fontFamily?:    string;
  fontSize?:      number;
  fontWeight?:    number | string;
  letterSpacing?: number;
  strokeWidth?:   number;
  strokeColor?:   string;
  color?:         string;
  text?:          string;
  warpPreset?:    string;
  verticalOffset?:   number;
  horizontalOffset?: number;
  // act field
  url?: string;
  // img / qrc position fields
  size?:       number;
  positionLR?: number;
  positionUD?: number;
  // img mode
  imageUrl?: string;
  imageScale?: number;
}

export interface BldDefinitionHeader {
  bldId:         string;
  context:       BldContext;
  layoutMode:    BldLayoutMode | null;
  instanceCount: number;
  buildSequence: number;
  // Link back to the session / instance that generated it
  sourceSessionId:  string | null;
  sourceInstanceId: string | null;
  qrgBlankId:       string | null;
  qrgBaseCode:      string | null;
  packetId:         string | null;
  // Snapshot of key builder parameters
  graphicLayoutMode: string;
  qrProductState:    string | null;
  qrSizePercent:     number;
  qrPositionX:       number;
  qrPositionY:       number;
  createdAt: any;
  updatedAt: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLD ID generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the two-char counter key from the builder state.
 * graphicLayoutMode "zone" → Z, "freeform" → P.
 * All current builder builds are S-context (shirt graphic).
 */
export function deriveBldCounterKey(graphicLayoutMode: string): string {
  const layoutCode = graphicLayoutMode === 'freeform' ? 'P' : 'Z';
  return `S${layoutCode}`;
}

/**
 * Atomically increment the counter for a given key and return the new number.
 */
async function incrementBldCounter(key: string): Promise<number> {
  const ref = db.collection(BLD_COUNTERS_COLLECTION).doc(key);
  let count = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      count = 1;
      tx.set(ref, {
        count: 1,
        key,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      count = (snap.data()!.count || 0) + 1;
      tx.update(ref, {
        count,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
  return count;
}

/**
 * Build the BLD ID string from its components.
 *
 * For S-context (zone/palette), format is:
 *   BLD-S[Z|P][instanceCount]-[buildSeq padded to 3]
 *
 * Example: BLD-SZ9-001, BLD-SP3-001
 *
 * (We keep the ID short but readable; the sub-collection instances
 *  carry all the sequenced payload details.)
 */
function formatBldId(
  context: BldContext,
  layoutCode: string,
  instanceCount: number,
  buildSequence: number,
): string {
  const seq = String(buildSequence).padStart(3, '0');
  return `BLD-${context}${layoutCode}${instanceCount}-${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instance extraction from builder working state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk the builder working-state snapshot and extract ordered BLD instances.
 *
 * Builder state structure (from buildWorkingSnapshot):
 *   graphics.content.{headerStyle, footerStyle, subBottomStyle, landingTextBlocks…}
 *   graphics.content.graphicLayoutMode
 *   graphics.content.qrSizePercent, qrPositionX, qrPositionY
 *   graphics.content.areaImageUrl
 *   graphics.loadedBackground
 *
 * Render order (01 = paints first / bottom of stack):
 *   01  img      — background image (loadedBackground or areaImageUrl)
 *   02  qrc      — QR code
 *   03  txt(hdr) — header text overlay
 *   04  txt(ftr) — footer text overlay
 *   05  txt(sub) — sub-bottom text strip
 *   06+ txt      — additional landingTextBlocks
 */
export function extractBldInstances(working: Record<string, any>): BldInstance[] {
  const graphics = (working.graphics || {}) as Record<string, any>;
  const content  = (graphics.content  || {}) as Record<string, any>;

  const instances: BldInstance[] = [];
  let seq = 1;

  const pad = (n: number) => String(n).padStart(2, '0');

  // ── 01 Image layer (background or palette area image) ─────────────────────
  const bgUrl       = graphics.loadedBackground?.url || null;
  const areaImgUrl  = content.areaImageUrl || null;
  const imageUrl    = bgUrl || areaImgUrl || null;
  if (imageUrl) {
    instances.push({
      seq:      pad(seq++),
      type:     'img',
      role:     bgUrl ? 'background' : 'area_image',
      imageUrl,
      size:     content.areaImageScale ?? 100,
      positionLR: content.areaImageOffsetX ?? 50,
      positionUD: content.areaImageOffsetY ?? 50,
    });
  }

  // ── 02 QR code ─────────────────────────────────────────────────────────────
  const qrSizePercent = typeof content.qrSizePercent === 'number' ? content.qrSizePercent : 75;
  const qrPositionX   = typeof content.qrPositionX   === 'number' ? content.qrPositionX   : 50;
  const qrPositionY   = typeof content.qrPositionY   === 'number' ? content.qrPositionY   : 50;
  const layoutMode    = content.graphicLayoutMode || 'zone';

  const qrcInstance: BldInstance = {
    seq:  pad(seq++),
    type: 'qrc',
    size: qrSizePercent,
  };
  if (layoutMode === 'freeform') {
    qrcInstance.positionLR = qrPositionX;
    qrcInstance.positionUD = qrPositionY;
  }
  instances.push(qrcInstance);

  // ── Header text ────────────────────────────────────────────────────────────
  const header = content.headerStyle || {};
  if (header.enabled && header.text) {
    instances.push({
      seq:          pad(seq),
      type:         'txt',
      role:         'header',
      text:         header.text || '',
      fontFamily:   header.fontFamily || '',
      fontSize:     header.fontSize ? Number(header.fontSize) : undefined,
      fontWeight:   header.fontWeight,
      color:        header.color || '',
      letterSpacing:   header.letterSpacing != null ? Number(header.letterSpacing) : undefined,
      strokeWidth:     header.strokeWidth   != null ? Number(header.strokeWidth)   : undefined,
      strokeColor:     header.strokeColor   || '',
      warpPreset:      header.warpPreset    || '',
      verticalOffset:  header.verticalOffset   != null ? Number(header.verticalOffset)   : undefined,
      horizontalOffset: header.horizontalOffset != null ? Number(header.horizontalOffset) : undefined,
    });
    seq++;
  }

  // ── Footer text ────────────────────────────────────────────────────────────
  const footer = content.footerStyle || {};
  if (footer.enabled && footer.text) {
    instances.push({
      seq:          pad(seq),
      type:         'txt',
      role:         'footer',
      text:         footer.text || '',
      fontFamily:   footer.fontFamily || '',
      fontSize:     footer.fontSize ? Number(footer.fontSize) : undefined,
      fontWeight:   footer.fontWeight,
      color:        footer.color || '',
      letterSpacing:   footer.letterSpacing != null ? Number(footer.letterSpacing) : undefined,
      strokeWidth:     footer.strokeWidth   != null ? Number(footer.strokeWidth)   : undefined,
      strokeColor:     footer.strokeColor   || '',
      warpPreset:      footer.warpPreset    || '',
      verticalOffset:  footer.verticalOffset   != null ? Number(footer.verticalOffset)   : undefined,
      horizontalOffset: footer.horizontalOffset != null ? Number(footer.horizontalOffset) : undefined,
    });
    seq++;
  }

  // ── Sub-bottom text ────────────────────────────────────────────────────────
  const subBottom = content.subBottomStyle || {};
  if (subBottom.enabled && subBottom.text) {
    instances.push({
      seq:        pad(seq),
      type:       'txt',
      role:       'sub_bottom',
      text:       subBottom.text || '',
      fontFamily: subBottom.fontFamily || '',
      fontSize:   subBottom.fontSize ? Number(subBottom.fontSize) : undefined,
      fontWeight: subBottom.fontWeight,
      color:      subBottom.color || '',
      letterSpacing: subBottom.letterSpacing != null ? Number(subBottom.letterSpacing) : undefined,
      strokeWidth:   subBottom.strokeWidth   != null ? Number(subBottom.strokeWidth)   : undefined,
      strokeColor:   subBottom.strokeColor   || '',
    });
    seq++;
  }

  // ── Landing text blocks (additional dynamic text layers) ───────────────────
  const landingBlocks: any[] = Array.isArray(content.landingTextBlocks)
    ? content.landingTextBlocks
    : [];
  for (const block of landingBlocks) {
    if (!block.enabled || !block.text) continue;
    instances.push({
      seq:          pad(seq),
      type:         'txt',
      role:         block.role || 'landing_text',
      text:         block.text || '',
      fontFamily:   block.fontFamily || '',
      fontSize:     block.fontSize ? Number(block.fontSize) : undefined,
      fontWeight:   block.fontWeight,
      color:        block.color || '',
      letterSpacing:    block.letterSpacing    != null ? Number(block.letterSpacing)    : undefined,
      strokeWidth:      block.strokeWidth      != null ? Number(block.strokeWidth)      : undefined,
      strokeColor:      block.strokeColor      || '',
      warpPreset:       block.warpPreset       || '',
      verticalOffset:   block.verticalOffset   != null ? Number(block.verticalOffset)   : undefined,
      horizontalOffset: block.horizontalOffset != null ? Number(block.horizontalOffset) : undefined,
      imageUrl:    block.imageUrl    || undefined,
      imageScale:  block.imageScale  != null ? Number(block.imageScale) : undefined,
    });
    seq++;
  }

  return instances;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main write function
// ─────────────────────────────────────────────────────────────────────────────

export interface WriteBldOptions {
  working:          Record<string, any>;
  sourceSessionId:  string | null;
  sourceInstanceId: string | null;
  qrgBlankId:       string | null;
  qrgBaseCode:      string | null;
  packetId:         string | null;
}

export interface WriteBldResult {
  bldId:         string;
  instanceCount: number;
  buildSequence: number;
}

/**
 * Generate a BLD definition record + sub-collection instances for a
 * builder working-state snapshot.
 *
 * Steps:
 *   1. Extract instances from working state.
 *   2. Derive counter key (e.g. "SZ" or "SP").
 *   3. Atomically allocate buildSequence.
 *   4. Format BLD ID.
 *   5. Write bld_definitions/{bldId} header.
 *   6. Write bld_definitions/{bldId}/instances/{seq} for each instance.
 */
export async function writeBldDefinition(opts: WriteBldOptions): Promise<WriteBldResult> {
  const { working, sourceSessionId, sourceInstanceId, qrgBlankId, qrgBaseCode, packetId } = opts;

  const graphics    = (working.graphics || {}) as Record<string, any>;
  const content     = (graphics.content  || {}) as Record<string, any>;
  const layoutMode  = content.graphicLayoutMode || 'zone';
  const layoutCode  = layoutMode === 'freeform' ? 'P' : 'Z';
  const counterKey  = `S${layoutCode}`;

  const instances = extractBldInstances(working);
  const instanceCount = instances.length;

  const buildSequence = await incrementBldCounter(counterKey);
  const bldId = formatBldId('S', layoutCode, instanceCount, buildSequence);

  const now = admin.firestore.FieldValue.serverTimestamp();

  const header: Omit<BldDefinitionHeader, 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
    bldId,
    context:       'S',
    layoutMode:    layoutCode as BldLayoutMode,
    instanceCount,
    buildSequence,
    sourceSessionId:  sourceSessionId  || null,
    sourceInstanceId: sourceInstanceId || null,
    qrgBlankId:       qrgBlankId       || null,
    qrgBaseCode:      qrgBaseCode      || null,
    packetId:         packetId         || null,
    graphicLayoutMode: layoutMode,
    qrProductState:    (working.qrConfig?.qrProductState) || null,
    qrSizePercent:     typeof content.qrSizePercent === 'number' ? content.qrSizePercent : 75,
    qrPositionX:       typeof content.qrPositionX   === 'number' ? content.qrPositionX   : 50,
    qrPositionY:       typeof content.qrPositionY   === 'number' ? content.qrPositionY   : 50,
    createdAt: now,
    updatedAt: now,
  };

  // Use a Firestore batch for atomic header + all instances
  const batch = db.batch();

  const defRef = db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
  batch.set(defRef, header);

  for (const inst of instances) {
    // Strip undefined values so Firestore doesn't choke
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(inst)) {
      if (v !== undefined && v !== null && v !== '') {
        clean[k] = v;
      }
    }
    const instRef = defRef.collection('instances').doc(inst.seq);
    batch.set(instRef, clean);
  }

  await batch.commit();

  console.log(`[BLD] Wrote ${bldId} with ${instanceCount} instances (session=${sourceSessionId}, instance=${sourceInstanceId})`);

  return { bldId, instanceCount, buildSequence };
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
  imageUrl?: string;    // img → raw URL (pending formal GRF registration)
  grfId?:    string;    // img / qrc → set later when GRF asset is registered
}

export interface WriteAutoAssemblyOptions {
  working:          Record<string, any>;
  qrgId:            string;           // e.g. "11101"
  bldId:            string;           // e.g. "BLD-SZ9-001"
  sourceSessionId:  string | null;
  packetId:         string | null;
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
 * Asset slots (img, qrc) are recorded without grfId at auto-create time.
 * grfId can be back-filled later via PATCH /admin/assemblies/:assemblyId
 * when the corresponding GRF asset is formally registered.
 */
export function extractAssemblyMappings(working: Record<string, any>): AutoAssemblyMapping[] {
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
    mappings.push({ seq: pad(seq++), type: 'img', imageUrl });
  }

  // ── 02 qrc — QR code slot (always present, grfId pending) ─────────────────
  mappings.push({ seq: pad(seq++), type: 'qrc' });

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
 * Never throws — callers should wrap in try/catch and treat as non-fatal.
 */
export async function writeAutoAssembly(opts: WriteAutoAssemblyOptions): Promise<WriteAutoAssemblyResult> {
  const { working, qrgId, bldId, sourceSessionId, packetId } = opts;

  const mappings = extractAssemblyMappings(working);

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
