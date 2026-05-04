import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getCanonicalBlankKey, safeBlankId, isProviderPrintful } from "@shared/blankKeys";
import type { CatalogBlankItem } from "@/features/shared/components/skins/AdminCatalogBlankSkin";

/**
 * Build a Set that recognises ALL possible blankId formats for the same product.
 * QRG format (qrg_101, pending_py_123) is passed through as-is.
 * Legacy formats (py_123, pf_123, pf:123, plain numeric) are expanded for backward compat.
 */
function expandBlankIdSet(ids: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of ids) {
    const id = safeBlankId(raw);
    set.add(id);
    // QRG and pending IDs are the new canonical format — no expansion needed
    if (id.startsWith('qrg_') || id.startsWith('pending_')) {
      continue;
    }
    if (id.startsWith('py_')) {
      set.add(id.slice(3));                   // py_123 → 123
    } else if (id.startsWith('pf_')) {
      set.add(`pf:${id.slice(3)}`);           // pf_123 → pf:123
      set.add(id.slice(3));                   // pf_123 → 123
    } else if (id.startsWith('pf:')) {
      set.add(`pf_${id.slice(3)}`);           // pf:123 → pf_123
    } else {
      // Plain numeric — add all prefixed variants for backward compat
      set.add(`py_${id}`);
      set.add(`pf_${id}`);
      set.add(`pf:${id}`);
    }
  }
  return set;
}

interface CatalogProduct {
  id: number;
  docId?: string;
  qrgBlankId?: number | null;
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
  availableColors?: Array<{ name: string; hex?: string }>;
  availableSizes?: string[];
  fulfillmentProvider?: string;
  availableVia?: string[];
  providers?: string[];
  printifyImages?: string[];
  printfulImages?: string[];
}

