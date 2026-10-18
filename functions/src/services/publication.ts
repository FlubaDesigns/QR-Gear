import { db } from '../core';

/** Shared publication policy for public aliases; drafts require owner/admin previews. */
export function isPublicCatalogRecord(value: any): boolean {
  return !!value && value.isVisible !== false && value.isActive !== false && value.status === 'active';
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
    const member = packet.memberPacketId ? (await db.collection('member_packets').doc(packet.memberPacketId).get()).data() : null;
    return !!member && member.status === 'published' && member.isActive !== false && member.isVisible !== false && member.productionPacketId === id && member.memberId === packet.memberId;
  }
  return true;
}
export function publicPlayPacket(id: string, packet: any) {
  return { id, productName: packet.productName || packet.title || null,
    playMediaUrl: packet.playMediaUrl || packet.videoUrl || null,
    playMediaType: packet.playMediaType || packet.mediaType || null };
}
