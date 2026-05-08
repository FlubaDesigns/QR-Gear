import { useMemo, useCallback, useState } from "react";
import type { AdminLibraryAssetItem, AssetType } from "@/features/shared/components/skins/AdminLibraryAssetSkin";
import type { LibraryAssetDetailItem } from "@/features/shared/components/skins/LibraryAssetDetailSkin";

export interface LibraryControllerState {
  assets: AdminLibraryAssetItem[];
  loading: boolean;
  detailItem: LibraryAssetDetailItem | null;
  detailOpen: boolean;
  activeTab: string;
}

export function useLibraryController(rawAssets: any[], activeTab: string, loading: boolean) {
  const [detailItem, setDetailItem] = useState<LibraryAssetDetailItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const resolveAssetType = useCallback((tab: string): AssetType => {
    switch (tab) {
      case "graphics": return "graphic";
      case "templates": return "template";
      case "backgrounds": return "background";
      case "cropped": return "cropped";
      case "source": return "source";
      default: return "source";
    }
  }, []);

  const assets: AdminLibraryAssetItem[] = useMemo(() => {
    const assetType = resolveAssetType(activeTab);
    return rawAssets.map((a: any): AdminLibraryAssetItem => ({
      id: a.id || a.docId || String(a.url || Math.random()),
      title: a.title || a.name || a.fileName || "Untitled",
      thumbnailUrl: a.thumbnailUrl || a.imageUrl || a.url || a.compositeUrl || null,
      assetType,
      metadata: a.dimensions ? { dimensions: a.dimensions } : undefined,
      createdAt: a.createdAt,
    }));
  }, [rawAssets, activeTab, resolveAssetType]);

  const onOpenAsset = useCallback((item: AdminLibraryAssetItem) => {
    setDetailItem({
      id: item.id,
      title: item.title,
      previewUrl: item.thumbnailUrl,
      assetType: item.assetType,
      metadata: item.metadata,
      createdAt: item.createdAt,
    });
    setDetailOpen(true);
  }, []);

  const onCloseDetail = useCallback(() => {
    setDetailItem(null);
    setDetailOpen(false);
  }, []);

  const state: LibraryControllerState = useMemo(() => ({
    assets,
    loading,
    detailItem,
    detailOpen,
    activeTab,
  }), [assets, loading, detailItem, detailOpen, activeTab]);

  return {
    state,
    onOpenAsset,
    onCloseDetail,
  };
}
