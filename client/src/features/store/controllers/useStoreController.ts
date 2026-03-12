import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { StoreProductItem } from "@/features/shared/components/skins/StoreProductCardSkin";

export interface StoreControllerState {
  products: StoreProductItem[];
  loading: boolean;
  isReadOnly: true;
  detailItem: StoreProductItem | null;
  detailOpen: boolean;
}

export function useStoreController() {
  const [detailItem, setDetailItem] = useState<StoreProductItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: rawProducts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/products");
      return res.json();
    },
  });

  const products: StoreProductItem[] = useMemo(() => {
    return rawProducts
      .filter((p: any) => p.isEnabled !== false)
      .map((p: any): StoreProductItem => ({
        id: p.id || p.printifyId || String(p.blueprintId),
        title: p.name || p.title || "",
        imageUrl: p.imageUrl || null,
        retailPrice: p.customerPrice ?? p.retailPrice ?? null,
        description: p.description || null,
        colorCount: p.availableColors?.length || 0,
        madeInUSA: p.madeInUSA ?? false,
      }));
  }, [rawProducts]);

  const onOpenDetail = useCallback((item: StoreProductItem) => {
    setDetailItem(item);
    setDetailOpen(true);
  }, []);

  const onCloseDetail = useCallback(() => {
    setDetailItem(null);
    setDetailOpen(false);
  }, []);

  const state: StoreControllerState = useMemo(() => ({
    products,
    loading: isLoading,
    isReadOnly: true as const,
    detailItem,
    detailOpen,
  }), [products, isLoading, detailItem, detailOpen]);

  return {
    state,
    onOpenDetail,
    onCloseDetail,
  };
}
