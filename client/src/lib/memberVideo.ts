import { memberFetch } from './memberFetch';

export async function saveMemberVideo(memberId: string, url: string, name: string, _storagePath?: string) {
  if (!url || url.startsWith('blob:')) throw new Error('Upload the video before saving it.');
  const result = await memberFetch<{ asset: { id: string } }>(`/${memberId}/library/video-reference`, { method: 'POST', json: { url, name } });
  if (!result?.asset?.id) throw new Error('The video library did not confirm the save. Please retry.');
}

/** The multipart endpoint atomically acknowledges a real, reusable owned library record. */
export async function uploadMemberVideo(memberId: string, file: File, _name: string) {
  const body = new FormData();
  body.append('file', file);
  body.append('storeType', 'member');
  const result = await memberFetch<{ url: string; assetId: string }>(`/${memberId}/media`, { method: 'POST', body });
  if (!result?.assetId || !result?.url?.startsWith(`/api/library-files/member/${memberId}/video/`)) {
    throw new Error('The upload did not return your saved video. Please retry.');
  }
  return result.url;
}
