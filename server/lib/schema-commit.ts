/**
 * server/lib/schema-commit.ts
 *
 * Dev-server equivalents of the schema-write services in functions/src/services/.
 * Uses the dev server's dynamic Firebase Admin import pattern.
 *
 * These run only during local development — production uses functions/src/services/.
 *
 * Functions exported:
 *   writeBldDev        — mirrors functions/src/services/bld-builder writeBldDefinition
 *   writeAssemblyDev   — mirrors functions/src/services/bld-builder writeAutoAssembly
 *   registerGrfDev     — mirrors functions/src/services/grf-registrar registerGrfAsset
 *   registerPacketGrfsDev — registers all packet GRF assets
 */

import { buildGrfId, parseGrfId, GRF_COUNTER_KEY, GRF_PACKET_SLOTS } from '../../shared/graphicCodes';
import type { GrfAssetClass, GrfMediaType, GrfChannel } from '../../shared/graphicCodes';

// ─────────────────────────────────────────────────────────────────────────────
// QRG instance allocation
// ─────────────────────────────────────────────────────────────────────────────

export interface DevQrgIdentity {
  qrgBlankId:     string;
  qrgContext:     string;
  instanceNumber: string;
  qrgBaseCode:    string;
  variantCode:    string | null;
  qrgFullCode:    string | null;
}

/** Matches isValidQrgBlankId from shared/qrgCodes.ts */
function isValidQrgBlankIdDev(id: string): boolean {
  return /^[1-6][1-9]\d{3}$/.test(id);
}

export async function allocateQrgInstanceDev(
  qrgBlankId: string,
  context: 'I' | 'M' | 'E' | 'O',
): Promise<DevQrgIdentity> {
  if (!isValidQrgBlankIdDev(qrgBlankId)) {
    throw new Error(
      `[QRGAllocator-dev] Invalid qrgBlankId: "${qrgBlankId}". Must be 5-digit STNNN (S=1-6, T=1-9, NNN=000-999).`,
    );
  }

  const db = await getDb();
  const { FieldValue } = await import('firebase-admin/firestore');

  const counterKey = `${qrgBlankId}_${context}`;
  const counterRef = db.collection('qrg_counters').doc(counterKey);
  let num = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      num = 1;
      tx.set(counterRef, {
        lastInstanceNumber: 1, qrgBlankId, contextCode: context,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      num = (snap.data()!.lastInstanceNumber || 0) + 1;
      tx.update(counterRef, { lastInstanceNumber: num, updatedAt: FieldValue.serverTimestamp() });
    }
  });

  const instanceNumber = String(num).padStart(6, '0');
  const qrgBaseCode    = `QRG-${qrgBlankId}-${context}-${instanceNumber}`;

  return { qrgBlankId, qrgContext: context, instanceNumber, qrgBaseCode, variantCode: null, qrgFullCode: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRF registration
// ─────────────────────────────────────────────────────────────────────────────

export interface DevGrfIds {
  backgroundGrfId:      string | null;
  qrGrfId:              string | null;
  compositeGrfId:       string | null;
  landingSnapshotGrfId: string | null;
}

async function getDb(): Promise<FirebaseFirestore.Firestore> {
  const { getFirestoreDb } = await import('../lib/firebase-admin');
  return getFirestoreDb();
}

async function registerGrfDev(opts: {
  db:               FirebaseFirestore.Firestore;
  sourceUrl:        string;
  assetClass:       GrfAssetClass;
  mediaType:        GrfMediaType;
  channel:          GrfChannel;
  purpose:          string;
  format:           string;
  mimeType?:        string | null;
  sourceSessionId?: string | null;
  packetId?:        string | null;
}): Promise<string> {
  const { db, sourceUrl, assetClass, mediaType, channel, purpose, format, mimeType, sourceSessionId, packetId } = opts;
  const { FieldValue } = await import('firebase-admin/firestore');

  const counterRef = db.collection('grf_counters').doc(GRF_COUNTER_KEY);
  let sequence = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      sequence = 1;
      tx.set(counterRef, { count: 1, createdAt: FieldValue.serverTimestamp() });
    } else {
      sequence = (snap.data()!.count || 0) + 1;
      tx.update(counterRef, { count: sequence, updatedAt: FieldValue.serverTimestamp() });
    }
  });

  const grfId = buildGrfId({ assetClass, mediaType, channel, purpose, format, sequence });
  const parsed = parseGrfId(grfId);
  const now    = FieldValue.serverTimestamp();

  await db.collection('grf_assets').doc(grfId).set({
    grfId,
    assetClass:     parsed.assetClass,
    mediaType:      parsed.mediaType,
    channel:        parsed.channel,
    purpose:        parsed.purpose,
    format:         parsed.format,
    sequence:       parsed.sequence,
    assetClassName: parsed.assetClassName,
    mediaTypeName:  parsed.mediaTypeName,
    channelName:    parsed.channelName,
    purposeName:    parsed.purposeName,
    formatName:     parsed.formatName,
    mimeType:       mimeType || parsed.mimeType,
    sourceUrl,
    sourceSessionId: sourceSessionId || null,
    packetId:        packetId        || null,
    source:          'auto_commit',
    isActive:        true,
    createdAt:       now,
  });

  console.log(`[GRFRegistrar-dev] ${grfId} (${parsed.channelName}/${parsed.purposeName}) → ${sourceUrl.slice(0, 80)}…`);
  return grfId;
}

