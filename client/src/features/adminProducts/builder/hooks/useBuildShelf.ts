import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { adminFetch } from "@/lib/adminFetch";
import type { CatalogProduct } from "../types";

export interface ShelfGroup {
  id: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShelfItem {
  id: string;
  shelfKey: string;
  providerId: string;
  catalogId: string;
  catalog: CatalogProduct;
  groupIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

const SHELF_ITEMS_KEY = "admin-build-shelf";
const SHELF_GROUPS_KEY = "admin-shelf-groups";

export function useBuildShelf(catalogId?: string | null) {
  const groupsQuery = useQuery<ShelfGroup[]>({
    queryKey: [SHELF_GROUPS_KEY],
    queryFn: async () => {
      try {
        return await adminFetch<ShelfGroup[]>("/shelf-groups");
      } catch {
        return [];
      }
    },
  });

  const scopedCatalogId = catalogId && catalogId !== "all" && catalogId !== "joint"
    ? catalogId
    : null;

  const itemsQuery = useQuery<ShelfItem[]>({
    queryKey: [SHELF_ITEMS_KEY, scopedCatalogId],
    queryFn: async () => {
      try {
        const url = scopedCatalogId
          ? `/build-shelf?catalogId=${encodeURIComponent(scopedCatalogId)}`
          : "/build-shelf?mode=global";
        return await adminFetch<ShelfItem[]>(url);
      } catch {
        return [];
      }
    },
  });

  const addItem = useMutation({
    mutationFn: async (params: {
      providerId: string;
      catalogId: string;
      catalog: CatalogProduct;
      groupIds?: string[];
    }) => {
      return adminFetch("/build-shelf", { method: "POST", json: params });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_ITEMS_KEY] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      return adminFetch(`/build-shelf/${itemId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_ITEMS_KEY] });
    },
  });

  const updateItemGroups = useMutation({
    mutationFn: async (params: { itemId: string; groupIds: string[] }) => {
      return adminFetch(`/build-shelf/${params.itemId}`, {
        method: "PATCH",
        json: { groupIds: params.groupIds },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_ITEMS_KEY] });
    },
  });

  const createGroup = useMutation({
    mutationFn: async (params: { name: string; sortOrder?: number }) => {
      return adminFetch("/shelf-groups", { method: "POST", json: params });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_GROUPS_KEY] });
    },
  });

  const renameGroup = useMutation({
    mutationFn: async (params: { groupId: string; name: string }) => {
      return adminFetch(`/shelf-groups/${params.groupId}`, {
        method: "PATCH",
        json: { name: params.name },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_GROUPS_KEY] });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      return adminFetch(`/shelf-groups/${groupId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_GROUPS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SHELF_ITEMS_KEY] });
    },
  });

  function isOnShelf(providerId: string, catalogId: string): ShelfItem | undefined {
    return itemsQuery.data?.find(
      (item) => item.shelfKey === `${providerId}:${catalogId}`
    );
  }

  return {
    groups: groupsQuery.data || [],
    groupsLoading: groupsQuery.isLoading,
    items: itemsQuery.data || [],
    itemsLoading: itemsQuery.isLoading,
    addItem,
    removeItem,
    updateItemGroups,
    createGroup,
    renameGroup,
    deleteGroup,
    isOnShelf,
  };
}
