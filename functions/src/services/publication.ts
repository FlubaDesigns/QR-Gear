import { db } from '../core';
import { MEMBER_PACKETS_COLLECTION } from '../constants';

/** Shared publication policy for public aliases; drafts require owner/admin previews. */
export function isPublicCatalogRecord(value: any): boolean {
  return !!value && value.isVisible !== false && value.isActive !== false && value.status === 'active';
}
/** Product visibility and new purchases share the same parent authority. */
export async function isPublicCatalogInstance(value: any, parents = new Map<string, Promise<any>>(), source = db): Promise<boolean> {
  if (!isPublicCatalogRecord(value)) return false;
  if (value.channelId && !value.storeId) return false;
  const read = (collection: string, id: string) => {
    const key = `${collection}/${id}`;
    if (!parents.has(key)) parents.set(key, source.collection(collection).doc(id).get().then(doc => doc.data()));
    return parents.get(key)!;
  };
  if (value.storeId) {
    let store = await read('stores', value.storeId);
    if (!store) store = await read('partnerStores', value.storeId);
    if (!isVisibleLegacyLink(store)) return false;
    if (value.channelId) {
      const channel = await read('storeChannels', value.channelId);
      if (!isVisibleLegacyLink(channel) || channel.storeId !== value.storeId) return false;
    }
  }
  return true;
}
export async function publicCatalogDocuments(docs: any[]): Promise<any[]> {
  const parents = new Map<string, Promise<any>>();
  const eligible = await Promise.all(docs.map(doc => isPublicCatalogInstance(doc.data(), parents)));
  return docs.filter((_, index) => eligible[index]);
}
export function isVisibleLegacyLink(value: any): boolean {
  return !!value && value.isVisible !== false && value.isActive !== false &&
    (value.status == null || ['active', 'published'].includes(value.status));
}
export async function isPublicPacket(id: string, packet: any): Promise<boolean> {
  if (!packet || packet.isActive === false || packet.isVisible === false || ['building', 'draft', 'archived', 'deleted'].includes(packet.status)) return false;
  if (packet.ownerType === 'admin') {
    const owner = packet.ownerInstanceId ? (await db.collection('admin_catalog_instances').doc(packet.ownerInstanceId).get()).data() : null;
    return !!owner && isPublicCatalogRecord(owner) && owner.currentPacketId === id && !!packet.qrgBaseCode && owner.qrgBaseCode === packet.qrgBaseCode;
  }
  if (packet.status !== 'published') return false;
  if (packet.memberId || packet.memberPacketId) {
    const member = packet.memberPacketId ? (await db.collection(MEMBER_PACKETS_COLLECTION).doc(packet.memberPacketId).get()).data() : null;
    return !!member && member.status === 'published' && member.isActive !== false && member.isVisible !== false && member.productionPacketId === id && member.memberId === packet.memberId;
  }
  return true;
}
export function publicPlayPacket(id: string, packet: any) {
  return { id, productName: packet.productName || packet.title || null,
    playMediaUrl: packet.playMediaUrl || packet.videoUrl || null,
    playMediaType: packet.playMediaType || packet.mediaType || null };
}

/** Legacy member records may predate production packets; linked builds must pass both policies. */
export async function isPublicMemberPacket(id: string, member: any): Promise<boolean> {
  if (!member || member.status !== 'published' || member.isActive === false || member.isVisible === false) return false;
  if (!member.productionPacketId) return true;
  const packet = (await db.collection('productPackets').doc(member.productionPacketId).get()).data();
  return !!packet && packet.memberPacketId === id && packet.memberId === member.memberId && await isPublicPacket(member.productionPacketId, packet);
}
export function isPublicLegacyProduct(product: any): boolean {
  return product?.isEnabled === true && isVisibleLegacyLink(product);
}
