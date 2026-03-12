import { useMemo, useCallback, useState } from "react";
import type { PacketItem } from "@/features/shared/components/skins/PacketItemSkin";

export interface PacketControllerState {
  items: PacketItem[];
  loading: boolean;
  detailItem: PacketItem | null;
  detailOpen: boolean;
}

export function usePacketController(rawItems: any[], loading: boolean) {
  const [detailItem, setDetailItem] = useState<PacketItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const items: PacketItem[] = useMemo(() => {
    return rawItems.map((item: any): PacketItem => ({
      id: item.id || item.docId || "",
      title: item.title || item.name || "Untitled",
      imageUrl: item.imageUrl || item.thumbnailUrl || item.mockupUrl || null,
      status: item.status || "draft",
      selectedColor: item.selectedColor || item.color || null,
      selectedSize: item.selectedSize || item.size || null,
      productTitle: item.productTitle || item.productName || null,
      retailPrice: item.retailPrice ?? item.price ?? null,
      earnings: item.memberEarnings ?? null,
      packetType: item.kind || item.packetType || null,
    }));
  }, [rawItems]);

  const onOpenItem = useCallback((item: PacketItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const onCloseDetail = useCallback(() => {
    setDetailItem(null);
    setDetailOpen(false);
  }, []);

  const onEditItem = useCallback((item: PacketItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const state: PacketControllerState = useMemo(() => ({
    items,
    loading,
    detailItem,
    detailOpen,
  }), [items, loading, detailItem, detailOpen]);

  return {
    state,
    onOpenItem,
    onCloseDetail,
    onEditItem,
  };
}
