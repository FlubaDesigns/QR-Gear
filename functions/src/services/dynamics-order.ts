import { createHash, randomBytes } from 'crypto';
import { db, QR_GEAR_BRANDED_TAG_URL } from '../core';
import { renderUnitBrandLabel } from './brand-label-artwork';
import { QR_DYNAMICS_INSTANCES_COLLECTION } from '../constants';
import { allocateQrgInstance } from './qrg-instance-allocator';
import { registerGrfAsset, registerPacketGrfAssets } from './grf-registrar';
import { writeAutoAssembly } from './bld-builder';
import { validatePacketComposition } from './assembly-store';
import { personalizeQrArtwork } from './qr-artwork';
import { requireBuilderSnapshot } from '../../../shared/builderSnapshot';
import { GRF_PACKET_SLOTS } from '../../../shared/GRF_engine';
import { resolveRuntimeConfig } from '../runtime-config';
import { isComposeHostingCode } from '../../../shared/composeHosting';

/** Freeze references, never expose the admin's builder snapshot through a cart response. */
export function dynamicsPrintSource(packet: Record<string, any>) {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(canonical({ builderSnapshot: packet.builderSnapshot,
    qrContent: packet.qrContent, assemblyId: packet.assemblyId, bldId: packet.bldId,
    placementGraphicUrls: packet.placementGraphicUrls, placementGrfIds: packet.placementGrfIds }))).digest('hex');
}

/** Capture the checked production packet before payment; browsing destinations are not production identity. */
export function freezeProductionSource(packet: Record<string, any>, qrgBlankId: string) {
  if (!/^[0-9]{5}$/.test(qrgBlankId || '')) throw new Error('A verified QRG blank is required for the production snapshot.');
  const source = JSON.parse(JSON.stringify(packet));
  for (const key of ['selectedRole', 'selectedStore', 'selectedChannel', 'selectedCollection', 'selectedCatalogId']) delete source.builderSnapshot?.metadata?.[key];
  for (const key of ['storeId', 'storeName', 'channelId', 'channelName', 'collectionId', 'collectionName', 'updatedAt', 'createdAt']) delete source[key];
  const frozen = { version: 1, packet: source, qrgBlankId, sourceHash: dynamicsPrintSource(source) };
  if (Buffer.byteLength(JSON.stringify(frozen)) > 750000) throw new Error('Production snapshot exceeds the saved-order limit. Reduce embedded artwork before checkout.');
  return frozen;
}
export async function readOrderProductionSource(lineId: string, item: any) {
  if (item.qrExperience?.version === 2) {
    const frozen = (await db.collection('orderProductionSources').doc(lineId).get()).data();
    if (!frozen || frozen.version !== 1 || frozen.orderId !== item.orderId || frozen.sourceHash !== item.qrExperience.sourceHash ||
        dynamicsPrintSource(frozen.packet) !== frozen.sourceHash || !/^[0-9]{5}$/.test(frozen.qrgBlankId || '')) throw new Error('Frozen order production snapshot is missing or invalid.');
    return { source: frozen.packet, qrgBlankId: frozen.qrgBlankId };
  }
  // Never substitute edited live content for a historical order lacking a snapshot.
  const source = (await db.collection('productPackets').doc(item.packetId).get()).data();
  if (!source || !item.qrExperience || item.qrExperience.sourceHash !== dynamicsPrintSource(source)) throw new Error('This historical order needs its frozen QR production source reconciled before printing.');
  const composition = await validatePacketComposition(db, item.packetId, source);
  return { source, qrgBlankId: composition.assembly.qrgId };
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
    const { source, qrgBlankId } = await readOrderProductionSource(line.id, item);
    const snapshot = requireBuilderSnapshot(source.builderSnapshot);
    const hosted = ['qr_canvas', 'qr_play', 'qr_compose'].includes(snapshot.qrConfig.qrProductState);
    const compose = snapshot.qrConfig.qrProductState === 'qr_compose';
    const hostingTierCode = hosted ? (compose && snapshot.graphics.content.composeHostingTerm
      ? snapshot.graphics.content.composeHostingTerm.replace('-', '_') : snapshot.graphics.content.hostingTierCode) : null;
    if (hosted && !isComposeHostingCode(hostingTierCode || '')) throw new Error('The purchased hosting term is unavailable.');
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
        const claimCode = randomBytes(12).toString('hex').toUpperCase();
        instanceId = await db.runTransaction(async tx => {
          const current = (await tx.get(line.ref)).data()!;
          if (current.dynamicsInstanceIds?.[index]) return current.dynamicsInstanceIds[index];
          const ids = current.dynamicsInstanceIds || [];
          if (ids.length !== index) throw new Error('Purchased item sequence changed; retry the order.');
          tx.create(ref, { instanceId: ref.id, ...identity, ownerId: null, ownerType: 'owner', orderId, orderItemId: line.id,
            title: item.productTitle, claimCode, hostingTierCode, hostingExpiresAt: null, claimedAt: null,
            unitIndex: index, packetId: packetRef.id, sourcePacketId: item.packetId,
            sourcePacketIds: hosted ? (compose ? template.slots.map((s: any) => s.packetId) : [packetRef.id]) : [],
            status: 'preparing', mode: 'loop', composeMode: template.composeMode || 'auto-rotate',
            createdAt: epoch, startTimestamp: epoch,
            slots: hosted ? (compose ? template.slots : [{ packetId: packetRef.id, durationSeconds: 86400, order: 1 }]) : [],
            staticContent: hosted ? null : source.qrContent });
          tx.create(packetRef, { ...source, ...identity, ownerType: 'owner', ownerId: null,
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
      if (instance.orderId !== orderId || instance.orderItemId !== line.id) throw new Error('Purchased item ownership does not match the order.');
      const packetRef = db.collection('productPackets').doc(instance.packetId);
      let packet = (await packetRef.get()).data()!;
      if (instance.status === 'preparing') {
        const urls = { ...source.placementGraphicUrls };
        if (hosted) for (const placement of snapshot.layoutConfig.selectedPlacements) {
          if (['label_inside', 'label_outside'].includes(placement)) continue;
          const imageData = await renderUnitArtwork(source, placement, packet.qrContent);
          const grf = await registerGrfAsset({ ...GRF_PACKET_SLOTS.qrComposite, imageData, mimeType: 'image/png', packetId: packetRef.id, createdBy: ownerId || 'paid-order' });
          urls[placement] = grf.publicUrl;
        }
        for (const placement of snapshot.layoutConfig.selectedPlacements.filter((p: string) => ['label_inside', 'label_outside'].includes(p))) {
          const image = await renderUnitBrandLabel(QR_GEAR_BRANDED_TAG_URL, snapshot.layoutConfig.providerLayouts[placement]?.dimensions,
            `${resolveRuntimeConfig().origin}/api/qr/item/${instanceId}`, instance.qrgBaseCode);
          const grf = await registerGrfAsset({ ...GRF_PACKET_SLOTS.qrComposite, imageData: image.toString('base64'), mimeType: 'image/png',
            packetId: packetRef.id, createdBy: ownerId || 'paid-order', name: instance.qrgBaseCode });
          urls[placement] = grf.publicUrl;
        }
        const primary = snapshot.layoutConfig.selectedPlacements.find((p: string) => !['label_inside', 'label_outside'].includes(p));
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
