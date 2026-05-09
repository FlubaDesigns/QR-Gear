/**
 * functions/src/services/grf-registrar.ts
 *
 * GRF asset registration — single authoritative mint engine for production.
 * ALL GRF minting goes through this file. Routes must NOT inline counter
 * transactions, buildGrfId calls, or grf_assets writes.
 *
 * Two source modes:
 *   imageData  — raw base64 (no data: prefix); registrar uploads to Storage,
 *                builds canonical path from the minted GRF ID, writes Firestore.
 *   sourceUrl  — asset already in Storage; registrar dedup-checks by URL,
 *                mints only if not found, writes Firestore.
 *
 * Required order for imageData mode:
 *   1. Call registerGrfAsset({ imageData, ... }) → get { grfId, publicUrl }
 *   2. Use grfId downstream (Assembly mappings, etc.)
 *
 * Required order for sourceUrl mode:
 *   1. Upload asset to Firebase Storage → get URL
 *   2. Call registerGrfAsset({ sourceUrl, ... }) → get { grfId }
 *   3. Use grfId downstream
 */

import { db, admin } from '../core';
import {
  buildGrfId, parseGrfId, grfStoragePath,
  GRF_COUNTER_KEY, GRF_PACKET_SLOTS,
} from '../../../shared/GRF_engine';
import type { GrfAssetClass, GrfMediaType, GrfChannel } from '../../../shared/GRF_engine';

const GRF_ASSETS_COLLECTION  = 'grf_assets';
const GRF_COUNTERS_COLLECTION = 'grf_counters';

// ── Options ───────────────────────────────────────────────────────────────────

export interface RegisterGrfAssetOptions {
  // GRF classification (required)
  assetClass: GrfAssetClass;
  mediaType:  GrfMediaType;
  channel:    GrfChannel;
  purpose:    string;
  format:     string;

  // Asset source — provide exactly one:
  sourceUrl?: string;         // pre-uploaded Storage URL (packet / background flow)
  imageData?: string;         // raw base64, no data: prefix (library upload / crop flow)

  // Metadata
  mimeType?:         string | null;
  name?:             string | null;
  description?:      string | null;
  originalFilename?: string | null;
  storagePath?:      string | null;  // override canonical storage path (imageData mode)
  sourceGrfId?:      string | null;
  relatedPacketId?:  string | null;
  tags?:             string[] | null;
  createdBy?:        string;

  // Packet-commit dedup fields (sourceUrl mode only)
  sourceSessionId?: string | null;
  packetId?:        string | null;
}

export interface RegisterGrfAssetResult {
  grfId:       string;
  publicUrl:   string;
  storagePath: string | null;
  sequence:    number;
}

// ── Core mint ─────────────────────────────────────────────────────────────────

