import type { LibraryAssetWithProxy } from "./types";

export function getImageUrl(asset: LibraryAssetWithProxy): string {
  if (asset.proxyUrl)  return asset.proxyUrl;
  if (asset.publicUrl) return asset.publicUrl;
  return "";
}
