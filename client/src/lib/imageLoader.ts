import { auth } from "@/lib/firebase";
import { Nexus } from "@/lib/nexus";

export interface ImageAsset {
  imageUrl?: string | null;
  publicUrl?: string | null;
  proxyUrl?: string | null;
  storagePath?: string | null;
  thumbnailUrl?: string | null;
  url?: string | null;
}

export type AssetType = 'raw' | 'source' | 'zip' | 'cropped' | 'template' | 'design' | 'background' | 'video' | 'unknown';

export function getImageSrc(asset: ImageAsset | null | undefined): string {
  if (!asset) return '';
  return asset.imageUrl || asset.publicUrl || asset.thumbnailUrl || asset.url || asset.proxyUrl || '';
}

export function getThumbnailSrc(asset: ImageAsset | null | undefined): string {
  if (!asset) return '';
  return asset.thumbnailUrl || asset.imageUrl || asset.publicUrl || asset.url || asset.proxyUrl || '';
}

export function isPublicUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('https://firebasestorage.googleapis.com') ||
         url.startsWith('https://storage.googleapis.com') ||
         url.startsWith('data:') ||
         url.startsWith('blob:');
}

export function isProxyUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('/api/background-files') || 
         url.includes('/api/files') ||
         url.includes('/api/admin/');
}

export function needsAuthentication(url: string): boolean {
  return isProxyUrl(url) && !isPublicUrl(url);
}

export async function fetchWithAuth(url: string): Promise<Response> {
  const headers: HeadersInit = {};
  
  if (needsAuthentication(url)) {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(url, { headers });
  
  if (Nexus.detectHtmlResponse(response, url)) {
    throw new Error('Firebase routing error - received HTML instead of expected data');
  }
  
  return response;
}

export async function fetchImageAsBlob(url: string): Promise<string> {
  if (!url) throw new Error('No URL provided');
  
  if (isPublicUrl(url)) {
    return url;
  }
  
  const response = await fetchWithAuth(url);
  
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
  }
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function loadImageForAsset(asset: ImageAsset | null | undefined): Promise<string> {
  const src = getImageSrc(asset);
  if (!src) throw new Error('No image URL available in asset');
  
  if (isPublicUrl(src)) {
    return src;
  }
  
  return fetchImageAsBlob(src);
}

export async function loadThumbnailForAsset(asset: ImageAsset | null | undefined): Promise<string> {
  const src = getThumbnailSrc(asset);
  if (!src) throw new Error('No thumbnail URL available in asset');
  
  if (isPublicUrl(src)) {
    return src;
  }
  
  return fetchImageAsBlob(src);
}

export function detectAssetType(asset: ImageAsset & { assetType?: string; mediaType?: string }): AssetType {
  if (asset.assetType) {
    const type = asset.assetType.toLowerCase();
    if (type === 'source' || type === 'raw') return 'source';
    if (type === 'cropped') return 'cropped';
    if (type === 'zip') return 'zip';
    if (type === 'template') return 'template';
    if (type === 'design') return 'design';
    if (type === 'background') return 'background';
  }
  
  if (asset.mediaType === 'video') return 'video';
  
  const storagePath = asset.storagePath || '';
  if (storagePath.includes('/raw/')) return 'raw';
  if (storagePath.includes('/zip/')) return 'zip';
  if (storagePath.includes('/cropped/')) return 'cropped';
  if (storagePath.includes('/template')) return 'template';
  
  return 'unknown';
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
