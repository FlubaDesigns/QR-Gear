export interface MemberMediaUpload { url: string; assetId: string; mimeType: string; fileName: string; size: number; }
export function requireMemberMediaUpload(value: any): MemberMediaUpload {
  if (!value || typeof value.url !== 'string' || !value.url.startsWith('/api/library-files/member/') || typeof value.assetId !== 'string' || !value.assetId) throw new Error('The uploaded media was not saved to your library. Retry the upload.');
  return value;
}
