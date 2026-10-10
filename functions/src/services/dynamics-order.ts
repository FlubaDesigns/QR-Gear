import { createHash, randomBytes } from 'crypto';
import { db } from '../core';
import { QR_DYNAMICS_INSTANCES_COLLECTION } from '../constants';
import { allocateQrgInstance } from './qrg-instance-allocator';
import { registerGrfAsset, registerPacketGrfAssets } from './grf-registrar';
import { writeAutoAssembly } from './bld-builder';
import { validatePacketComposition } from './assembly-store';
import { personalizeQrArtwork } from './qr-artwork';
import { requireBuilderSnapshot } from '../../../shared/builderSnapshot';
import { GRF_PACKET_SLOTS } from '../../../shared/GRF_engine';
import { resolveRuntimeConfig } from '../runtime-config';
import { dynamicsHostingExpiry } from './qr-dynamics';

/** Freeze references, never expose the admin's builder snapshot through a cart response. */
export function dynamicsPrintSource(packet: Record<string, any>) {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(canonical({ builderSnapshot: packet.builderSnapshot,
    qrContent: packet.qrContent, assemblyId: packet.assemblyId, bldId: packet.bldId,
    placementGraphicUrls: packet.placementGraphicUrls, placementGrfIds: packet.placementGrfIds }))).digest('hex');
}

/** Retain approved artwork and replace only its verified QR region. */
export async function renderUnitArtwork(packet: Record<string, any>, placement: string, qrContent: string): Promise<string> {
  const output = await personalizeQrArtwork(packet.placementGraphicUrls[placement], packet.qrContent, qrContent);
  return output.toString('base64');
}

