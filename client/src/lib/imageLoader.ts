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
  signedUrl?: string | null;
  thumbnailSignedUrl?: string | null;

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
    // Normalize path: fix libraries/ → library/ mismatch
    let normalizedPath = url.trim().replace(/^\/+/, "");
    
    // Fix common path issues
    if (normalizedPath.startsWith("libraries/")) {
      normalizedPath = normalizedPath.replace(/^libraries\//, "library/");
    }
    if (normalizedPath.startsWith("library/library/")) {
      normalizedPath = normalizedPath.replace(/^library\/library\//, "library/");
    }
    
    return `/api/background-files?path=${encodeURIComponent(normalizedPath)}`;
  }

  return url;
}

export function getImageSrc(asset: ImageAsset | null | undefined): string {
  if (!asset) return "";

  // Best case: server already provides a proxyUrl
  if (typeof asset.proxyUrl === "string" && asset.proxyUrl.length > 0) {
    return asset.proxyUrl;
  }

  // Prefer signed URLs - they work without authentication
  if (isValidUrl(asset.signedUrl)) return asset.signedUrl!;

  // Hunt for common fields used across the system (in priority order)
  // Prefer full URLs (imageUrl, publicUrl) over partial paths (storagePath)
  const candidate =
    asset.imageUrl ||
    asset.publicUrl ||
    asset.backgroundImageUrl ||
    asset.thumbnailUrl ||
    asset.productImage ||
    asset.url ||
    asset.storagePath ||
    asset.storageUrl ||
    null;

  if (!candidate) return "";

  const p = String(candidate);

  // Already a usable URL? Return as-is
  if (
    p.startsWith("https://") ||
    p.startsWith("http://") ||
    p.startsWith("/api/") ||
    p.startsWith("data:") ||
    p.startsWith("blob:")
  ) {
    return p;
  }

  // Normalize path and force through proxy endpoint
  return normalizeImageUrl(p);
}

export function getThumbnailSrc(asset: ImageAsset | null | undefined): string {
  if (!asset) return "";

  // Best case: server already provides a proxyUrl
  if (typeof asset.proxyUrl === "string" && asset.proxyUrl.length > 0) {
    return asset.proxyUrl;
  }

  // Prefer signed URLs - they work without authentication
  if (isValidUrl(asset.thumbnailSignedUrl)) return asset.thumbnailSignedUrl!;
  if (isValidUrl(asset.signedUrl)) return asset.signedUrl!;

  // Hunt for common fields used across the system (in priority order)
  // Prefer full URLs over partial paths (storagePath)
  const candidate =
    asset.thumbnailUrl ||
    asset.imageUrl ||
    asset.publicUrl ||
    asset.backgroundImageUrl ||
    asset.productImage ||
    asset.url ||
    asset.storagePath ||
    asset.storageUrl ||
    null;

  if (!candidate) return "";

  const p = String(candidate);

  // Already a usable URL? Return as-is
  if (
    p.startsWith("https://") ||
    p.startsWith("http://") ||
    p.startsWith("/api/") ||
    p.startsWith("data:") ||
    p.startsWith("blob:")
  ) {
    return p;
  }

  // Normalize path and force through proxy endpoint
  return normalizeImageUrl(p);
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
  // Note: /api/background-files and /api/files are PUBLIC endpoints (no auth required)
  // Only /api/admin/ endpoints require authentication
  return url.includes("/api/admin/");
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
