import { builderBldLayoutMode, extractBldInstances } from '../../shared/bldCodes';
import { createBldDefinition } from '../../functions/src/services/bld-store';
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

import { buildGrfId, parseGrfId, GRF_COUNTER_KEY, GRF_PACKET_SLOTS } from '../../shared/GRF_engine';
import type { GrfAssetClass, GrfMediaType, GrfChannel } from '../../shared/GRF_engine';

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
  glamorShotGrfId:      string | null;
  storeFrontGrfId:      string | null;
}

async function getDb(): Promise<FirebaseFirestore.Firestore> {
  const { getFirestoreDb } = await import('../lib/firebase-admin');
  return getFirestoreDb();
}

export async function registerGrfDev(opts: {
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

  // ── GRF engine: dedup by sourceUrl ───────────────────────────────────────
  // If this exact URL already has a GRF ID, reuse it — the atomic number
  // follows the asset, never re-minted for the same file.
  const existing = await db.collection('grf_assets')
    .where('sourceUrl', '==', sourceUrl)
    .limit(1)
    .get();
  if (!existing.empty) {
    const existingGrfId = existing.docs[0].data().grfId as string;
    if (packetId || sourceSessionId) {
      await existing.docs[0].ref.update({
        ...(packetId       ? { packetId }       : {}),
        ...(sourceSessionId ? { sourceSessionId } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    console.log(`[GRF-engine] reused existing grfId=${existingGrfId} for url=${sourceUrl}`);
    return existingGrfId;
  }
  // ─────────────────────────────────────────────────────────────────────────

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
    glamorShotGrfId: null, storeFrontGrfId: null,
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

/**
 * Register lifestyle and priority mockup URLs as GRF assets (dev parity).
 * Called from the dev-server PATCH handler when mockup URLs arrive post-commit.
 */
const PLACEMENT_TO_GRF_SLOT_DEV: Record<string, keyof typeof GRF_PACKET_SLOTS> = {
  front:       'storeFront',
  front_large: 'storeFront',
  front_small: 'storeFront',
  back:        'storeBack',
};

export async function registerMockupGrfsDev(
  packetId:            string,
  lifestyleMockupUrl:  string | null,
  placementMockupUrls: Record<string, string> | null,
): Promise<{ glamorShotGrfId: string | null; storeFrontGrfId: string | null; storeBackGrfId: string | null }> {
  const db = await getDb();
  const result = {
    glamorShotGrfId: null as string | null,
    storeFrontGrfId: null as string | null,
    storeBackGrfId:  null as string | null,
  };

  const isMockupUrl = (url: string | null | undefined): url is string =>
    !!url && typeof url === 'string' && url.trim() !== '' && !url.startsWith('data:');

  if (isMockupUrl(lifestyleMockupUrl))
    result.glamorShotGrfId = await registerGrfDev({ db, sourceUrl: lifestyleMockupUrl, mimeType: 'image/jpeg', packetId, ...GRF_PACKET_SLOTS.glamorShot });

  for (const [placement, url] of Object.entries(placementMockupUrls || {})) {
    if (!isMockupUrl(url)) continue;
    const slotKey = PLACEMENT_TO_GRF_SLOT_DEV[placement.toLowerCase()];
    if (!slotKey) {
      console.log(`[GRFRegistrar-dev] No GRF slot for placement "${placement}" — skipping`);
      continue;
    }
    const grfId = await registerGrfDev({ db, sourceUrl: url, mimeType: 'image/jpeg', packetId, ...GRF_PACKET_SLOTS[slotKey] });
    if (slotKey === 'storeFront') result.storeFrontGrfId = grfId;
    if (slotKey === 'storeBack')  result.storeBackGrfId  = grfId;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLD extraction helpers (pure — no Firestore)
// ─────────────────────────────────────────────────────────────────────────────

export async function writeBldDev({ working }: { working: Record<string, any> }): Promise<{ bldId: string; instanceCount: number }> {
  const db = await getDb();
  const { FieldValue } = await import('firebase-admin/firestore');
  const definition = await createBldDefinition(db, () => FieldValue.serverTimestamp(), {
    context: 'S', layoutMode: builderBldLayoutMode(working.graphics?.content?.graphicLayoutMode),
    instances: extractBldInstances(working), source: 'builder',
  });
  return { bldId: definition.bldId, instanceCount: definition.instanceCount };
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
