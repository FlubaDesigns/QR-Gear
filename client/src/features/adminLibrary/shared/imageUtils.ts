import type { LibraryAssetWithProxy } from "./types";

export function getImageUrl(asset: LibraryAssetWithProxy): string {
  if (asset.proxyUrl) return asset.proxyUrl;
  if (asset.publicUrl) return asset.publicUrl;
  if (asset.storageUrl) {
    const filename = asset.storageUrl.split("/").pop() || "";
    return `/api/library-files/${encodeURIComponent(filename)}`;
  }
  return "";
}

export async function fetchImageAsBlob(
  imageUrl: string,
  getAuthHeaders: () => Promise<HeadersInit>
): Promise<string> {
  if (!imageUrl) throw new Error("No image URL");
  
  const headers = await getAuthHeaders();
  const response = await fetch(imageUrl, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to load image: ${response.status}`);
  }
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
