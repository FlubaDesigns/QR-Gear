import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isValidMasterCatalogDocId } from "@shared/qrgCodes";
import { catalogToSelectItem, type CanonicalProductSelectItem } from "@shared/adapters/catalog.adapter";
import type { AdminCatalog } from "@shared/catalogs";
import type { CatalogBlankItem } from "@/features/shared/components/skins/AdminCatalogBlankSkin";

interface CatalogProduct {
  id: number;
  docId?: string;
  qrgBlankId?: string | null;
  qrgCategory?: string | null;
  categorySource?: string | null;
  canonicalTitle?: string | null;
  title: string;
  canonicalDescription?: string | null;
  description?: string;
  brand?: string;
  maker?: string;
  model?: string;
  imageUrl?: string;
  image_url?: string;
  thumbnailUrl?: string;
  madeInUSA?: boolean;
  blueprintId?: number;
  printfulId?: number;
  printProviderId?: number;
  minPrice?: string;
  maxPrice?: string;
  colorCount?: number;
  images?: string[];
  printifyImages?: string[];
  printfulImages?: string[];
  availableColors?: Array<{ name: string; hex?: string }>;
  availableSizes?: string[];
  fulfillmentProvider?: string;
  availableVia?: string[];
  providers?: string[];
}

interface CatalogCategory {
  name: string;
  items: CatalogProduct[];
  count: number;
  printifyCount?: number;
  printfulCount?: number;
  bothCount?: number;
}


export type NormalizedSourceBlank = CanonicalProductSelectItem;
export type ProviderFilter = "printify" | "printful";
export type LocationFilter = "all" | "usa" | "other";
const EMPTY_MAP = {};
const EMPTY_CATEGORIES: CatalogCategory[] = [];
const EMPTY_CATALOGS: AdminCatalog[] = [];
const availableVia = (p: CatalogProduct, provider: ProviderFilter) => p.availableVia?.includes(provider) ?? (p.fulfillmentProvider === provider || p.fulfillmentProvider === 'both');

