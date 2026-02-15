import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useProductsContext } from "../../ProductsContext";
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

export function useBuildShelf() {
  const { api } = useProductsContext();

  const groupsQuery = useQuery<ShelfGroup[]>({
    queryKey: [SHELF_GROUPS_KEY],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/shelf-groups`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const itemsQuery = useQuery<ShelfItem[]>({
    queryKey: [SHELF_ITEMS_KEY],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/build-shelf`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addItem = useMutation({
    mutationFn: async (params: {
      providerId: string;
      catalogId: string;
      catalog: CatalogProduct;
      groupIds?: string[];
    }) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/build-shelf`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to add item to shelf");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_ITEMS_KEY] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/build-shelf/${itemId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to remove item from shelf");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_ITEMS_KEY] });
    },
  });

  const updateItemGroups = useMutation({
    mutationFn: async (params: { itemId: string; groupIds: string[] }) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/build-shelf/${params.itemId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ groupIds: params.groupIds }),
      });
      if (!res.ok) throw new Error("Failed to update item groups");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_ITEMS_KEY] });
    },
  });

  const createGroup = useMutation({
    mutationFn: async (params: { name: string; sortOrder?: number }) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/shelf-groups`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create group" }));
        throw new Error(data.error || "Failed to create group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_GROUPS_KEY] });
    },
  });

  const renameGroup = useMutation({
    mutationFn: async (params: { groupId: string; name: string }) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/shelf-groups/${params.groupId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: params.name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to rename group" }));
        throw new Error(data.error || "Failed to rename group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SHELF_GROUPS_KEY] });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/shelf-groups/${groupId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete group");
      return res.json();
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
