import { adminFetch } from '@/lib/adminFetch';
import { GRF_PACKET_SLOTS, GRF_IMAGE_MAX_BYTES, mimeToGrfFormat, normalizeMimeType } from '@shared/GRF_engine';

const FRONT_PLACEMENTS = ['front', 'front-center', 'chest', 'front_center'];

/** Only saved display fields change. Print files, QR content and the Assembly stay intact. */
export function leadPhotoPatch(packet: Record<string, any>, publicUrl: string, grfId: string) {
  const snapshot = packet.builderSnapshot;
  const placement = snapshot?.layoutConfig?.selectedPlacements?.find((key: string) => FRONT_PLACEMENTS.includes(key));
  const color = snapshot?.qrConfig?.selectedColor?.name;
  const size = snapshot?.layoutConfig?.placementSizes?.[placement];
  if (!placement || !color || !size) throw new Error('The saved build needs a front placement, color and print size.');
  const colors = packet.mockupsByColor || {};
  const colorKey = Object.keys(colors).find(key => key.toLowerCase() === color.toLowerCase()) || color;
  if ([colorKey, size].some(key => /[.\[\]*~/]/.test(key))) throw new Error('This saved color or size cannot be updated safely.');
  const sizes = colors[colorKey]?.[placement] || {};
  const patch: Record<string, string> = {
    priorityMockupUrl: publicUrl,
    storeFrontGrfId: grfId,
    [`placementMockupUrls.${placement}`]: publicUrl,
    [`mockupsByColor.${colorKey}.${placement}.${size}`]: publicUrl,
  };
  // The public gallery chooses the first stored front view. Keep all its size entries consistent.
  for (const [key, value] of Object.entries(sizes)) {
    if (key === 'lifestyle' || typeof value !== 'string' || !value.startsWith('https://')) continue;
    if (/[.\[\]*~/]/.test(key)) throw new Error('This saved mockup size cannot be updated safely.');
    patch[`mockupsByColor.${colorKey}.${placement}.${key}`] = publicUrl;
  }
  return { patch, placement, color };
}

export async function replaceLeadPhoto(packetId: string, instanceId: string, file: File) {
  const mimeType = normalizeMimeType(file.type);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) throw new Error('Choose a PNG, JPEG or WebP photo.');
  if (!file.size || file.size > GRF_IMAGE_MAX_BYTES) throw new Error('Choose a photo between 1 byte and 20 MB.');
  const linked = await adminFetch<{ instance: { id: string } }>(`/catalog-instances/by-packet/${packetId}`);
  if (linked.instance?.id !== instanceId) throw new Error('The saved product changed. Resume it again before replacing its photo.');
  const data = await adminFetch<{ packet: Record<string, any> }>(`/packets/${packetId}`);
  const packet = data.packet;
  if (!packet) throw new Error('The saved packet could not be read.');
  // Validate the destination before uploading an asset.
  leadPhotoPatch(packet, '', '');
  const imageUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this photo.'));
    reader.onerror = () => reject(new Error('Could not read this photo.'));
    reader.readAsDataURL(file);
  });
  const uploaded = await adminFetch<{ grfId: string; asset: { publicUrl: string } }>('/graphics/save-grf', {
    method: 'POST', json: { ...GRF_PACKET_SLOTS.storeFront, format: mimeToGrfFormat(mimeType),
      mimeType, imageUrl, name: file.name, packetId },
  });
  if (!uploaded.grfId || !uploaded.asset?.publicUrl) throw new Error('The photo upload returned no saved asset.');
  const url = uploaded.asset.publicUrl;
  const { patch, placement, color } = leadPhotoPatch(packet, url, uploaded.grfId);
  await adminFetch(`/packets/${packetId}`, { method: 'PATCH', json: patch });
  await adminFetch(`/catalog-instances/${instanceId}/rebuild-images`, { method: 'POST', json: {} });
  return { url, color, placementMockupUrls: { ...packet.placementMockupUrls, [placement]: url },
    lifestyleMockupUrl: packet.lifestyleMockupUrl || null };
}