export function useAdminBlanksController({ targetCatalogId }: { targetCatalogId?: string | null } = {}) {
  const { toast } = useToast();
  const [localCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const selectedCatalogId = targetCatalogId === undefined ? localCatalogId : targetCatalogId;
  const [sourceCatalogId, setSource] = useState<string | null>(null);
  const sourceChosen = useRef(false);
  const setSourceCatalogId = useCallback((id: string | null) => { sourceChosen.current = true; setSource(id); }, []);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("printful");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const master = useQuery<CatalogCategory[]>({
    queryKey: ["/api/master-catalog"], staleTime: 60000,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Master catalog response is invalid.');
      return data;
    },
  });
  const catalogQuery = useQuery<{ catalogs: AdminCatalog[] }>({ queryKey: ["/api/admin/catalogs"] });
  const defaults = useQuery<{ defaultCatalogId: string | null }>({ queryKey: ["/api/admin/catalog-defaults"] });
  const catalogs = catalogQuery.data?.catalogs || EMPTY_CATALOGS;
  const masterCategories = master.data || EMPTY_CATEGORIES;
  const activeCatalog = catalogs.find(c => c.id === selectedCatalogId) ?? null;
  const sourceCatalog = catalogs.find(c => c.id === sourceCatalogId) ?? null;
  const validSelectedCatalogId = activeCatalog?.id ?? null;
  const catalogBlankSet = useMemo(() => new Set(activeCatalog?.blankIds || []), [activeCatalog]);
  const sourceBlankSet = useMemo(() => new Set(sourceCatalog?.blankIds || []), [sourceCatalog]);
  const blankTiers: NonNullable<AdminCatalog["blankTiers"]> = activeCatalog?.blankTiers || EMPTY_MAP;
  const blankColors: NonNullable<AdminCatalog["blankColors"]> = activeCatalog?.blankColors || EMPTY_MAP;
  useEffect(() => {
    if (targetCatalogId !== undefined || sourceChosen.current || !defaults.isSuccess || !catalogQuery.isSuccess) return;
    sourceChosen.current = true;
    const id = defaults.data.defaultCatalogId;
    if (catalogs.some(c => c.id === id)) setSource(id);
  }, [targetCatalogId, defaults.isSuccess, defaults.data, catalogQuery.isSuccess, catalogs]);

  const allProductMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    for (const category of masterCategories) for (const p of category.items) {
      // Provider IDs are lookup references, never catalog identity.
      if (p.docId && isValidMasterCatalogDocId(p.docId)) map.set(p.docId, p);
    }
    return map;
  }, [masterCategories]);
  const activeCategories = useMemo(() => masterCategories.map(c => {
    const items = c.items.filter(p => p.docId && allProductMap.has(p.docId) && (targetCatalogId !== undefined || availableVia(p, providerFilter)));
    return { ...c, items, count: items.length };
  }).filter(c => c.count > 0), [masterCategories, allProductMap, targetCatalogId, providerFilter]);
  const allProducts = useMemo(() => Array.from(new Map(activeCategories.flatMap(c => c.items).map(p => [p.docId!, p])).values()), [activeCategories]);
  const filtered = useMemo(() => {
    let items = allProducts;
    if (sourceCatalogId) items = items.filter(p => sourceBlankSet.has(p.docId!));
    if (categoryFilter !== "all") {
      const allowed = new Set(activeCategories.find(c => c.name === categoryFilter)?.items.map(p => p.docId) || []);
      items = items.filter(p => allowed.has(p.docId));
    }
    if (locationFilter === 'usa') items = items.filter(p => p.madeInUSA);
    if (locationFilter === 'other') items = items.filter(p => !p.madeInUSA);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(p => [p.canonicalTitle, p.title, p.brand, p.maker, p.model, p.canonicalDescription, p.description, p.docId].some(v => v?.toLowerCase().includes(q)));
    }
    return items;
  }, [allProducts, sourceCatalogId, sourceBlankSet, categoryFilter, activeCategories, locationFilter, search]);
  const viewItem = (p: CatalogProduct, catalog?: AdminCatalog | null) => catalogToSelectItem(p,
    catalog?.blankDescriptions?.[p.docId!], catalog?.blankTitles?.[p.docId!], catalog?.blankImages?.[p.docId!]);
  const sourceItemMap = useMemo(() => {
    const map = new Map<string, NormalizedSourceBlank>();
    for (const p of filtered) map.set(p.docId!, viewItem(p, catalogBlankSet.has(p.docId!) ? activeCatalog : sourceCatalog));
    for (const id of Array.from(catalogBlankSet)) {
      const p = allProductMap.get(id); if (p) map.set(id, viewItem(p, activeCatalog));
    }
    return map;
  }, [filtered, allProductMap, catalogBlankSet, activeCatalog, sourceCatalog]);
  const catalogItems = useMemo<CatalogBlankItem[]>(() => Array.from(catalogBlankSet).map(id => {
    const p = allProductMap.get(id);
    const item = p ? viewItem(p, activeCatalog) : null;
    return {
      id, catalogKey: id, title: item?.name || activeCatalog?.blankTitles?.[id] || id,
      subtitle: p ? [item?.manufacturer, item?.model].filter(Boolean).join(' ') : 'Blank unavailable — remove its catalog reference',
      imageUrl: item?.primaryImageUrl || null, tier: (blankTiers[id] as 'good' | 'better' | 'best') || null,
      isPrintful: p ? availableVia(p, 'printful') : false, qrgBlankId: p?.qrgBlankId || null,
      unavailable: !p,
    };
  }), [catalogBlankSet, allProductMap, activeCatalog, blankTiers]);
  const scrollItems = filtered.map(p => ({ id: p.docId!, title: sourceItemMap.get(p.docId!)?.name || p.title, imageUrl: sourceItemMap.get(p.docId!)?.primaryImageUrl || '' }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
  const mutationError = (error: any) => toast({ title: 'Catalog change failed', description: error.message, variant: 'destructive' });
  const addBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds, sourceCatalogId }: { catalogId: string; blankIds: string[]; sourceCatalogId?: string }) => {
      const res = await apiRequest('POST', `/api/admin/catalogs/${catalogId}/blanks`, { blankIds, ...(sourceCatalogId ? { sourceCatalogId } : {}) }); return res.json();
    },
    onSuccess: async data => { await refresh(); toast({ title: 'Added to catalog', description: `${data.total} total blanks` }); }, onError: mutationError,
  });
  const removeBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds }: { catalogId: string; blankIds: string[] }) => {
      const res = await apiRequest('DELETE', `/api/admin/catalogs/${catalogId}/blanks`, { blankIds }); return res.json();
    },
    onSuccess: async data => { await refresh(); toast({ title: 'Removed from catalog', description: `${data.total} remaining` }); }, onError: mutationError,
  });
  const save = async (endpoint: string, id: string, value: Record<string, unknown>) => {
    if (!validSelectedCatalogId || !catalogBlankSet.has(id)) throw new Error('Add the blank to a catalog before editing it.');
    const res = await apiRequest('PUT', `/api/admin/catalogs/${validSelectedCatalogId}/${endpoint}`, { blankId: id, ...value }); return res.json();
  };
  const saveDescriptionMutation = useMutation({ mutationFn: ({ id, description }: { id: string; description: string }) => save('blank-description', id, { description }), onSuccess: refresh, onError: mutationError });
  const saveTitleMutation = useMutation({ mutationFn: ({ id, title }: { id: string; title: string }) => save('blank-title', id, { title }), onSuccess: refresh, onError: mutationError });
  const saveColorsMutation = useMutation({ mutationFn: ({ id, colors }: { id: string; colors: Array<{name: string; hex: string}> }) => save('blank-colors', id, { colors }), onSuccess: refresh, onError: mutationError });
  const saveImagesMutation = useMutation({ mutationFn: ({ id, images, restore = false }: { id: string; images: string[]; restore?: boolean }) => save('blank-images', id, { images, restore }), onSuccess: refresh, onError: mutationError });
  const saveTierMutation = useMutation({ mutationFn: ({ id, tier }: { id: string; tier: string | null }) => save('blank-tier', id, { tier }), onSuccess: refresh, onError: mutationError });
  const onAddToCatalog = (id: string) => {
    if (!validSelectedCatalogId) { toast({ title: 'Select a catalog first', variant: 'destructive' }); return; }
    if (!isValidMasterCatalogDocId(id)) { toast({ title: 'Choose a classified QRG blank', variant: 'destructive' }); return; }
    if (!addBlanksMutation.isPending) addBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [id], ...(sourceCatalogId ? { sourceCatalogId } : {}) });
  };
  const loadError = [master.error, catalogQuery.error, defaults.error].filter(Boolean).map((e: any) => e.message).join(' · ');
  const reload = () => { void master.refetch(); void catalogQuery.refetch(); void defaults.refetch(); };
  return {
    loadingCatalog: master.isLoading || catalogQuery.isLoading, loadError, reload,
    catalogs, activeCatalog, hasCatalogSelected: !!validSelectedCatalogId, selectedCatalogId, setSelectedCatalogId,
    sourceCatalogId, setSourceCatalogId, sourceCatalog, sourceBlankSet,
    providerFilter, setProviderFilter, search, setSearch, categoryFilter, setCategoryFilter, locationFilter, setLocationFilter,
    categoryNames: ['all', ...activeCategories.map(c => c.name)], categoryCounts: Object.fromEntries(activeCategories.map(c => [c.name, c.count])),
    catalogItems, sourceItemMap, scrollItems, blankTiers, blankColors,
    onAddToCatalog, resolveBlankKey: (id: string, p?: CatalogProduct) => p?.docId || id,
    onSaveDescription: async (id: string, description: string, canonicalKey?: string) => { await saveDescriptionMutation.mutateAsync({ id: canonicalKey || id, description }); },
    onSaveTitle: async (id: string, title: string, canonicalKey?: string) => { await saveTitleMutation.mutateAsync({ id: canonicalKey || id, title }); },
    onSaveColors: async (id: string, colors: Array<{name: string; hex: string}>, canonicalKey?: string) => { await saveColorsMutation.mutateAsync({ id: canonicalKey || id, colors }); },
    onImagesBulkSave: async (id: string, images: string[]) => { await saveImagesMutation.mutateAsync({ id, images }); },
    onImageRestore: async (id: string) => { await saveImagesMutation.mutateAsync({ id, images: [], restore: true }); },
    onImageDelete: async (id: string, url: string) => { await saveImagesMutation.mutateAsync({ id, images: (sourceItemMap.get(id)?.images || []).filter(image => image !== url) }); },
    onTierChange: (id: string, tier: string | null) => saveTierMutation.mutate({ id, tier }),
    getItemMappingBadge: (id: string) => (allProductMap.get(id)?.availableVia?.length || 0) > 1,
    allProductMap, catalogBlankSet, removeBlanksMutation, addBlanksMutation, saveDescriptionMutation, saveTitleMutation, saveColorsMutation,
    totalProductCount: allProducts.length, filteredCount: filtered.length, masterCategories, activeCategories,
  };
}
export type { CatalogProduct, CatalogCategory, AdminCatalog };
