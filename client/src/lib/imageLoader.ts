import { auth } from "@/lib/firebase";
import { Nexus } from "@/lib/nexus";

export interface ImageAsset {
  imageUrl?: string | null;
  publicUrl?: string | null;
  storageUrl?: string | null;
  proxyUrl?: string | null;
  storagePath?: string | null;
  thumbnailUrl?: string | null;
  url?: string | null;

  backgroundImageUrl?: string | null;
  productImage?: string | null;
}

export type AssetType =
  | "raw"
  | "source"
  | "zip"
  | "cropped"
  | "template"
  | "design"
  | "background"
  | "video"
  | "unknown";

function isValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("/api/") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  );
}

function looksLikeStoragePath(url: string): boolean {
  if (!url) return false;
  if (isValidUrl(url)) return false;
  if (url.startsWith("gs://")) return true;
  return url.includes("/") && !url.startsWith("#");
}

export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (isValidUrl(url)) return url;

  if (looksLikeStoragePath(url)) {
    return `/api/background-files?path=${encodeURIComponent(url)}`;
  }

  return url;
}

export function getImageSrc(asset: ImageAsset | null | undefined): string {
  if (!asset) return "";

  if (isValidUrl(asset.proxyUrl)) return asset.proxyUrl!;

  if (isValidUrl(asset.imageUrl)) return asset.imageUrl!;
  if (isValidUrl(asset.thumbnailUrl)) return asset.thumbnailUrl!;

  const bg = asset.backgroundImageUrl ?? undefined;
  if (bg) {
    const normalized = normalizeImageUrl(bg);
    if (normalized) return normalized;
  }

  const prod = asset.productImage ?? undefined;
  if (prod) {
    const normalized = normalizeImageUrl(prod);
    if (normalized) return normalized;
  }

  if (asset.publicUrl?.startsWith("https://")) return asset.publicUrl!;

  if (asset.storageUrl) {
    const normalized = normalizeImageUrl(asset.storageUrl);
    if (normalized) return normalized;
  }
  if (asset.storagePath) {
    const normalized = normalizeImageUrl(asset.storagePath);
    if (normalized) return normalized;
  }
  if (asset.url) {
    const normalized = normalizeImageUrl(asset.url);
    if (normalized) return normalized;
  }

  return "";
}

export function getThumbnailSrc(asset: ImageAsset | null | undefined): string {
  if (!asset) return "";

  if (isValidUrl(asset.thumbnailUrl)) return asset.thumbnailUrl!;
  if (isValidUrl(asset.proxyUrl)) return asset.proxyUrl!;
  if (isValidUrl(asset.imageUrl)) return asset.imageUrl!;

  const bg = asset.backgroundImageUrl ?? undefined;
  if (bg) {
    const normalized = normalizeImageUrl(bg);
    if (normalized) return normalized;
  }

  if (asset.publicUrl?.startsWith("https://")) return asset.publicUrl!;

  if (asset.storageUrl) {
    const normalized = normalizeImageUrl(asset.storageUrl);
    if (normalized) return normalized;
  }
  if (asset.storagePath) {
    const normalized = normalizeImageUrl(asset.storagePath);
    if (normalized) return normalized;
  }
  if (asset.url) {
    const normalized = normalizeImageUrl(asset.url);
    if (normalized) return normalized;
  }

  return "";
}

export function isPublicUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith("https://firebasestorage.googleapis.com") ||
    url.startsWith("https://storage.googleapis.com") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  );
}

export function isProxyUrl(url: string): boolean {
  if (!url) return false;
  return url.includes("/api/background-files") || url.includes("/api/files") || url.includes("/api/admin/");
}

export function needsAuthentication(url: string): boolean {
  return isProxyUrl(url) && !isPublicUrl(url);
}

async function waitForAuth(timeoutMs: number = 5000): Promise<string | null> {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      clearTimeout(timeout);
      unsubscribe();
      if (user) {
        const token = await user.getIdToken();
        resolve(token);
      } else {
        resolve(null);
      }
    });
  });
}

export async function fetchWithAuth(url: string): Promise<Response> {
  const headers: HeadersInit = {};

  if (needsAuthentication(url)) {
    const token = await waitForAuth();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, { headers });

  if (Nexus.detectHtmlResponse(response, url)) {
    throw new Error("Firebase routing error - received HTML instead of expected data");
  }

  return response;
}

export async function fetchImageAsBlob(url: string): Promise<string> {
  if (!url) throw new Error("No URL provided");

  const normalized = normalizeImageUrl(url);

  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return normalized;
  }

  const response = await fetchWithAuth(normalized);

  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function loadImageForAsset(asset: ImageAsset | null | undefined): Promise<string> {
  const src = getImageSrc(asset);
  if (!src) throw new Error("No image URL available in asset");
  return fetchImageAsBlob(src);
}

export async function loadThumbnailForAsset(asset: ImageAsset | null | undefined): Promise<string> {
  const src = getThumbnailSrc(asset);
  if (!src) throw new Error("No thumbnail URL available in asset");
  return fetchImageAsBlob(src);
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
