/**
 * server/lib/schema-commit.ts
 *
 * Development adapters for the schema-write services in functions/src/services/.
 * Uses the dev server's dynamic Firebase Admin import pattern.
 *
 * These run only during local development — production uses functions/src/services/.
 *
 * Functions exported:
 *   writeBldDev        — calls functions/src/services/bld-builder writeBldDefinition
 *   writeAssemblyDev   — calls functions/src/services/bld-builder writeAutoAssembly
 *   registerGrfDev     — calls functions/src/services/grf-registrar registerGrfAsset
 *   registerPacketGrfsDev — registers all packet GRF assets
 */


// ─────────────────────────────────────────────────────────────────────────────
// QRG instance allocation
// ─────────────────────────────────────────────────────────────────────────────

import { allocateQrgInstanceRecord, type QrgInstanceIdentity } from '../../functions/src/services/qrg-instance-store';
export type DevQrgIdentity = QrgInstanceIdentity;
export async function allocateQrgInstanceDev(qrgBlankId: string, context: 'I' | 'M' | 'E' | 'O'): Promise<DevQrgIdentity> {
  const { FieldValue } = await import('firebase-admin/firestore');
  return allocateQrgInstanceRecord(await getDb(), () => FieldValue.serverTimestamp(), { qrgBlankId, context });
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