export async function registerPacketGrfsDev(
  packetData:      Record<string, any>,
  sourceSessionId: string | null,
  packetId:        string | null,
): Promise<DevGrfIds> {
  const db = await getDb();
  const result: DevGrfIds = {
    backgroundGrfId: null, qrGrfId: null, compositeGrfId: null, landingSnapshotGrfId: null,
  };

  const isStorageUrl = (u: string | null | undefined): u is string =>
    !!u && typeof u === 'string' && !u.startsWith('data:') && !u.includes('api.qrserver.com');

  const bgUrl = packetData.backgroundUrl || packetData.landingPageBackgroundUrl || null;
  if (isStorageUrl(bgUrl))
    result.backgroundGrfId = await registerGrfDev({ db, sourceUrl: bgUrl, ...GRF_PACKET_SLOTS.background, sourceSessionId, packetId });

  const qrUrl = packetData.qrOnlyUrl || null;
  if (isStorageUrl(qrUrl))
    result.qrGrfId = await registerGrfDev({ db, sourceUrl: qrUrl, ...GRF_PACKET_SLOTS.qrStandalone, sourceSessionId, packetId });

  const compositeUrl = packetData.compositeUrl || packetData.productGraphicUrl || null;
  if (isStorageUrl(compositeUrl))
    result.compositeGrfId = await registerGrfDev({ db, sourceUrl: compositeUrl, ...GRF_PACKET_SLOTS.qrComposite, sourceSessionId, packetId });

  const snapshotUrl = packetData.landingPageSnapshotUrl || null;
  if (isStorageUrl(snapshotUrl))
    result.landingSnapshotGrfId = await registerGrfDev({ db, sourceUrl: snapshotUrl, ...GRF_PACKET_SLOTS.urlSnapshot, sourceSessionId, packetId });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLD extraction helpers (pure — no Firestore)
// ─────────────────────────────────────────────────────────────────────────────

interface BldInstance {
  seq: string; type: string; role?: string;
  fontFamily?: string; fontSize?: number; fontWeight?: number | string;
  letterSpacing?: number; strokeWidth?: number; strokeColor?: string;
  color?: string; text?: string; warpPreset?: string;
  verticalOffset?: number; horizontalOffset?: number;
  url?: string; size?: number; positionLR?: number; positionUD?: number;
  imageUrl?: string; imageScale?: number;
}

function extractBldInstancesDev(working: Record<string, any>): BldInstance[] {
  const graphics = (working.graphics || {}) as Record<string, any>;
  const content  = (graphics.content  || {}) as Record<string, any>;
  const instances: BldInstance[] = [];
  let seq = 1;
  const pad = (n: number) => String(n).padStart(2, '0');

  const bgUrl      = graphics.loadedBackground?.url || null;
  const areaImgUrl = content.areaImageUrl || null;
  const imageUrl   = bgUrl || areaImgUrl || null;
  if (imageUrl) {
    instances.push({ seq: pad(seq++), type: 'img', role: bgUrl ? 'background' : 'area_image', imageUrl,
      size: content.areaImageScale ?? 100, positionLR: content.areaImageOffsetX ?? 50, positionUD: content.areaImageOffsetY ?? 50 });
  }

  const qrSizePercent = typeof content.qrSizePercent === 'number' ? content.qrSizePercent : 75;
  const qrPositionX   = typeof content.qrPositionX   === 'number' ? content.qrPositionX   : 50;
  const qrPositionY   = typeof content.qrPositionY   === 'number' ? content.qrPositionY   : 50;
  const layoutMode    = content.graphicLayoutMode || 'zone';

  const qrcInstance: BldInstance = { seq: pad(seq++), type: 'qrc', size: qrSizePercent };
  if (layoutMode === 'freeform') { qrcInstance.positionLR = qrPositionX; qrcInstance.positionUD = qrPositionY; }
  instances.push(qrcInstance);

  const textLayer = (style: Record<string, any>, role: string) => {
    if (!style.enabled || !style.text) return;
    instances.push({ seq: pad(seq), type: 'txt', role, text: style.text, fontFamily: style.fontFamily || '',
      fontSize: style.fontSize ? Number(style.fontSize) : undefined, fontWeight: style.fontWeight,
      color: style.color || '', letterSpacing: style.letterSpacing != null ? Number(style.letterSpacing) : undefined,
      strokeWidth: style.strokeWidth != null ? Number(style.strokeWidth) : undefined, strokeColor: style.strokeColor || '',
      warpPreset: style.warpPreset || '', verticalOffset: style.verticalOffset != null ? Number(style.verticalOffset) : undefined,
      horizontalOffset: style.horizontalOffset != null ? Number(style.horizontalOffset) : undefined });
    seq++;
  };

  textLayer(content.headerStyle   || {}, 'header');
  textLayer(content.footerStyle   || {}, 'footer');
  textLayer(content.subBottomStyle || {}, 'sub_bottom');

  for (const block of (Array.isArray(content.landingTextBlocks) ? content.landingTextBlocks : [])) {
    if (!block.enabled || !block.text) continue;
    textLayer(block, block.role || 'landing_text');
  }

  return instances;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLD write
// ─────────────────────────────────────────────────────────────────────────────

export async function writeBldDev(opts: {
  working:          Record<string, any>;
  sourceSessionId:  string | null;
  sourceInstanceId: string | null;
  qrgBlankId:       string | null;
  qrgBaseCode:      string | null;
  packetId:         string | null;
}): Promise<{ bldId: string; instanceCount: number }> {
  const db = await getDb();
  const { FieldValue } = await import('firebase-admin/firestore');
  const { working, sourceSessionId, sourceInstanceId, qrgBlankId, qrgBaseCode, packetId } = opts;

  const graphics   = (working.graphics || {}) as Record<string, any>;
  const content    = (graphics.content  || {}) as Record<string, any>;
  const layoutMode = content.graphicLayoutMode || 'zone';
  const layoutCode = layoutMode === 'freeform' ? 'P' : 'Z';
  const counterKey = `S${layoutCode}`;

  const instances     = extractBldInstancesDev(working);
  const instanceCount = instances.length;

  const counterRef = db.collection('bld_counters').doc(counterKey);
  let buildSequence = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      buildSequence = 1;
      tx.set(counterRef, { count: 1, key: counterKey, createdAt: FieldValue.serverTimestamp() });
    } else {
      buildSequence = (snap.data()!.count || 0) + 1;
      tx.update(counterRef, { count: buildSequence, updatedAt: FieldValue.serverTimestamp() });
    }
  });

  const seq   = String(buildSequence).padStart(3, '0');
  const bldId = `BLD-S${layoutCode}${instanceCount}-${seq}`;
  const now   = FieldValue.serverTimestamp();

  const header = {
    bldId, context: 'S', layoutMode: layoutCode, instanceCount, buildSequence,
    sourceSessionId: sourceSessionId || null, sourceInstanceId: sourceInstanceId || null,
    qrgBlankId: qrgBlankId || null, qrgBaseCode: qrgBaseCode || null, packetId: packetId || null,
    graphicLayoutMode: layoutMode,
    qrProductState: (working.qrConfig?.qrProductState) || null,
    qrSizePercent:  typeof content.qrSizePercent === 'number' ? content.qrSizePercent : 75,
    qrPositionX:    typeof content.qrPositionX   === 'number' ? content.qrPositionX   : 50,
    qrPositionY:    typeof content.qrPositionY   === 'number' ? content.qrPositionY   : 50,
    createdAt: now, updatedAt: now,
  };

  const batch = db.batch();
  const defRef = db.collection('bld_definitions').doc(bldId);
  batch.set(defRef, header);

  for (const inst of instances) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(inst)) {
      if (v !== undefined && v !== null && v !== '') clean[k] = v;
    }
    batch.set(defRef.collection('instances').doc(inst.seq), clean);
  }
  await batch.commit();

  console.log(`[BLD-dev] Wrote ${bldId} with ${instanceCount} instances`);
  return { bldId, instanceCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assembly write
// ─────────────────────────────────────────────────────────────────────────────

export async function writeAssemblyDev(opts: {
  working:         Record<string, any>;
  qrgId:           string;
  bldId:           string;
  sourceSessionId: string | null;
  packetId:        string | null;
  grfIds:          DevGrfIds;
}): Promise<{ assemblyId: string; mappingCount: number }> {
  const db = await getDb();
  const { FieldValue } = await import('firebase-admin/firestore');
  const { working, qrgId, bldId, sourceSessionId, packetId, grfIds } = opts;

  const graphics = (working.graphics || {}) as Record<string, any>;
  const content  = (graphics.content  || {}) as Record<string, any>;

  const mappings: Array<Record<string, any>> = [];
  let seq = 1;
  const pad = (n: number) => String(n).padStart(2, '0');

  const bgUrl      = graphics.loadedBackground?.url || null;
  const areaImgUrl = content.areaImageUrl || null;
  const imageUrl   = bgUrl || areaImgUrl || null;
  if (imageUrl) {
    const grfId = grfIds.backgroundGrfId;
    if (!grfId) throw new Error(`[Assembly-dev] Background image slot has no registered GRF ID`);
    mappings.push({ seq: pad(seq++), type: 'img', grfId, imageUrl });
  }

  // QR slot: only write a mapping when a real GRF ID exists.
  // External QR URLs (api.qrserver.com) are skipped by registerPacketGrfsDev,
  // so qrGrfId will be null when no stored QR asset was uploaded — that is valid.
  // The QR image is generated dynamically at render time from qrgBaseCode.
  const qrGrfId = grfIds.qrGrfId;
  if (qrGrfId) {
    mappings.push({ seq: pad(seq++), type: 'qrc', grfId: qrGrfId });
  }

  const textSlot = (style: Record<string, any>) => {
    if (!style.enabled || !style.text) return;
    const m: Record<string, any> = { seq: pad(seq++), type: 'txt', value: style.text };
    if (style.color) m.color = style.color;
    mappings.push(m);
  };

  textSlot(content.headerStyle   || {});
  textSlot(content.footerStyle   || {});
  textSlot(content.subBottomStyle || {});

  for (const block of (Array.isArray(content.landingTextBlocks) ? content.landingTextBlocks : [])) {
    if (!block.enabled || !block.text) continue;
    textSlot(block);
  }

  const counterRef = db.collection('asm_counters').doc('global');
  const sequence   = await db.runTransaction(async (tx) => {
    const doc  = await tx.get(counterRef);
    const next = (doc.exists ? (doc.data()?.count ?? 0) : 0) + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });

  const assemblyId = `ASM-${String(sequence).padStart(6, '0')}`;
  const now = FieldValue.serverTimestamp();

  await db.collection('assemblies').doc(assemblyId).set({
    assemblyId, sequence, qrgId, bldId,
    mappings,
    packetIds:       packetId ? [packetId] : [],
    sourceSessionId: sourceSessionId || null,
    source:          'auto_commit',
    createdAt:       now, createdBy: 'system',
  });

  console.log(`[Assembly-dev] Wrote ${assemblyId} — qrgId=${qrgId} bldId=${bldId} mappings=${mappings.length}`);
  return { assemblyId, mappingCount: mappings.length };
}
