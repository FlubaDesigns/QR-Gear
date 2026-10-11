import { memberFetch } from './memberFetch';
import { productGraphicOptions } from '@shared/builderSnapshot';
import { renderProductGraphic, type RenderOptions } from '@/features/shared/graphics/productGraphicRenderer';

// Keep only the current prepared build for each signed-in member. Its fingerprint
// excludes preview outputs: those are derived from the saved artwork, not inputs.
const prepared = new Map<string, { key: string; build: any; preview?: any }>();
function buildKey(input: Record<string, any>) {
  return JSON.stringify(input, (key, value) => /Mockup$/.test(key) || ['itemImage', 'qrGraphic', 'productGraphic', 'qrBasicSaveChoice', 'qrPlusSaveChoice'].includes(key) ? undefined : value);
}
async function prepareArtwork(memberId: string, input: Record<string, any>) {
  const key = buildKey(input);
  const cached = prepared.get(memberId);
  if (cached?.key === key) return cached;
  const entry = { key, build: await renderMemberBuild(memberId, input), preview: undefined as any };
  prepared.set(memberId, entry);
  return entry;
}
export async function previewMemberBuild(memberId: string, input: Record<string, any>) {
  const entry = await prepareArtwork(memberId, input);
  const changed = !entry.preview;
  if (!entry.preview) entry.preview = await memberFetch<any>(`/${memberId}/builds/${entry.build.packetId}/preview`, { method: 'POST' });
  return { ...entry.preview, changed };
}

/** The member editor uses the same captured snapshot and renderer as admin. */
async function renderMemberBuild(memberId: string, input: Record<string, any>) {
  const build = await memberFetch<any>(`/${memberId}/builds`, { method: 'POST', json: input });
  for (const placement of build.builderSnapshot.layoutConfig.selectedPlacements) {
    if (['label_inside', 'label_outside'].includes(placement)) continue;
    const imageData = await renderProductGraphic(productGraphicOptions(build.builderSnapshot, build.qrContent, placement) as RenderOptions);
    await memberFetch(`/${memberId}/builds/${build.packetId}/artwork`, { method: 'POST', json: { placement, imageData } });
  }
  return build;
}
export async function publishMemberBuild(memberId: string, input: Record<string, any>) {
  const entry = await prepareArtwork(memberId, input);
  const result = await memberFetch<any>(`/${memberId}/products`, { method: 'POST', json: { productionPacketId: entry.build.packetId } });
  prepared.delete(memberId);
  return result;
}
