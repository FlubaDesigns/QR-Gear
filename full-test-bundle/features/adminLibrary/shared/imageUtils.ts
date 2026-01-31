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
