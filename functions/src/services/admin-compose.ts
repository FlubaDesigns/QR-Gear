import { db } from '../core';
import { isPublicPacket } from './publication';
import { dynamicsMode, dynamicsHostingExpiry } from './qr-dynamics';
import { QR_DYNAMICS_INSTANCES_COLLECTION } from '../constants';
function fail(message: string): never { throw Object.assign(new Error(message), { status: 400 }); }
export async function prepareAdminCompose(ownerId: string, packetId: string) {
  if (typeof packetId !== 'string' || !packetId || packetId.includes('/')) fail('Generate the physical packet before preparing Compose.');
  const ref = db.collection('productPackets').doc(packetId), packet = (await ref.get()).data();
  if (!packet || packet.ownerInstanceId || packet.status === 'published') fail('Use an unpublished generated packet.');
  const snapshot = packet.builderSnapshot, content = snapshot?.graphics?.content;
  if (snapshot?.qrConfig?.qrProductState !== 'qr_compose') fail('Choose QR Compose for this build.');
  const items = content.composeItems;
  if (!Array.isArray(items) || items.length < 2 || items.length > 100) fail('Choose 2 to 100 published Canvas or Play items.');
  const slots: Array<{ packetId: string; durationSeconds: number; order: number }> = [];
  for (const [index, item] of items.entries()) {
    if (typeof item.packetId !== 'string' || !item.packetId || item.packetId.includes('/')) fail('Invalid Compose content reference.');
    const target = (await db.collection('productPackets').doc(item.packetId).get()).data();
    const type = target?.qrProductState || target?.builderSnapshot?.qrConfig?.qrProductState || target?.packetType?.replace(/-/g, '_');
    if (!target || !['qr_canvas', 'qr_play'].includes(type) || !target.landingPageSlug || !await isPublicPacket(item.packetId, target)) fail('Choose published canonical Canvas or Play content.');
    if (!Number.isSafeInteger(item.durationSeconds) || item.durationSeconds < 1 || item.durationSeconds > 31536000 || slots.some(slot => slot.packetId === item.packetId)) fail('Use unique content with valid whole-second durations.');
    slots.push({ packetId: item.packetId, durationSeconds: item.durationSeconds, order: index + 1 });
  }
  const mode = dynamicsMode(content.composeMode), term = String(content.composeHostingTerm || '').replace('-', '_');
  dynamicsHostingExpiry(term);
  const dynamicRef = db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc(`admin-${packetId}`);
  await db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data(), existing = (await tx.get(dynamicRef)).data();
    if (!latest || latest.ownerInstanceId || latest.status === 'published' || JSON.stringify(latest.builderSnapshot) !== JSON.stringify(snapshot)) fail('Build changed. Generate it again.');
    if (existing && (existing.status !== 'draft' || existing.ownerId !== ownerId)) fail('Compose belongs to another build or is already active.');
    tx.set(dynamicRef, { instanceId: dynamicRef.id, ownerId, ownerType: 'admin', packetId, status: 'draft', slots, composeMode: mode, mode: 'loop', hostingTierCode: term, startTimestamp: Math.floor(Date.now() / 1000) });
    tx.update(ref, { composeInstanceId: dynamicRef.id });
  });
  return { success: true, status: 'draft', instanceId: dynamicRef.id };
}