/** A line with quantity N produces N permanent identities and N individual print files. */
export async function prepareDynamicsOrderItems(orderId: string, ownerId: string | null, renewLease: () => Promise<void>) {
  ownerId = ownerId || null;
  const order = (await db.collection('orders').doc(orderId).get()).data();
  if (order?.paymentStatus !== 'paid' || !order.paymentVerifiedAt) throw new Error('A verified paid order is required.');
  const paidAt = new Date(order.paymentVerifiedAt);
  const lines = await db.collection('orderItems').where('orderId', '==', orderId).get();
  const output: Array<{ variant_id: number; quantity: number; files: any[] }> = [];
  for (const line of lines.docs) {
    const item = line.data();
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Invalid purchased quantity.');
    const sourceRef = db.collection('productPackets').doc(item.packetId);
    const source = (await sourceRef.get()).data();
    if (!source || !item.qrExperience || item.qrExperience.sourceHash !== dynamicsPrintSource(source)) throw new Error('This order needs its frozen QR production source reconciled before printing.');
    const composition = await validatePacketComposition(db, item.packetId, source);
    const qrgBlankId = composition.assembly.qrgId;
    const snapshot = requireBuilderSnapshot(source.builderSnapshot);
    const hosted = ['qr_canvas', 'qr_play', 'qr_compose'].includes(snapshot.qrConfig.qrProductState);
    const compose = snapshot.qrConfig.qrProductState === 'qr_compose';
    const template = item.qrExperience;
    if (compose && !template.slots?.length) throw new Error('The purchased Compose sequence is unavailable.');
    for (let index = 0; index < item.quantity; index++) {
      await renewLease();
      let instanceId = (await line.ref.get()).data()?.dynamicsInstanceIds?.[index];
      if (!instanceId) {
        const identity = await allocateQrgInstance({ qrgBlankId, context: 'O' });
        const ref = db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc();
        const packetRef = db.collection('productPackets').doc();
        const epoch = Math.floor(paidAt.getTime() / 1000);
        const claimCode = ownerId ? null : randomBytes(12).toString('hex').toUpperCase();
        instanceId = await db.runTransaction(async tx => {
          const current = (await tx.get(line.ref)).data()!;
          if (current.dynamicsInstanceIds?.[index]) return current.dynamicsInstanceIds[index];
          const ids = current.dynamicsInstanceIds || [];
          if (ids.length !== index) throw new Error('Purchased item sequence changed; retry the order.');
          tx.create(ref, { instanceId: ref.id, ...identity, ownerId, ownerType: 'owner', orderId, orderItemId: line.id,
            title: item.productTitle, claimCode, hostingExpiresAt: hosted ? dynamicsHostingExpiry(snapshot.graphics.content.hostingTierCode, paidAt) : null,
            unitIndex: index, packetId: packetRef.id, sourcePacketId: item.packetId,
            sourcePacketIds: hosted ? (compose ? template.slots.map((s: any) => s.packetId) : [packetRef.id]) : [],
            status: 'preparing', mode: 'loop', composeMode: template.composeMode || 'auto-rotate',
            createdAt: epoch, startTimestamp: epoch,
            slots: hosted ? (compose ? template.slots : [{ packetId: packetRef.id, durationSeconds: 86400, order: 1 }]) : [],
            staticContent: hosted ? null : source.qrContent });
          tx.create(packetRef, { ...source, ...identity, ownerType: 'owner', ownerId,
            ownerInstanceId: null, sourcePacketId: item.packetId, orderId, orderItemId: line.id,
            storeId: null, channelId: null, collectionId: null, collectionName: null,
            assemblyId: null, status: 'building', composeInstanceId: ref.id,
            landingPageSlug: `item-${packetRef.id}`,
            qrContent: hosted ? `${resolveRuntimeConfig().origin}/qr/d/${ref.id}` : source.qrContent,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          if (claimCode) tx.create(db.collection('claimCodes').doc(claimCode), { claimCode, instanceId: ref.id, packetId: packetRef.id, orderId,
            productName: item.productTitle, packetType: snapshot.qrConfig.qrProductState, status: 'unclaimed', createdAt: paidAt.toISOString() });
          tx.update(line.ref, { dynamicsInstanceIds: [...ids, ref.id] });
          return ref.id;
        });
      }
      const dynamicsRef = db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc(instanceId);
      const instance = (await dynamicsRef.get()).data()!;
      if ((ownerId && instance.ownerId !== ownerId) || instance.orderId !== orderId || instance.orderItemId !== line.id) throw new Error('Purchased item ownership does not match the order.');
      const packetRef = db.collection('productPackets').doc(instance.packetId);
      let packet = (await packetRef.get()).data()!;
      if (instance.status === 'preparing') {
        const urls = { ...source.placementGraphicUrls };
        if (hosted) for (const placement of snapshot.layoutConfig.selectedPlacements) {
          if (placement === 'label_inside') continue;
          const imageData = await renderUnitArtwork(source, placement, packet.qrContent);
          const grf = await registerGrfAsset({ ...GRF_PACKET_SLOTS.qrComposite, imageData, mimeType: 'image/png', packetId: packetRef.id, createdBy: ownerId || 'paid-order' });
          urls[placement] = grf.publicUrl;
        }
        const primary = snapshot.layoutConfig.selectedPlacements.find((p: string) => p !== 'label_inside');
        await packetRef.update({ placementGraphicUrls: urls, compositeUrl: urls[primary], productGraphicUrl: urls[primary] });
        packet = (await packetRef.get()).data()!;
        const grfs = await registerPacketGrfAssets(packet, null, packetRef.id);
        await writeAutoAssembly({ working: snapshot, qrgId: packet.qrgBlankId, bldId: packet.bldId,
          sourceSessionId: null, packetId: packetRef.id, grfIds: { ...packet, ...grfs } });
        packet = (await packetRef.get()).data()!;
        await validatePacketComposition(db, packetRef.id, packet);
        const batch = db.batch();
        batch.update(packetRef, { status: 'published' });
        batch.update(dynamicsRef, { status: hosted ? 'active' : 'static', updatedAt: new Date().toISOString() });
        await batch.commit();
      }
      if (!['active', 'static', 'preparing'].includes(instance.status)) throw new Error('Purchased QR item is unavailable.');
      await validatePacketComposition(db, packetRef.id, packet);
      const files = item.fulfillment.files.map((file: any) => {
        const placement = snapshot.layoutConfig.selectedPlacements.find((p: string) => snapshot.layoutConfig.providerLayouts[p]?.providerPlacementId === file.type);
        if (!placement || !packet.placementGraphicUrls?.[placement]) throw new Error('Purchased print placement is missing.');
        return { ...file, url: packet.placementGraphicUrls[placement] };
      });
      output.push({ variant_id: item.fulfillment.variantId, quantity: 1, files });
    }
  }
  if (!output.length) throw new Error('Order has no individual items to print.');
  return output;
}