interface CatalogCategory {
  name: string;
  items: CatalogProduct[];
  count: number;
  printifyCount?: number;
  printfulCount?: number;
  bothCount?: number;
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
  blankMakers?: Record<string, string>;
  blankModels?: Record<string, string>;
  blankProviders?: Record<string, string[]>;
  blankImages?: Record<string, string[]>;
  blankPrimaryImages?: Record<string, string>;
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
  model: string | null;
  madeInUSA: boolean;
  primaryImageUrl: string | null;
  images?: string[];
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

function getProductKey(p: CatalogProduct): string {
  return p.docId || String(p.id);
}

function normalizeSourceBlank(p: CatalogProduct, pricing: PricingSettings, adminCatalogDesc?: string, adminCatalogTitle?: string): NormalizedSourceBlank {
  const cost = p.minPrice ? parseFloat(p.minPrice) : null;
  const retailPrice = cost !== null
    ? Math.ceil((cost * (1 + pricing.markupPercent / 100) + pricing.markupFixed) * 100) / 100
    : null;
  const imageUrl = p.imageUrl || p.image_url || p.thumbnailUrl || null;
  // Collect all available provider images into one deduplicated array
  const allImages = [...new Set([
    ...(p.printifyImages || []),
    ...(p.printfulImages || []),
  ])].filter(Boolean);
  const images = allImages.length > 0 ? allImages : (imageUrl ? [imageUrl] : []);
  // Prefer canonicalDescription, then description
  const providerDesc = p.canonicalDescription || p.description || null;
  const effectiveDesc = adminCatalogDesc || providerDesc;
  // Prefer canonicalTitle, then title
  const providerTitle = p.canonicalTitle || p.title || "";
  const normalizedAdminTitle = typeof adminCatalogTitle === "string" && adminCatalogTitle.trim().length > 0 ? adminCatalogTitle : null;
  const effectiveTitle = normalizedAdminTitle ?? providerTitle;
  return {
    id: getProductKey(p),
    name: effectiveTitle,
    providerTitle,
    adminCatalogTitle: normalizedAdminTitle,
    price: retailPrice,
    cost,
    manufacturer: p.brand || p.maker || null,
    model: p.model || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: imageUrl,
    images,
    description: effectiveDesc,
    providerDescription: providerDesc,
    adminCatalogDescription: adminCatalogDesc || null,
    providerDescriptionRaw: providerDesc,
    colorsAvailable: (p.availableColors || []).map(c => ({ name: c.name, hex: c.hex })),
    sizesAvailable: p.availableSizes || [],
    defaultColor: (p.availableColors || []).length > 0 ? p.availableColors![0].name : null,
  };
}

function buildBlankSnapshot(p: CatalogProduct): Record<string, { title: string | null; maker: string | null; model: string | null; providers: string[]; images: string[]; primaryImageUrl: string | null }> {
  const key = getProductKey(p);
  const imageUrl = p.imageUrl || p.image_url || p.thumbnailUrl || null;
  const allImages = [...new Set([...(p.printifyImages || []), ...(p.printfulImages || [])])].filter(Boolean);
  return {
    [key]: {
      title: p.canonicalTitle || p.title || null,
      maker: p.brand || p.maker || null,
      model: p.model || null,
      providers: p.availableVia || [],
      images: allImages.length > 0 ? allImages : (imageUrl ? [imageUrl] : []),
      primaryImageUrl: imageUrl,
    },
  };
}

/** Returns true if this product is available via the given provider */
function isAvailableVia(p: CatalogProduct, provider: ProviderFilter): boolean {
  // New: check availableVia array (QRG format)
  if (Array.isArray(p.availableVia) && p.availableVia.length > 0) {
    return p.availableVia.includes(provider);
  }
  // Legacy: check fulfillmentProvider field
  if (p.fulfillmentProvider === 'both') return true;
  if (p.fulfillmentProvider === provider) return true;
  return false;
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

  // Taxonomy: top-level parents + subcategory counts — read dynamically from live data
  const { data: taxonomyData = [] } = useQuery<{ parent: string; count: number; subcategories: { name: string; count: number }[] }[]>({
    queryKey: ["/api/master-catalog/taxonomy"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog/taxonomy");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 300000,
  });

  // Single source of truth: master_catalog collection via /api/master-catalog
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
  const catalogBlankSet = useMemo(() => expandBlankIdSet(activeCatalog?.blankIds || []), [activeCatalog]);
  const blankTiers = activeCatalog?.blankTiers || {};
  const blankDescriptions = activeCatalog?.blankDescriptions || {};
  const blankTitles = activeCatalog?.blankTitles || {};
  const blankMakers = activeCatalog?.blankMakers || {};
  const blankModels = activeCatalog?.blankModels || {};
  const blankImages = activeCatalog?.blankImages || {};
  const blankPrimaryImages = activeCatalog?.blankPrimaryImages || {};
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

  // ── Flat product lists filtered by provider ───────────────────────────────────
  // With QRG architecture, a single blank can be in BOTH providers.
  // Both product lists may contain the same blank (e.g., one bridged blank).
  const printifyProducts = useMemo(() => {
    const items: CatalogProduct[] = [];
    const seen = new Set<string>();
    for (const cat of masterCategories) {
      for (const item of (cat.items || [])) {
        if (isAvailableVia(item, 'printify')) {
          const key = getProductKey(item);
          if (!seen.has(key)) { seen.add(key); items.push(item); }
        }
      }
    }
    return items;
  }, [masterCategories]);

  const printfulProducts = useMemo(() => {
    const items: CatalogProduct[] = [];
    const seen = new Set<string>();
    for (const cat of masterCategories) {
      for (const item of (cat.items || [])) {
        if (isAvailableVia(item, 'printful')) {
          const key = getProductKey(item);
          if (!seen.has(key)) { seen.add(key); items.push(item); }
        }
      }
    }
    return items;
  }, [masterCategories]);

  // ── Per-provider category views (same data, filtered by provider) ──────────────
  const printifyCategories = useMemo(() => {
    return masterCategories
      .map(cat => ({
        name: cat.name,
        items: cat.items.filter(i => isAvailableVia(i, 'printify')),
        count: cat.items.filter(i => isAvailableVia(i, 'printify')).length,
      }))
      .filter(c => c.count > 0);
  }, [masterCategories]);

  const printfulCategories = useMemo(() => {
    return masterCategories
      .map(cat => ({
        name: cat.name,
        items: cat.items.filter(i => isAvailableVia(i, 'printful')),
        count: cat.items.filter(i => isAvailableVia(i, 'printful')).length,
      }))
      .filter(c => c.count > 0);
  }, [masterCategories]);

  const activeCategories = providerFilter === "printful" ? printfulCategories : printifyCategories;
  const allProducts = useMemo(() => {
    return providerFilter === "printful" ? printfulProducts : printifyProducts;
  }, [providerFilter, printifyProducts, printfulProducts]);

  // ── Product map — indexed by all known keys for backward compat ───────────────
  const allProductMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    const allItems = [...printifyProducts, ...printfulProducts];
    const seen = new Set<string>();

    for (const p of allItems) {
      const docId = p.docId;
      const numId = String(p.id);

      // Primary index: QRG docId (qrg_101, pending_py_123)
      if (docId && !seen.has(docId)) {
        map.set(docId, p);
        seen.add(docId);
      }

      // Numeric id (blueprint ID for Printify, product ID for Printful-only)
      if (numId && !map.has(numId)) map.set(numId, p);

      // Legacy keys for backward compat with catalog blankIds stored in old formats
      if (p.blueprintId) {
        map.set(String(p.blueprintId), p);
        map.set(`py_${p.blueprintId}`, p);
      }
      if (p.printfulId) {
        map.set(`pf:${p.printfulId}`, p);
        map.set(`pf_${p.printfulId}`, p);
        map.set(String(p.printfulId), p);
      }
    }
    return map;
  }, [printifyProducts, printfulProducts]);

