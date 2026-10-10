import { db } from '../core';
import { MEMBER_PACKETS_COLLECTION, PRODUCT_PACKETS_COLLECTION, QR_DYNAMICS_INSTANCES_COLLECTION } from '../constants';
import { resolveActiveSlot, type DynamicsSlot } from '../../../shared/qrDynamicsResolver';

function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }
function documentId(value: unknown): string {
  if (typeof value !== 'string' || !value || value.includes('/') || value.length > 200) fail('Invalid QR Dynamics reference.');
  return value;
}

/** Canonical content references are productPackets; member_packets only proves ownership. */
export async function memberDynamicsSlots(ownerId: string, input: any, minimum = 2, purchasedPacketIds: string[] = []): Promise<DynamicsSlot[]> {
  if (!Array.isArray(input) || input.length < minimum || input.length > 100) fail(`Choose ${minimum} to 100 published Canvas or Play items.`);
  const slots: DynamicsSlot[] = [];
  for (const [index, slot] of input.entries()) {
    const id = documentId(slot?.packetId);
    let packetId = id;
    const member = (await db.collection(MEMBER_PACKETS_COLLECTION).doc(id).get()).data();
    if (member) {
      if (member.memberId !== ownerId || member.status !== 'published') fail('Choose your own published content.', 403);
      packetId = documentId(member.productionPacketId);
    }
    const packet = (await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get()).data();
    if (!packet || (!(packet.ownerType === 'member' && packet.memberId === ownerId) && !purchasedPacketIds.includes(packetId))) fail('Choose your own published content.', 403);
    const type = packet.packetType || String(packet.builderSnapshot?.qrConfig?.qrProductState || '').replace(/_/g, '-');
    if (packet.status !== 'published' || !['qr-canvas', 'qr-play'].includes(type) || !packet.landingPageSlug) fail('QR Dynamics needs published Canvas or Play content.');
    if (!Number.isSafeInteger(slot.durationSeconds) || slot.durationSeconds < 1 || slot.durationSeconds > 31536000) fail('Each duration must be a whole number of seconds between 1 and 31536000.');
    if (slots.some(s => s.packetId === packetId)) fail('Choose each content item only once.');
    slots.push({ packetId, durationSeconds: slot.durationSeconds, order: index + 1 });
  }
  return slots;
}

export function dynamicsMode(value: unknown): 'auto-rotate' | 'scan-to-reveal' {
  if (value !== 'auto-rotate' && value !== 'scan-to-reveal') fail('Choose automatic rotation or scan to reveal.');
  return value;
}

export async function ownedDynamicsInstance(ownerId: string, id: string) {
  const ref = db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc(documentId(id));
  const instance = (await ref.get()).data();
  if (!instance) fail('QR Dynamics instance not found.', 404);
  if (instance.ownerId !== ownerId) fail('This QR experience belongs to another account.', 403);
  return { ref, instance };
}

export async function updateDynamicsSlots(ownerId: string, id: string, input: any, composeMode: unknown) {
  const { ref, instance } = await ownedDynamicsInstance(ownerId, id);
  const slots = await memberDynamicsSlots(ownerId, input, 1, instance.sourcePacketIds || []);
  const mode = dynamicsMode(composeMode ?? instance.composeMode);
  const startTimestamp = Math.floor(Date.now() / 1000);
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (!current || current.ownerId !== ownerId) fail('This QR experience belongs to another account.', 403);
    if (current.status !== 'active') fail('Publish this item before editing its QR experience.', 409);
    tx.update(ref, { slots, composeMode: mode, startTimestamp, updatedAt: new Date().toISOString() });
  });
  return { success: true, instanceId: id, newStartTimestamp: startTimestamp };
}

/** Public scans reveal only published landing pages, never the owner's record or uploads. */
export async function resolveDynamicsInstance(id: string) {
  const instance = (await db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc(documentId(id)).get()).data();
  if (!instance || instance.status !== 'active') fail('QR experience is not available.', 404);
  if (!/^QRG-[1-6][1-9]\d{3}-[IMEO]-\d{6}$/.test(instance.qrgBaseCode || '')) fail('QR item identity is not connected.', 409);
  const bound = (await db.collection(PRODUCT_PACKETS_COLLECTION).doc(documentId(instance.packetId)).get()).data();
  if (!bound || bound.status !== 'published' || bound.qrgBaseCode !== instance.qrgBaseCode || bound.composeInstanceId !== id) fail('QR experience and physical item are not connected.', 409);
  if (instance.hostingExpiresAt && new Date(instance.hostingExpiresAt).getTime() <= Date.now()) fail('QR hosting has expired.', 410);
  const result = resolveActiveSlot(instance.slots || [], instance.startTimestamp, Math.floor(Date.now() / 1000));
  if ('error' in result) fail(result.error, 409);
  const slots = [...instance.slots].sort((a, b) => a.order - b.order);
  const targets: string[] = [];
  for (const slot of slots) {
    const packet = (await db.collection(PRODUCT_PACKETS_COLLECTION).doc(documentId(slot.packetId)).get()).data();
    if (!packet || packet.status !== 'published' || !packet.landingPageSlug) fail('Published QR content is unavailable.', 404);
    // A sale may retain its purchased public content; edits still require the new owner's own content.
    if (packet.ownerType === 'member' && packet.memberId !== instance.ownerId && !(instance.sourcePacketIds || []).includes(slot.packetId)) fail('QR content belongs to another account.', 403);
    targets.push(`/m/${encodeURIComponent(packet.landingPageSlug)}`);
  }
  return { instance, result, targets };
}

export function dynamicsHostingExpiry(code: string, start = new Date()) {
  const years: Record<string, number> = { '1_year': 1, '3_year': 3, '5_year': 5 };
  if (!years[code]) fail('Select a supported hosting term before creating this QR experience.');
  const expiry = new Date(start);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + years[code]);
  return expiry.toISOString();
}
