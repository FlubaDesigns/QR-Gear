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


async function getDb() { const { getFirestoreDb } = await import('./firebase-admin'); return getFirestoreDb(); }
import { createGrfRegistrar, type RegisterGrfAssetOptions, type PacketGrfIds } from '../../functions/src/services/grf-store';
import { resolveBuilderBld } from '../../functions/src/services/bld-store';
import { createAutoAssembly, type AutoAssemblyOptions } from '../../functions/src/services/assembly-store';
export type DevGrfIds = PacketGrfIds;
export async function getGrfRegistrar() {
  const { FieldValue, getStorageBucket } = await import('./firebase-admin');
  return createGrfRegistrar({ db: await getDb(), now: () => FieldValue.serverTimestamp(), bucket: getStorageBucket });
}
export async function registerGrfDev(opts: RegisterGrfAssetOptions & { db?: FirebaseFirestore.Firestore }) {
  return (await (await getGrfRegistrar()).registerGrfAsset(opts)).grfId;
}
export async function registerPacketGrfsDev(packet: Record<string, any>, sessionId: string | null, packetId: string | null) {
  return (await getGrfRegistrar()).registerPacketGrfAssets(packet, sessionId, packetId);
}
export async function registerMockupGrfsDev(packetId: string, lifestyleUrl: string | null, placements: Record<string, string> | null) {
  return (await getGrfRegistrar()).registerMockupGrfAssets(packetId, lifestyleUrl, placements);
}
export async function writeBldDev({ working, packetId }: { working: Record<string, any>; packetId?: string }) {
  const { FieldValue } = await import('./firebase-admin');
  return resolveBuilderBld(await getDb(), () => FieldValue.serverTimestamp(), working, packetId);
}
export async function writeAssemblyDev(opts: AutoAssemblyOptions) {
  const { FieldValue } = await import('./firebase-admin');
  return createAutoAssembly(await getDb(), () => FieldValue.serverTimestamp(), opts);
}