  const categoryNames = useMemo(() => {
    return ["all", ...activeCategories.map(c => c.name)];
  }, [activeCategories]);

  // Auto-load default catalog as SOURCE on first load
  useEffect(() => {
    if (!defaultLoaded && defaultsData?.defaultCatalogId && catalogs.length > 0) {
      const exists = catalogs.find(c => c.id === defaultsData.defaultCatalogId);
      if (exists) setSourceCatalogId(defaultsData.defaultCatalogId);
      setDefaultLoaded(true);
    }
  }, [defaultsData, catalogs, defaultLoaded]);

  // Source catalog derivations
  const sourceCatalog = sourceCatalogId ? catalogs.find(c => c.id === sourceCatalogId) ?? null : null;
  const sourceBlankSet = useMemo(
    () => expandBlankIdSet(sourceCatalog?.blankIds || []),
    [sourceCatalog]
  );

  const addBlanksMutation = useMutation({
    mutationFn: async ({ catalogId, blankIds, blankSnapshots }: { catalogId: string; blankIds: string[]; blankSnapshots?: Record<string, any> }) => {
      const body: any = { blankIds };
      if (blankSnapshots) body.blankSnapshots = blankSnapshots;
      const res = await apiRequest("POST", `/api/admin/catalogs/${catalogId}/blanks`, body);
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] }); },
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
        const catKeys = new Set(cat.items.map(i => getProductKey(i)));
        items = items.filter(p => catKeys.has(getProductKey(p)));
      }
    }
    if (locationFilter === "usa") items = items.filter(p => p.madeInUSA);
    if (locationFilter === "other") items = items.filter(p => !p.madeInUSA);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(p =>
        (p.canonicalTitle || p.title || "").toLowerCase().includes(q) ||
        (p.brand || p.maker || "").toLowerCase().includes(q) ||
        (p.canonicalDescription || p.description || "").toLowerCase().includes(q)
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
        const catalogTitle = blankTitles[safe];
        const catalogMaker = blankMakers[safe];
        const catalogModel = blankModels[safe];
        const catalogImage = blankImages[safe]?.[0] || blankPrimaryImages[safe] || null;
        return {
          id: getProductKey(product),
          catalogKey: safe,
          title: catalogTitle || product.canonicalTitle || product.title,
          subtitle: [catalogMaker || product.brand || product.maker, catalogModel || product.model].filter(Boolean).join(' ') || null,
          imageUrl: catalogImage || product.imageUrl || product.image_url || product.thumbnailUrl || null,
          tier: (blankTiers[safe] as "good" | "better" | "best") || null,
          isPrintful: isProviderPrintful(safe),
          hasMockupMapping: false,
        };
      })
      .filter(Boolean) as CatalogBlankItem[];
  }, [catalogBlankSet, allProductMap, blankTiers, blankTitles, blankMakers, blankModels, blankImages, blankPrimaryImages]);

  const sourceItemMap = useMemo(() => {
    const map = new Map<string, NormalizedSourceBlank>();
    const catalogProducts = catalogItems.map(c => allProductMap.get(c.catalogKey)).filter(Boolean) as CatalogProduct[];
    filtered.forEach(p => {
      const key = getProductKey(p);
      const blankKey = getCanonicalBlankKey(p);
      const customDesc = blankDescriptions[blankKey];
      const customTitle = blankTitles[blankKey];
      map.set(key, normalizeSourceBlank(p, pricing, customDesc, customTitle));
    });
    catalogProducts.forEach(p => {
      const key = getProductKey(p);
      const blankKey = getCanonicalBlankKey(p);
      const customDesc = blankDescriptions[blankKey];
      const customTitle = blankTitles[blankKey];
      map.set(key, normalizeSourceBlank(p, pricing, customDesc, customTitle));
    });
    return map;
  }, [filtered, catalogItems, allProductMap, pricing, blankDescriptions, blankTitles]);

  // scrollItems — use docId as stable id so renderCatalogCard can look up the product
  const scrollItems = useMemo(() =>
    filtered.map(p => ({
      id: getProductKey(p),
      imageUrl: p.imageUrl || p.image_url || p.thumbnailUrl || "",
      title: p.canonicalTitle || p.title || "",
      subtitle: [p.brand || p.maker, p.model].filter(Boolean).join(' ') || undefined,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      colorCount: p.colorCount,
      madeInUSA: p.madeInUSA,
    })),
    [filtered]
  );

  const onAddToCatalog = useCallback((blankKey: string, product?: CatalogProduct) => {
    if (!validSelectedCatalogId) {
      toast({ title: "Select a catalog first", variant: "destructive" });
      return;
    }
    const resolvedProduct = product || allProductMap.get(blankKey);
    const blankSnapshots = resolvedProduct ? buildBlankSnapshot(resolvedProduct) : undefined;
    addBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [blankKey], blankSnapshots });
  }, [validSelectedCatalogId, addBlanksMutation, allProductMap, toast]);

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
      const resolvedProduct = product || allProductMap.get(key) || allProductMap.get(id);
      const blankSnapshots = resolvedProduct ? buildBlankSnapshot(resolvedProduct) : undefined;
      addBlanksMutation.mutate({ catalogId: validSelectedCatalogId, blankIds: [key], blankSnapshots });
    }
  }, [validSelectedCatalogId, catalogBlankSet, addBlanksMutation, removeBlanksMutation, allProductMap, toast, resolveBlankKey]);

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
    taxonomyData,

    catalogItems,
    sourceItemMap,
    scrollItems,
    blankTiers,
    blankTitles,
    blankMakers,
    blankModels,
    blankImages,
    blankPrimaryImages,

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

    // Expose full categories for advanced UI features
    masterCategories,
    activeCategories,
    printifyCategories,
    printfulCategories,
  };
}

export type { CatalogProduct, AdminCatalog, PricingSettings, CatalogCategory };
