import { useMemo, useCallback, useState } from "react";
import type { MemberLibraryItem } from "@/features/shared/components/skins/MemberLibraryItemSkin";

export interface MembersLibraryControllerState {
  items: MemberLibraryItem[];
  loading: boolean;
  canEdit: boolean;
  detailItem: MemberLibraryItem | null;
  detailOpen: boolean;
}

export function useMembersLibraryController(rawItems: any[], loading: boolean) {
  const [detailItem, setDetailItem] = useState<MemberLibraryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const items: MemberLibraryItem[] = useMemo(() => {
    return rawItems.map((item: any): MemberLibraryItem => ({
      id: item.id || item.docId || "",
      title: item.title || item.name || "Untitled",
      thumbnailUrl: item.thumbnailUrl || item.imageUrl || item.qrBasicMockup || item.qrPlusMockup || item.itemImage || null,
      subtitle: item.subtitle || item.productTitle || null,
      status: item.status || "published",
      price: item.retailPrice ?? item.price ?? null,
      earnings: item.memberEarnings ?? null,
      itemType: item.kind || item.type || null,
    }));
  }, [rawItems]);

  const canEdit = true;

  const onOpenItem = useCallback((item: MemberLibraryItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const onCloseDetail = useCallback(() => {
    setDetailItem(null);
    setDetailOpen(false);
  }, []);

  const state: MembersLibraryControllerState = useMemo(() => ({
    items,
    loading,
    canEdit,
    detailItem,
    detailOpen,
  }), [items, loading, canEdit, detailItem, detailOpen]);

  return {
    state,
    onOpenItem,
    onCloseDetail,
  };
}
