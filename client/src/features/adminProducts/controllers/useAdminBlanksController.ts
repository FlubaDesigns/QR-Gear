import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getCanonicalBlankKey, safeBlankId, isProviderPrintful } from "@shared/blankKeys";
import type { CatalogBlankItem } from "@/features/shared/components/skins/AdminCatalogBlankSkin";

interface CatalogProduct {
  id: number;
  title: string;
  description?: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  image_url?: string;
  thumbnailUrl?: string;
  madeInUSA?: boolean;
  blueprintId?: number;
  printProviderId?: number;
  minPrice?: string;
  maxPrice?: string;
  colorCount?: number;
  availableColors?: Array<{ name: string; hex?: string }>;
  availableSizes?: string[];
  fulfillmentProvider?: string;
  availableVia?: string[];
  printfulId?: number;
  providers?: string[];
}

interface CatalogCategory {
  name: string;
  items: CatalogProduct[];
  count: number;
}

interface AdminCatalog {
  id: string;
  name: string;
  description: string;
  blankIds: string[];
  blankTiers?: Record<string, string>;
  tierConfig?: Record<string, { displayName?: string; description?: string; tagline?: string }>;
  blankDescriptions?: Record<string, string>;
  blankTitles?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

interface PricingSettings {
  markupPercent: number;
  markupFixed: number;
  memberProfitShare: number;
}

interface ProviderMapping {
  printifyBlueprintId: number;
  printfulProductId: number;
  source?: string;
}

export interface NormalizedSourceBlank {
  id: string;
  name: string;
  providerTitle?: string;
  adminCatalogTitle?: string | null;
  price: number | null;
  cost: number | null;
  manufacturer: string | null;
  madeInUSA: boolean;
  primaryImageUrl: string | null;
  description: string | null;
  providerDescription: string | null;
  adminCatalogDescription: string | null;
  providerDescriptionRaw: string | null;
  colorsAvailable: Array<{ name: string; hex?: string }>;
  sizesAvailable: string[];
  defaultColor: string | null;
}

export type ProviderFilter = "printify" | "printful";
export type LocationFilter = "all" | "usa" | "other";

function normalizeSourceBlank(p: CatalogProduct, pricing: PricingSettings, adminCatalogDesc?: string, adminCatalogTitle?: string): NormalizedSourceBlank {
  const cost = p.minPrice ? parseFloat(p.minPrice) : null;
  const retailPrice = cost !== null
    ? Math.ceil((cost * (1 + pricing.markupPercent / 100) + pricing.markupFixed) * 100) / 100
    : null;
  const imageUrl = p.imageUrl || p.image_url || p.thumbnailUrl || null;
  const providerDesc = p.description || null;
  const effectiveDesc = adminCatalogDesc || providerDesc;
  const providerTitle = p.title || "";
  const normalizedAdminTitle = typeof adminCatalogTitle === "string" && adminCatalogTitle.trim().length > 0 ? adminCatalogTitle : null;
  const effectiveTitle = normalizedAdminTitle ?? providerTitle;
  return {
    id: String(p.id),
    name: effectiveTitle,
    providerTitle,
    adminCatalogTitle: normalizedAdminTitle,
    price: retailPrice,
    cost,
    manufacturer: p.brand || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: imageUrl,
    description: effectiveDesc,
    providerDescription: providerDesc,
    adminCatalogDescription: adminCatalogDesc || null,
    providerDescriptionRaw: providerDesc,
    colorsAvailable: (p.availableColors || []).map(c => ({ name: c.name, hex: c.hex })),
    sizesAvailable: p.availableSizes || [],
    defaultColor: (p.availableColors || []).length > 0 ? p.availableColors![0].name : null,
  };
}

export function useAdminBlanksController() {
  const { toast } = useToast();
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [sourceCatalogId, setSourceCatalogId] = useState<string | null>(null);
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("printful");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  // Single source of truth: master_products collection
  const { data: masterCategories = [], isLoading: loadingMasterCatalog } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/master-catalog"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60000,
  });

  const { data: mappingsData } = useQuery<{ firestoreMappings: ProviderMapping[]; hardcodedMappings: ProviderMapping[] }>({
    queryKey: ["/api/admin/catalog/printful-mappings"],
  });

  const { data: catalogsData } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });

  const { data: defaultsData } = useQuery<{ defaultCatalogId: string | null }>({
    queryKey: ["/api/admin/catalog-defaults"],
  });

  const { data: pricingData } = useQuery<PricingSettings>({
    queryKey: ["/api/admin/pricing-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/pricing-settings");
      const d = await res.json();
      return {
        markupPercent: d.markupPercent ?? d.globalMarkupPercent ?? 25,
        markupFixed: d.markupFixed ?? d.globalMarkupFixed ?? 0,
        memberProfitShare: d.memberProfitShare ?? 0.25,
      };
    },
  });

  const pricing: PricingSettings = pricingData || { markupPercent: 25, markupFixed: 0, memberProfitShare: 0.25 };
  const loadingCatalog = loadingMasterCatalog;
  const catalogs = catalogsData?.catalogs || [];
  const activeCatalog = selectedCatalogId ? catalogs.find(c => c.id === selectedCatalogId) : null;
  const validSelectedCatalogId = activeCatalog ? selectedCatalogId : null;
  const catalogBlankSet = useMemo(() => new Set((activeCatalog?.blankIds || []).map(id => safeBlankId(id))), [activeCatalog]);
  const blankTiers = activeCatalog?.blankTiers || {};
  const blankDescriptions = activeCatalog?.blankDescriptions || {};
  const blankTitles = activeCatalog?.blankTitles || {};
  const hasCatalogSelected = !!validSelectedCatalogId;

  const mappedPrintifyIds = useMemo(() => {
    const set = new Set<number>();
    if (mappingsData) {
      mappingsData.firestoreMappings.forEach(m => set.add(m.printifyBlueprintId));
      mappingsData.hardcodedMappings.forEach(m => set.add(m.printifyBlueprintId));
    }
    return set;
  }, [mappingsData]);

  const mappedPrintfulIds = useMemo(() => {
    const set = new Set<number>();
    if (mappingsData) {
      mappingsData.firestoreMappings.forEach(m => set.add(m.printfulProductId));
      mappingsData.hardcodedMappings.forEach(m => set.add(m.printfulProductId));
    }
    return set;
  }, [mappingsData]);

  // Derive flat product lists from master-catalog by provider
  const printifyProducts = useMemo(() => {
    const items: CatalogProduct[] = [];
    const seen = new Set<number>();
    for (const cat of masterCategories) {
      for (const item of (cat.items || [])) {
        if (item.fulfillmentProvider === "printify" && !seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
    }
    return items;
  }, [masterCategories]);

  const printfulProducts = useMemo(() => {
    const items: CatalogProduct[] = [];
    const seen = new Set<number>();
    for (const cat of masterCategories) {
      for (const item of (cat.items || [])) {
        if (item.fulfillmentProvider === "printful" && !seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
    }
    return items;
  }, [masterCategories]);

  // Derive per-provider category lists from master-catalog
  const printifyCategories = useMemo(() => {
    return masterCategories
      .map(cat => ({
        name: cat.name,
        items: cat.items.filter(i => i.fulfillmentProvider === "printify"),
        count: cat.items.filter(i => i.fulfillmentProvider === "printify").length,
      }))
      .filter(c => c.count > 0);
  }, [masterCategories]);

  const printfulCategories = useMemo(() => {
    return masterCategories
      .map(cat => ({
        name: cat.name,
        items: cat.items.filter(i => i.fulfillmentProvider === "printful"),
        count: cat.items.filter(i => i.fulfillmentProvider === "printful").length,
      }))
      .filter(c => c.count > 0);
  }, [masterCategories]);

  const activeCategories = providerFilter === "printful" ? printfulCategories : printifyCategories;

  const allProducts = useMemo(() => {
    return providerFilter === "printful" ? printfulProducts : printifyProducts;
  }, [providerFilter, printifyProducts, printfulProducts]);

  const allProductMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    // Index by numeric id and old-style keys for backward compat
    printifyProducts.forEach(p => map.set(String(p.id), p));
    printfulProducts.forEach(p => map.set(`pf:${p.id}`, p));
    printifyProducts.forEach(p => { if (p.printfulId) map.set(`pf:${p.printfulId}`, p); });
    // Index by master_catalog docId (py_X / pf_X) — the canonical format
    const allItems = [...printifyProducts, ...printfulProducts];
    allItems.forEach(p => {
      const docId = (p as any).docId as string | undefined;
      if (docId) map.set(docId, p);
    });
    return map;
  }, [printifyProducts, printfulProducts]);

  const categoryNames = useMemo(() => {
    return ["all", ...activeCategories.map(c => c.name)];
  }, [activeCategories]);

  // Auto-load default catalog as SOURCE on first load
  useEffect(() => {
    if (!defaultLoaded && defaultsData?.defaultCatalogId && catalogs.length > 0) {
      const exists = catalogs.find(c => c.id === defaultsData.defaultCatalogId);
      if (exists) {
        setSourceCatalogId(defaultsData.defaultCatalogId);
      }
      setDefaultLoaded(true);
    }
  }, [defaultsData, catalogs, defaultLoaded]);

  // Source catalog derivations
  const sourceCatalog = sourceCatalogId ? catalogs.find(c => c.id === sourceCatalogId) ?? null : null;
  const sourceBlankSet = useMemo(
    () => new Set((sourceCatalog?.blankIds || []).map(id => safeBlankId(id))),
    [sourceCatalog]
  );

  const addBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds }: { catalogId: string; blankIds: string[] }) => {
      const res = await apiRequest("POST", `/api/admin/catalogs/${catalogId}/blanks`, { blankIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Added to catalog", description: `${data.count} total blanks` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds }: { catalogId: string; blankIds: string[] }) => {
      const res = await apiRequest("DELETE", `/api/admin/catalogs/${catalogId}/blanks`, { blankIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Removed from catalog", description: `${data.count} remaining` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setBlankTierMutation = useMutation({
    mutationFn: async ({ catalogId, blankId, tier }: { catalogId: string; blankId: string; tier: string | null }) => {
      const res = await apiRequest("PUT", `/api/admin/catalogs/${catalogId}/blank-tier`, { blankId, tier });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error setting tier", description: err.message, variant: "destructive" }),
  });

  const saveDescriptionMutation = useMutation({
    mutationFn: async ({ catalogId, blankId, description }: { catalogId: string; blankId: string; description: string }) => {
      const res = await apiRequest("PUT", `/api/admin/catalogs/${catalogId}/blank-description`, { blankId, description });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Description saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error saving description", description: err.message, variant: "destructive" }),
  });

  const saveTitleMutation = useMutation({
    mutationFn: async ({ catalogId, blankId, title }: { catalogId: string; blankId: string; title: string }) => {
      const res = await apiRequest("PUT", `/api/admin/catalogs/${catalogId}/blank-title`, { blankId, title });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Title saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    },
    onError: (err: any) => toast({ title: "Error saving title", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    let items = allProducts;
    // Narrow to source catalog items when source is selected
    if (sourceCatalogId && sourceBlankSet.size > 0) {
      items = items.filter(p => sourceBlankSet.has(getCanonicalBlankKey(p)));
    }
    if (categoryFilter !== "all") {
      const cat = activeCategories.find(c => c.name === categoryFilter);
      if (cat) {
        const catIds = new Set(cat.items.map(i => i.id));
        items = items.filter(p => catIds.has(p.id));
      }
    }
    if (locationFilter === "usa") items = items.filter(p => p.madeInUSA);
    if (locationFilter === "other") items = items.filter(p => !p.madeInUSA);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [allProducts, sourceCatalogId, sourceBlankSet, activeCategories, categoryFilter, locationFilter, search]);

  const resolveBlankKey = useCallback((id: string, product?: CatalogProduct) => {
    if (product) return getCanonicalBlankKey(product);
    const found = allProductMap.get(id) || allProductMap.get(`pf:${id}`);
    if (found) return getCanonicalBlankKey(found);
    return id;
  }, [allProductMap]);

  const catalogItems: CatalogBlankItem[] = useMemo(() => {
    return Array.from(catalogBlankSet)
      .map(id => {
        const safe = safeBlankId(id);
        const product = allProductMap.get(safe);
        if (!product) return null;
        return {
          id: String(product.id),
          catalogKey: safe,
          title: product.title,
          imageUrl: product.imageUrl || product.image_url || product.thumbnailUrl || null,
          tier: (blankTiers[safe] as "good" | "better" | "best") || null,
          isPrintful: isProviderPrintful(safe),
          hasMockupMapping: false,
        };
      })
      .filter(Boolean) as CatalogBlankItem[];
  }, [catalogBlankSet, allProductMap, blankTiers]);

  const sourceItemMap = useMemo(() => {
    const map = new Map<string, NormalizedSourceBlank>();
    const catalogProducts = catalogItems.map(c => allProductMap.get(c.catalogKey)).filter(Boolean) as CatalogProduct[];
    filtered.forEach(p => {
      const blankKey = getCanonicalBlankKey(p);
      const customDesc = blankDescriptions[blankKey];
      const customTitle = blankTitles[blankKey];
      map.set(String(p.id), normalizeSourceBlank(p, pricing, customDesc, customTitle));
    });
    catalogProducts.forEach(p => {
      const blankKey = getCanonicalBlankKey(p);
      const customDesc = blankDescriptions[blankKey];
      const customTitle = blankTitles[blankKey];
      map.set(String(p.id), normalizeSourceBlank(p, pricing, customDesc, customTitle));
    });
    return map;
  }, [filtered, catalogItems, allProductMap, pricing, blankDescriptions, blankTitles]);

  const scrollItems = useMemo(() =>
    filtered.map(p => ({
      id: String(p.id),
      imageUrl: p.imageUrl || p.image_url || p.thumbnailUrl || "",
      title: p.title || "",
      subtitle: p.brand,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      colorCount: p.colorCount,
      madeInUSA: p.madeInUSA,
    })),
    [filtered]
  );

  const onAddToCatalog = useCallback((blankKey: string) => {
    if (!validSelectedCatalogId) {
      toast({ title: "Select a catalog first", variant: "destructive" });
      return;
    }
    addBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [blankKey] });
  }, [validSelectedCatalogId, addBlanksMutation, toast]);

  const onRemoveFromCatalog = useCallback((blankKey: string) => {
    if (!validSelectedCatalogId) return;
    removeBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [blankKey] });
  }, [validSelectedCatalogId, removeBlanksMutation]);

  const onToggleItem = useCallback((id: string, product?: CatalogProduct) => {
    if (!validSelectedCatalogId) {
      toast({ title: "Select a catalog first", description: "Choose a catalog from the dropdown to add or remove blanks.", variant: "destructive" });
      return;
    }
    const key = resolveBlankKey(id, product);
    if (catalogBlankSet.has(key)) {
      removeBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [key] });
    } else {
      addBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [key] });
    }
  }, [validSelectedCatalogId, catalogBlankSet, addBlanksMutation, removeBlanksMutation, toast, resolveBlankKey]);

  const onSaveDescription = useCallback(async (id: string, description: string, canonicalKey?: string) => {
    if (!validSelectedCatalogId) {
      toast({ title: "Select a catalog first", variant: "destructive" });
      return;
    }
    const blankKey = canonicalKey || resolveBlankKey(id);
    await saveDescriptionMutation.mutateAsync({ catalogId: validSelectedCatalogId, blankId: blankKey, description });
  }, [validSelectedCatalogId, resolveBlankKey, saveDescriptionMutation, toast]);

  const onSaveTitle = useCallback(async (id: string, title: string, canonicalKey?: string) => {
    if (!validSelectedCatalogId) {
      toast({ title: "Select a catalog first", variant: "destructive" });
      return;
    }
    const blankKey = canonicalKey || resolveBlankKey(id);
    await saveTitleMutation.mutateAsync({ catalogId: validSelectedCatalogId, blankId: blankKey, title });
  }, [validSelectedCatalogId, resolveBlankKey, saveTitleMutation, toast]);

  const onTierChange = useCallback((blankId: string, tier: string | null) => {
    if (!validSelectedCatalogId) return;
    setBlankTierMutation.mutate({ catalogId: validSelectedCatalogId, blankId, tier });
  }, [validSelectedCatalogId, setBlankTierMutation]);

  const isItemInCatalog = useCallback((id: string, product?: CatalogProduct) => {
    return catalogBlankSet.has(resolveBlankKey(id, product));
  }, [resolveBlankKey, catalogBlankSet]);

  const getItemMappingBadge = useCallback((id: string) => {
    const numId = Number(id);
    if (providerFilter === "printify") return mappedPrintifyIds.has(numId);
    return mappedPrintfulIds.has(numId);
  }, [providerFilter, mappedPrintifyIds, mappedPrintfulIds]);

  const totalProductCount = allProducts.length;
  const filteredCount = filtered.length;
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    activeCategories.forEach(c => { map[c.name] = c.count ?? c.items?.length ?? 0; });
    return map;
  }, [activeCategories]);

  return {
    loadingCatalog,
    catalogs,
    activeCatalog,
    hasCatalogSelected,
    selectedCatalogId,
    setSelectedCatalogId,
    sourceCatalogId,
    setSourceCatalogId,
    sourceCatalog,
    sourceBlankSet,
    providerFilter,
    setProviderFilter,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    locationFilter,
    setLocationFilter,
    categoryNames,

    catalogItems,
    sourceItemMap,
    scrollItems,
    blankTiers,
    blankTitles,

    onAddToCatalog,
    onRemoveFromCatalog,
    onToggleItem,
    onSaveDescription,
    onSaveTitle,
    onTierChange,
    isItemInCatalog,
    getItemMappingBadge,
    resolveBlankKey,

    allProductMap,
    catalogBlankSet,
    removeBlanksMutation,
    saveDescriptionMutation,
    saveTitleMutation,
    pricing,

    totalProductCount,
    filteredCount,
    categoryCounts,
  };
}

export type { CatalogProduct, AdminCatalog, PricingSettings, CatalogCategory };
