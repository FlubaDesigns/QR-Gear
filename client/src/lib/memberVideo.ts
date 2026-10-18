import { memberFetch } from './memberFetch';

const saved = new Set<string>();
export async function saveMemberVideo(memberId: string, url: string, name: string, storagePath?: string) {
  if (!url || url.startsWith('blob:')) throw new Error('Upload the video before saving it.');
  const key = `${memberId}:${url}`;
  if (saved.has(key)) return;
  const result = await memberFetch<{ id: string }>(`/${memberId}/library`, { method: 'POST', json: {
    publicUrl: url, storageUrl: storagePath || url, assetType: 'video', mediaType: 'video', name,
    fileName: decodeURIComponent(url.split('/').pop()!.split('?')[0]),
  } });
  if (!result?.id) throw new Error('The video library did not confirm the save. Please retry.');
  saved.add(key);
}

/** Both signed-in and deferred guest uploads use the multipart media contract. */
export async function uploadMemberVideo(memberId: string, file: File, name: string) {
  const body = new FormData();
  body.append('file', file);
  body.append('storeType', 'member');
  const result = await memberFetch<{ url: string; storagePath?: string }>(`/${memberId}/media`, { method: 'POST', body });
  if (!result?.url || !result.url.startsWith(`/api/library-files/member/${memberId}/video/`)) {
    throw new Error('The upload did not return your saved video. Please retry.');
  }
  await saveMemberVideo(memberId, result.url, name, result.storagePath);
  return result.url;
}
