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
import type { GrfTypeCode, GrfRoleCode } from '../../../shared/graphicCodes';
import { buildGraphicId, grfCounterKey, GRF_TYPE_MAP } from '../../../shared/graphicCodes';

const GRF_ASSETS_COLLECTION   = 'grf_assets';
const GRF_COUNTERS_COLLECTION  = 'grf_counters';

export interface RegisterGrfAssetOptions {
  /** Pre-uploaded asset URL in Firebase Storage */
  sourceUrl:        string;
  typeCode:         GrfTypeCode;
  roleCode:         GrfRoleCode;
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
 * Atomically allocate the next GRF sequence for a typeCode+roleCode pair,
 * write to grf_assets, and return the canonical grfId.
 *
 * @throws if sourceUrl is empty
 * @throws if typeCode+roleCode pairing is invalid
 * @throws if the Firestore transaction fails
 */
export async function registerGrfAsset(
  opts: RegisterGrfAssetOptions,
): Promise<RegisterGrfAssetResult> {
  const { sourceUrl, typeCode, roleCode, mimeType, sourceSessionId, packetId } = opts;

  if (!sourceUrl || sourceUrl.trim() === '') {
    throw new Error(`[GRFRegistrar] sourceUrl is required — cannot register empty URL as GRF asset`);
  }

  // Canon (GRF.md): mimeType must be provided and compatible with typeCode.
  // All current GRF types (01–07) require image/* — no silent default allowed.
  if (!mimeType || mimeType.trim() === '') {
    throw new Error(
      `[GRFRegistrar] mimeType is required for typeCode "${typeCode}" — provide a valid MIME type (e.g. "image/png"). No default is applied.`,
    );
  }
  if (!mimeType.startsWith('image/')) {
    throw new Error(
      `[GRFRegistrar] mimeType "${mimeType}" is not compatible with typeCode "${typeCode}". ` +
      `All current GRF asset types (01–07) require an image/* MIME type.`,
    );
  }

  const typeEntry = GRF_TYPE_MAP[typeCode];
  if (!typeEntry) {
    throw new Error(`[GRFRegistrar] Unknown GRF typeCode: "${typeCode}"`);
  }
  if (!typeEntry.validRoles.includes(roleCode)) {
    throw new Error(
      `[GRFRegistrar] Role "${roleCode}" is not valid for typeCode "${typeCode}". ` +
      `Valid roles: ${typeEntry.validRoles.join(', ')}`,
    );
  }

  const counterKey = grfCounterKey(typeCode, roleCode);
  const counterRef = db.collection(GRF_COUNTERS_COLLECTION).doc(counterKey);
  let sequence = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      sequence = 1;
      tx.set(counterRef, {
        count:    1,
        typeCode,
        roleCode,
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

  const grfId = buildGraphicId(typeCode, roleCode, sequence);
  const now   = admin.firestore.FieldValue.serverTimestamp();

  await db.collection(GRF_ASSETS_COLLECTION).doc(grfId).set({
    grfId,
    typeCode,
    roleCode,
    typeName:        typeEntry.label,
    typeDescription: typeEntry.description,
    sequence,
    sourceUrl,
    mimeType:        mimeType,
    sourceSessionId: sourceSessionId || null,
    packetId:        packetId        || null,
    source:          'auto_commit',
    isActive:        true,
    createdAt:       now,
  });

  console.log(`[GRFRegistrar] ${grfId} (${typeEntry.label}) → ${sourceUrl.slice(0, 80)}…`);
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
    const r = await registerGrfAsset({ sourceUrl: bgUrl, typeCode: '03', roleCode: '3', mimeType: 'image/png', sourceSessionId, packetId });
    result.backgroundGrfId = r.grfId;
  }

  const qrUrl = packetData.qrOnlyUrl || null;
  if (isStorageUrl(qrUrl)) {
    const r = await registerGrfAsset({ sourceUrl: qrUrl, typeCode: '04', roleCode: '3', mimeType: 'image/png', sourceSessionId, packetId });
    result.qrGrfId = r.grfId;
  }

  const compositeUrl = packetData.compositeUrl || packetData.productGraphicUrl || null;
  if (isStorageUrl(compositeUrl)) {
    const r = await registerGrfAsset({ sourceUrl: compositeUrl, typeCode: '05', roleCode: '3', mimeType: 'image/png', sourceSessionId, packetId });
    result.compositeGrfId = r.grfId;
  }

  const snapshotUrl = packetData.landingPageSnapshotUrl || null;
  if (isStorageUrl(snapshotUrl)) {
    const r = await registerGrfAsset({ sourceUrl: snapshotUrl, typeCode: '06', roleCode: '3', mimeType: 'image/png', sourceSessionId, packetId });
    result.landingSnapshotGrfId = r.grfId;
  }

  return result;
}