async function allocateSequence(): Promise<number> {
  const counterRef = db.collection(GRF_COUNTERS_COLLECTION).doc(GRF_COUNTER_KEY);
  let sequence = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      sequence = 1;
      tx.set(counterRef, { count: 1, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      sequence = (snap.data()!.count || 0) + 1;
      tx.update(counterRef, {
        count:     sequence,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
  return sequence;
}

/**
 * Register a GRF asset. Mints a new canonical GRF ID and writes to grf_assets.
 *
 * @throws if neither sourceUrl nor imageData is provided
 * @throws if GRF params are invalid
 */
export async function registerGrfAsset(
  opts: RegisterGrfAssetOptions,
): Promise<RegisterGrfAssetResult> {
  const {
    assetClass, mediaType, channel, purpose, format,
    sourceUrl, imageData,
    mimeType, name, description, originalFilename,
    storagePath: storagePathOverride,
    sourceGrfId, relatedPacketId, tags,
    createdBy = 'admin',
    sourceSessionId, packetId,
  } = opts;

  if (!sourceUrl && !imageData) {
    throw new Error('[GRFRegistrar] Either sourceUrl or imageData is required');
  }

  // ── sourceUrl mode: dedup by URL ─────────────────────────────────────────
  if (sourceUrl && !imageData) {
    if (sourceUrl.trim() === '') {
      throw new Error('[GRFRegistrar] sourceUrl must not be empty');
    }

    const existing = await db.collection(GRF_ASSETS_COLLECTION)
      .where('sourceUrl', '==', sourceUrl)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc        = existing.docs[0];
      const data       = doc.data();
      const existingId = data.grfId as string;

      if (packetId || sourceSessionId) {
        await doc.ref.update({
          ...(packetId        ? { packetId }        : {}),
          ...(sourceSessionId ? { sourceSessionId } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      console.log(`[GRFRegistrar] reused grfId=${existingId} for url=${sourceUrl.slice(0, 80)}…`);
      return {
        grfId:       existingId,
        publicUrl:   data.publicUrl || sourceUrl,
        storagePath: data.storagePath || null,
        sequence:    data.sequence   || 0,
      };
    }
  }

  // ── Allocate sequence + build GRF ID ─────────────────────────────────────
  const sequence = await allocateSequence();
  const grfId    = buildGrfId({ assetClass, mediaType, channel, purpose, format, sequence });
  const parsed   = parseGrfId(grfId);
  const now      = admin.firestore.FieldValue.serverTimestamp();

  // ── imageData mode: upload to Storage ────────────────────────────────────
  let publicUrl:   string;
  let storagePath: string | null;

  if (imageData) {
    const ext         = (mimeType || '').includes('png') ? 'png' : 'jpg';
    const canonicalPath = storagePathOverride
      || grfStoragePath(grfId)
      || `grf/${grfId}/original.${ext}`;

    const bucket     = admin.storage().bucket();
    const buffer     = Buffer.from(imageData, 'base64');
    const fileRef    = bucket.file(canonicalPath);
    await fileRef.save(buffer, { metadata: { contentType: mimeType || 'image/jpeg' } });
    await fileRef.makePublic();

    const encoded = canonicalPath.split('/').map(encodeURIComponent).join('/');
    publicUrl     = `https://storage.googleapis.com/${bucket.name}/${encoded}`;
    storagePath   = canonicalPath;

    console.log(`[GRFRegistrar] uploaded base64 → ${publicUrl}`);
  } else {
    publicUrl   = sourceUrl!;
    storagePath = null;
  }

  // ── Write grf_assets ─────────────────────────────────────────────────────
  const assetData: Record<string, any> = {
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
    name:           name    || `${parsed.purposeName} ${grfId}`,
    description:    description    || null,
    storagePath,
    publicUrl,
    sourceUrl:      publicUrl,   // keep both field names populated
    sourceGrfId:    sourceGrfId   || null,
    relatedPacketId: relatedPacketId || null,
    tags:           tags           || null,
    sourceSessionId: sourceSessionId || null,
    packetId:        packetId        || null,
    source:          'grf_registrar',
    createdBy,
    isActive:        true,
    createdAt:       now,
  };

  if (parsed.channel === '4' && parsed.purpose === '1') {
    assetData.originalFilename = originalFilename || null;
  }

  await db.collection(GRF_ASSETS_COLLECTION).doc(grfId).set(assetData);

  console.log(`[GRFRegistrar] minted ${grfId} (${parsed.channelName}/${parsed.purposeName}) → ${publicUrl.slice(0, 80)}…`);
  return { grfId, publicUrl, storagePath, sequence };
}

// ── Packet registration (multi-slot) ─────────────────────────────────────────

export interface PacketGrfIds {
  backgroundGrfId:      string | null;
  qrGrfId:              string | null;
  compositeGrfId:       string | null;
  landingSnapshotGrfId: string | null;
  glamorShotGrfId:      string | null;
  storeFrontGrfId:      string | null;
}

/**
 * Register all graphic assets from a packet at commit time.
 * Skips external QR URLs (api.qrserver.com) and data URLs.
 */
export async function registerPacketGrfAssets(
  packetData:      Record<string, any>,
  sourceSessionId: string | null,
  packetId:        string | null,
): Promise<PacketGrfIds> {
  const result: PacketGrfIds = {
    backgroundGrfId:      null,
    qrGrfId:              null,
    compositeGrfId:       null,
    landingSnapshotGrfId: null,
    glamorShotGrfId:      null,
    storeFrontGrfId:      null,
  };

  const isStorageUrl = (url: string | null | undefined): url is string => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    if (url.startsWith('data:'))              return false;
    if (url.includes('api.qrserver.com'))     return false;
    return true;
  };

  const bgUrl = packetData.backgroundUrl || packetData.landingPageBackgroundUrl || null;
  if (isStorageUrl(bgUrl)) {
    const r = await registerGrfAsset({
      sourceUrl: bgUrl, mimeType: 'image/png', sourceSessionId, packetId,
      ...GRF_PACKET_SLOTS.background,
    });
    result.backgroundGrfId = r.grfId;
  }

  const qrUrl = packetData.qrOnlyUrl || null;
  if (isStorageUrl(qrUrl)) {
    const r = await registerGrfAsset({
      sourceUrl: qrUrl, mimeType: 'image/png', sourceSessionId, packetId,
      ...GRF_PACKET_SLOTS.qrStandalone,
    });
    result.qrGrfId = r.grfId;
  }

  const compositeUrl = packetData.compositeUrl || packetData.productGraphicUrl || null;
  if (isStorageUrl(compositeUrl)) {
    const r = await registerGrfAsset({
      sourceUrl: compositeUrl, mimeType: 'image/png', sourceSessionId, packetId,
      ...GRF_PACKET_SLOTS.qrComposite,
    });
    result.compositeGrfId = r.grfId;
  }

  const snapshotUrl = packetData.landingPageSnapshotUrl || null;
  if (isStorageUrl(snapshotUrl)) {
    const r = await registerGrfAsset({
      sourceUrl: snapshotUrl, mimeType: 'image/png', sourceSessionId, packetId,
      ...GRF_PACKET_SLOTS.urlSnapshot,
    });
    result.landingSnapshotGrfId = r.grfId;
  }

  return result;
}

// ── Mockup registration (post-commit) ─────────────────────────────────────────

export interface MockupGrfIds {
  glamorShotGrfId: string | null;
  storeFrontGrfId: string | null;
  storeBackGrfId:  string | null;
}

/** Maps canonical placement names to their GRF slot. Unrecognised placements are logged only. */
const PLACEMENT_TO_GRF_SLOT: Record<string, keyof typeof GRF_PACKET_SLOTS> = {
  front:        'storeFront',
  front_large:  'storeFront',
  front_small:  'storeFront',
  back:         'storeBack',
};

/**
 * Register lifestyle and placement mockup URLs as GRF assets.
 * Called from the packet PATCH route when mockup URLs arrive (after commit).
 */
export async function registerMockupGrfAssets(
  packetId:            string,
  lifestyleMockupUrl:  string | null,
  placementMockupUrls: Record<string, string> | null,
): Promise<MockupGrfIds> {
  const result: MockupGrfIds = { glamorShotGrfId: null, storeFrontGrfId: null, storeBackGrfId: null };

  const isMockupUrl = (url: string | null | undefined): url is string =>
    !!url && typeof url === 'string' && url.trim() !== '' && !url.startsWith('data:');

  if (isMockupUrl(lifestyleMockupUrl)) {
    const r = await registerGrfAsset({
      sourceUrl: lifestyleMockupUrl, mimeType: 'image/jpeg', packetId,
      ...GRF_PACKET_SLOTS.glamorShot,
    });
    result.glamorShotGrfId = r.grfId;
  }

  for (const [placement, url] of Object.entries(placementMockupUrls || {})) {
    if (!isMockupUrl(url)) continue;
    const slotKey = PLACEMENT_TO_GRF_SLOT[placement.toLowerCase()];
    if (!slotKey) {
      console.log(`[GRFRegistrar] No GRF slot for placement "${placement}" — skipping registration`);
      continue;
    }
    const r = await registerGrfAsset({
      sourceUrl: url, mimeType: 'image/jpeg', packetId,
      ...GRF_PACKET_SLOTS[slotKey],
    });
    if (slotKey === 'storeFront') result.storeFrontGrfId = r.grfId;
    if (slotKey === 'storeBack')  result.storeBackGrfId  = r.grfId;
  }

  return result;
}
