/**
 * functions/src/services/grf-registrar.ts
 *
 * GRF (Graphic Reference Format) asset registration.
 *
 * Registers a pre-uploaded storage URL as a canonical GRF record.
 * Atomically allocates a GRF ID from grf_counters and writes to grf_assets.
 *
 * REQUIRED ORDER:
 *   1. Upload asset to Firebase Storage → get URL
 *   2. Call registerGrfAsset() → get grfId
 *   3. Use grfId in Assembly mappings
 *
 * Assembly mappings MUST use grfId — never raw URLs.
 */

import { db, admin } from '../core';
import { buildGrfId, parseGrfId, GRF_COUNTER_KEY, GRF_PACKET_SLOTS } from '../../../shared/graphicCodes';
import type { GrfAssetClass, GrfMediaType, GrfChannel, GrfPurpose } from '../../../shared/graphicCodes';

const GRF_ASSETS_COLLECTION   = 'grf_assets';
const GRF_COUNTERS_COLLECTION  = 'grf_counters';

export interface RegisterGrfAssetOptions {
  /** Pre-uploaded asset URL in Firebase Storage */
  sourceUrl:        string;
  assetClass:       GrfAssetClass;
  mediaType:        GrfMediaType;
  channel:          GrfChannel;
  purpose:          GrfPurpose;
  format:           string;
  subContext:       string;
  mimeType?:        string | null;
  sourceSessionId?: string | null;
  packetId?:        string | null;
}

export interface RegisterGrfAssetResult {
  grfId:     string;
  sourceUrl: string;
  sequence:  number;
}

/**
 * Atomically allocate the next GRF sequence from the global counter,
 * write to grf_assets, and return the canonical grfId.
 *
 * @throws if sourceUrl is empty
 * @throws if GRF params are invalid
 * @throws if the Firestore transaction fails
 */
export async function registerGrfAsset(
  opts: RegisterGrfAssetOptions,
): Promise<RegisterGrfAssetResult> {
  const { sourceUrl, assetClass, mediaType, channel, purpose, format, subContext, mimeType, sourceSessionId, packetId } = opts;

  if (!sourceUrl || sourceUrl.trim() === '') {
    throw new Error(`[GRFRegistrar] sourceUrl is required — cannot register empty URL as GRF asset`);
  }

  const counterRef = db.collection(GRF_COUNTERS_COLLECTION).doc(GRF_COUNTER_KEY);
  let sequence = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      sequence = 1;
      tx.set(counterRef, {
        count:     1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      sequence = (snap.data()!.count || 0) + 1;
      tx.update(counterRef, {
        count:     sequence,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  const grfId = buildGrfId({ assetClass, mediaType, channel, purpose, format, subContext, sequence });
  const parsed = parseGrfId(grfId);
  const now    = admin.firestore.FieldValue.serverTimestamp();

  await db.collection(GRF_ASSETS_COLLECTION).doc(grfId).set({
    grfId,
    assetClass:      parsed.assetClass,
    mediaType:       parsed.mediaType,
    channel:         parsed.channel,
    purpose:         parsed.purpose,
    format:          parsed.format,
    subContext:      parsed.subContext,
    sequence:        parsed.sequence,
    assetClassName:  parsed.assetClassName,
    mediaTypeName:   parsed.mediaTypeName,
    channelName:     parsed.channelName,
    purposeName:     parsed.purposeName,
    formatName:      parsed.formatName,
    subContextName:  parsed.subContextName,
    mimeType:        mimeType || parsed.mimeType,
    sourceUrl,
    sourceSessionId: sourceSessionId || null,
    packetId:        packetId        || null,
    source:          'auto_commit',
    isActive:        true,
    createdAt:       now,
  });

  console.log(`[GRFRegistrar] ${grfId} (${parsed.purposeName}) → ${sourceUrl.slice(0, 80)}…`);
  return { grfId, sourceUrl, sequence };
}

/**
 * Register all graphic assets from a packet at commit time.
 * Returns an object of grfIds keyed by slot name, ready for Assembly.
 *
 * Only registers URLs that are real storage assets — external QR service URLs
 * (api.qrserver.com) are skipped and must be regenerated server-side.
 */
export interface PacketGrfIds {
  backgroundGrfId:      string | null;
  qrGrfId:              string | null;
  compositeGrfId:       string | null;
  landingSnapshotGrfId: string | null;
}

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
  };

  const isStorageUrl = (url: string | null | undefined): url is string => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    if (url.startsWith('data:')) return false;
    if (url.includes('api.qrserver.com')) return false;
    return true;
  };

  const bgUrl = packetData.backgroundUrl || packetData.landingPageBackgroundUrl || null;
  if (isStorageUrl(bgUrl)) {
    const r = await registerGrfAsset({ sourceUrl: bgUrl, mimeType: 'image/png', sourceSessionId, packetId, ...GRF_PACKET_SLOTS.background });
    result.backgroundGrfId = r.grfId;
  }

  const qrUrl = packetData.qrOnlyUrl || null;
  if (isStorageUrl(qrUrl)) {
    const r = await registerGrfAsset({ sourceUrl: qrUrl, mimeType: 'image/png', sourceSessionId, packetId, ...GRF_PACKET_SLOTS.qrStandalone });
    result.qrGrfId = r.grfId;
  }

  const compositeUrl = packetData.compositeUrl || packetData.productGraphicUrl || null;
  if (isStorageUrl(compositeUrl)) {
    const r = await registerGrfAsset({ sourceUrl: compositeUrl, mimeType: 'image/png', sourceSessionId, packetId, ...GRF_PACKET_SLOTS.qrComposite });
    result.compositeGrfId = r.grfId;
  }

  const snapshotUrl = packetData.landingPageSnapshotUrl || null;
  if (isStorageUrl(snapshotUrl)) {
    const r = await registerGrfAsset({ sourceUrl: snapshotUrl, mimeType: 'image/png', sourceSessionId, packetId, ...GRF_PACKET_SLOTS.urlGraphic });
    result.landingSnapshotGrfId = r.grfId;
  }

  return result;
}
