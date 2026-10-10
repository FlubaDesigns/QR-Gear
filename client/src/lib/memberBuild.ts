import { memberFetch } from './memberFetch';
import { productGraphicOptions } from '@shared/builderSnapshot';
import { renderProductGraphic, type RenderOptions } from '@/features/shared/graphics/productGraphicRenderer';

/** The member editor uses the same captured snapshot and renderer as admin. */
export async function publishMemberBuild(memberId: string, input: Record<string, any>) {
  const build = await memberFetch<any>(`/${memberId}/builds`, { method: 'POST', json: input });
  for (const placement of build.builderSnapshot.layoutConfig.selectedPlacements) {
    if (placement === 'label_inside') continue;
    const imageData = await renderProductGraphic(productGraphicOptions(build.builderSnapshot, build.qrContent, placement) as RenderOptions);
    await memberFetch(`/${memberId}/builds/${build.packetId}/artwork`, { method: 'POST', json: { placement, imageData } });
  }
  return memberFetch<any>(`/${memberId}/products`, { method: 'POST', json: { productionPacketId: build.packetId } });
}
