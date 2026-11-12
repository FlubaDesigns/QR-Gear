import { createHash } from 'crypto';
import { db } from '../core';
import { snapshotPrintTextWarnings } from '../../../shared/printTextColor';
import { buildPacketMockupRequest, requireBuilderSnapshot } from '../../../shared/builderSnapshot';
import { generateMockupFromPrintful } from './mockup-generator';

type ProofActor = { id: string; type: 'member' | 'owner' | 'customer' | 'guest' };

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
/** Permanent print URLs identify immutable GRF bytes. Layout/QR/color/size changes invalidate consent. */
export function productProof(packet: any) {
  const selection = { selectedColor: packet.selectedColor || packet.builderSnapshot?.qrConfig?.selectedColor?.name,
    selectedSize: packet.selectedShirtSize, qrContent: packet.qrContent, placementGraphicUrls: packet.placementGraphicUrls };
  if (!selection.selectedColor || !selection.selectedSize || !selection.qrContent || !Object.keys(selection.placementGraphicUrls || {}).length) throw new Error('Generate the complete product proof before approving it.');
  const proofId = createHash('sha256').update(JSON.stringify(stable(selection))).digest('hex');
  return { proofId, ...selection, warnings: snapshotPrintTextWarnings(packet.builderSnapshot) };
}

/** One renderer and one fingerprint for builder, partner and purchaser review. */
export async function renderProductProof(packet: any, master: any, variantId: number) {
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  const mockupUrls: Record<string, string> = {};
  let lifestyleMockupUrl: string | null = null;
  for (const placement of snapshot.layoutConfig.selectedPlacements.filter((p: string) => !p.startsWith('label_'))) {
    const result = await generateMockupFromPrintful({ ...buildPacketMockupRequest(packet, master, placement, packet.selectedColor), printfulVariantId: variantId });
    if (!result.mockupUrl) throw new Error('A product preview is required before proof approval.');
    mockupUrls[placement] = result.mockupUrl;
    lifestyleMockupUrl ||= result.lifestyleMockupUrl || null;
  }
  if (!Object.keys(mockupUrls).length) throw new Error('The product has no printable proof.');
  return { ...productProof(packet), mockupUrl: Object.values(mockupUrls)[0], mockupUrls, lifestyleMockupUrl };
}

export async function saleItemProof(item: any) {
  const master = (await db.collection('master_catalog').doc(item.masterId).get()).data();
  if (!master) throw new Error('The product blank is unavailable.');
  return renderProductProof(item.frozenProduction.packet, master, item.fulfillment.variantId);
}

/** Called only with a proof recomputed from server-resolved immutable print files. */
export function recordProofApproval(packetId: string, proof: any, actor: ProofActor, input: any) {
  if (!actor.id || input?.approved !== true || input.proofId !== proof.proofId || !proof.mockupUrl) throw new Error('Check “I approve this proof” for the current design, color and size before continuing.');
  return { approved: true, proofId: proof.proofId, approvedAt: new Date().toISOString(),
    approvedBy: actor.id, actorType: actor.type, method: 'proof_checkbox', packetId,
    selectedColor: proof.selectedColor, selectedSize: proof.selectedSize,
    mockupUrl: proof.mockupUrl, mockupUrls: proof.mockupUrls || {}, warnings: proof.warnings };
}

export async function saveProductProof(packetId: string, packet: any, mockup: any) {
  if (!mockup.mockupUrl) throw new Error('A product preview is required before proof approval.');
  const proof = { ...productProof(packet), mockupUrl: mockup.mockupUrl, mockupUrls: mockup.mockupUrls || {}, lifestyleMockupUrl: mockup.lifestyleMockupUrl || null };
  const ref = db.collection('productPackets').doc(packetId);
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (!current || productProof(current).proofId !== proof.proofId) throw new Error('The design changed while its proof was being generated. Preview it again.');
    tx.update(ref, { reviewProof: proof });
  });
  return proof;
}

export async function approveProductProof(packetId: string, actor: { id: string; type: 'member' | 'owner' }, input: any) {
  const ref = db.collection('productPackets').doc(packetId);
  return db.runTransaction(async tx => {
    const packet = (await tx.get(ref)).data();
    if (!packet || packet.ownerType !== actor.type || (actor.type === 'member' ? packet.memberId : packet.ownerId) !== actor.id) throw Object.assign(new Error('This proof belongs to another account.'), { status: 403 });
    const proof = productProof(packet);
    if (input?.approved !== true || input.proofId !== proof.proofId || packet.reviewProof?.proofId !== proof.proofId) throw new Error('Check “I approve this proof” for the current design, color and size before continuing.');
    const previous = packet.proofApproval;
    if (previous?.approved === true && previous.proofId === proof.proofId && previous.approvedBy === actor.id) return previous;
    const approval = recordProofApproval(packetId, packet.reviewProof, actor, input);
    tx.update(ref, { proofApproval: approval });
    return approval;
  });
}

export function requireApprovedProductProof(packet: any) {
  if (packet.proofApproval?.approved !== true || packet.proofApproval.proofId !== productProof(packet).proofId) throw new Error('Approve the current product proof before continuing.');
  return packet.proofApproval;
}
