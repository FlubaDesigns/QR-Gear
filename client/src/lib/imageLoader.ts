import { auth } from "@/lib/firebase";
import { Nexus } from "@/lib/nexus";

export interface ImageAsset {
  imageUrl?: string | null;
  publicUrl?: string | null;
  proxyUrl?: string | null;
  storagePath?: string | null;
}

export function getImageSrc(asset: ImageAsset): string {
  return asset.imageUrl || asset.publicUrl || asset.proxyUrl || '';
}

export function isPublicUrl(url: string): boolean {
  return url.startsWith('https://firebasestorage.googleapis.com') ||
         url.startsWith('https://storage.googleapis.com') ||
         url.startsWith('data:');
}

export function isProxyUrl(url: string): boolean {
  return url.includes('/api/background-files') || 
         url.includes('/api/files');
}

export async function fetchImageAsBlob(url: string): Promise<string> {
  const needsAuth = isProxyUrl(url);
  
  const headers: HeadersInit = {};
  if (needsAuth) {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(url, { headers });
  
  if (Nexus.detectHtmlResponse(response, url)) {
    throw new Error('Firebase routing error - received HTML instead of image');
  }
  
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status}`);
  }
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function loadImageForAsset(asset: ImageAsset): Promise<string> {
  const src = getImageSrc(asset);
  if (!src) throw new Error('No image URL available');
  
  if (isPublicUrl(src)) {
    return src;
  }
  
  return fetchImageAsBlob(src);
}
