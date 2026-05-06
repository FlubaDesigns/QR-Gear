import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Layers,
  Search,
  Filter,
  Flag,
  Globe,
  BookOpen,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollVerticalView } from "@/features/shared/components/views/ScrollVerticalView";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  ProductSelectCardSkin,
  type ProductSelectItem,
} from "@/features/shared/components/skins/ProductSelectCardSkin";
import { useBuilderContext } from "../BuilderContext";
import { useProductsContext } from "../../ProductsContext";
import type { CatalogProduct, GenderFilter, CatalogCategory } from "../types";
import type { ScrollViewItem } from "@/features/shared/components/views/index";
import { getLookupBlankKey } from "@shared/blankKeys";
import { BlankPickerModal } from "./BlankPickerModal";

interface AdminCatalog {
  id: string;
  name: string;
  blankIds: string[];
  blankDescriptions?: Record<string, string>;
  blankTitles?: Record<string, string>;
  blankImages?: Record<string, string[]>;
  blankTiers?: Record<string, string>;
}

type LocationFilter = "all" | "usa" | "other";
type DataMode = "all" | "catalog" | "joint";

function detectGender(title: string): "mens" | "womens" | "unisex" {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("unisex")) return "unisex";
  if (
    lowerTitle.includes("women's") ||
    lowerTitle.includes("womens") ||
    lowerTitle.includes("women ") ||
    lowerTitle.startsWith("women") ||
    lowerTitle.includes("female") ||
    lowerTitle.includes("ladies") ||
    lowerTitle.includes("lady") ||
    lowerTitle.includes("girl's") ||
    lowerTitle.includes("girls")
  ) {
    return "womens";
  }
  if (
    lowerTitle.includes("men's") ||
    lowerTitle.includes("mens") ||
    lowerTitle.includes("men ") ||
    lowerTitle.startsWith("men") ||
    lowerTitle.includes("male") ||
    lowerTitle.includes("guys") ||
    lowerTitle.includes("boy's") ||
    lowerTitle.includes("boys")
  ) {
    return "mens";
  }
  return "unisex";
}

function catalogToSelectItem(
  p: CatalogProduct,
  adminCatalogDescription?: string | null,
  adminCatalogTitle?: string | null,
  adminCatalogImages?: string[] | null,
): ProductSelectItem {
  const minPrice = p.minPrice ? parseFloat(p.minPrice) : null;
  const raw = p as any;
  const imageUrl = p.imageUrl || raw.image_url || raw.thumbnailUrl || raw.thumbnail || raw.image || null;
  // Combine per-provider image arrays — same logic as useAdminBlanksController normalizeSourceBlank
  const allProviderImages = Array.from(new Set([
    ...(p.printifyImages || raw.printifyImages || []),
    ...(p.printfulImages || raw.printfulImages || []),
  ])).filter(Boolean) as string[];
  const masterImages: string[] = allProviderImages.length > 0
    ? allProviderImages
    : (p.images?.length ? p.images : (imageUrl ? [imageUrl] : []));
  const effectiveImages = (adminCatalogImages && adminCatalogImages.length > 0) ? adminCatalogImages : masterImages;
  const providerDescription = p.description || null;
  const normalizedAdminDesc = typeof adminCatalogDescription === "string" && adminCatalogDescription.trim().length > 0
    ? adminCatalogDescription
    : null;
  const effectiveDescription = normalizedAdminDesc ?? providerDescription;
  const providerTitle = p.title || raw.name || "";
  const normalizedAdminTitle = typeof adminCatalogTitle === "string" && adminCatalogTitle.trim().length > 0
    ? adminCatalogTitle
    : null;
  const effectiveTitle = normalizedAdminTitle ?? providerTitle;
  return {
    id: (p as any).docId || String(p.id),
    name: effectiveTitle,
    providerTitle,
    adminCatalogTitle: normalizedAdminTitle,
    price: minPrice,
    cost: null,
    manufacturer: p.brand || raw.manufacturer || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: effectiveImages[0] ?? imageUrl,
    images: effectiveImages,
    description: effectiveDescription,
    providerDescription,
    adminCatalogDescription: normalizedAdminDesc,
    colorsAvailable: (p.availableColors || raw.colors || []).map((c: any) => ({ name: c.name, hex: c.hex })),
    sizesAvailable: p.availableSizes || raw.sizes || [],
    defaultColor: (p.availableColors || raw.colors || []).length > 0
      ? (p.availableColors || raw.colors)[0].name
      : null,
  };
}


interface CatalogCategoryResponse {
  name: string;
  items: CatalogProduct[];
  count: number;
}

export function ProductsModule() {
  const { state, setCategory, setOriginFilter, setGenderFilter, selectProduct, setProductDescription, setProductTitle, setActiveSession, setActivePacketId, setSelectedCatalogId, loadFromWorkingState } = useBuilderContext();
  const { selectedProviders, setSelectedProviders } = useProductsContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const provider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";
  const selectedCatalogId = state.selectedCatalogId;

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [dataMode, setDataMode] = useState<DataMode>(() => {
    const id = state.selectedCatalogId;
    if (!id || id === "all") return "all";
    if (id === "joint") return "joint";
    return "catalog";
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [openShelfIds, setOpenShelfIds] = useState<Set<string>>(new Set());
  const toggleShelf = useCallback((id: string) => {
    setOpenShelfIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const [addingShelf, setAddingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState("");
  const [savingShelf, setSavingShelf] = useState(false);

  useEffect(() => {
    if (!selectedCatalogId || selectedCatalogId === "all") {
      setDataMode("all");
    } else if (selectedCatalogId === "joint") {
      setDataMode("joint");
    } else {
      setDataMode("catalog");
    }
  }, [selectedCatalogId]);

  const { data: adminCatalogsData } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });
  const adminCatalogs = adminCatalogsData?.catalogs || [];

  const { data: shelfGroups = [] } = useQuery<Array<{ id: string; name: string; sortOrder: number }>>({
    queryKey: ["/api/admin/shelf-groups"],
  });

  // Derived early so it is available inside the buildShelfItems queryFn closure below.
  const activeCatalogEarly = selectedCatalogId && selectedCatalogId !== "all" && selectedCatalogId !== "joint"
    ? (adminCatalogsData?.catalogs || []).find(c => c.id === selectedCatalogId) || null
    : null;
  const catalogBlankIds = activeCatalogEarly?.blankIds || [];

  // build-shelf query — kept for shelfItemByCanonicalId (optional shelfItemId in build sessions).
  // Not used as the primary source for catalogModeProducts (see below).
  const { data: buildShelfItems = [] } = useQuery<Array<{ id: string; shelfKey: string; catalogId: string; groupIds: string[]; catalog: CatalogProduct }>>({
    queryKey: ["/api/admin/build-shelf", selectedCatalogId],
    queryFn: async () => {
      const url = selectedCatalogId && selectedCatalogId !== "all" && selectedCatalogId !== "joint"
        ? `/api/admin/build-shelf?catalogId=${encodeURIComponent(selectedCatalogId)}`
        : "/api/admin/build-shelf?mode=global";
      const r = await apiRequest("GET", url);
      if (!r.ok) throw new Error(`build-shelf fetch failed: ${r.status}`);
      const items: Array<{ id: string; shelfKey: string; catalogId: string; groupIds: string[]; catalog: CatalogProduct }> = await r.json();

      // If the shelf has no items yet (blanks were added via BlankPickerModal
      // which only writes catalogs.blankIds, not admin_build_shelf), fall back
      // to resolving those blankIds directly from master_catalog.
      if (items.length === 0 && catalogBlankIds.length > 0) {
        console.log(`[ProductsModule] build-shelf empty for catalog ${selectedCatalogId}, falling back to master catalog for ${catalogBlankIds.length} blankIds`);
        try {
          const masterRes = await apiRequest("GET", "/api/master-catalog");
          if (!masterRes.ok) return items;
          const masterData: Array<{ name: string; items: any[] }> = await masterRes.json();
          const blankIdSet = new Set(catalogBlankIds);
          const fallback: Array<{ id: string; shelfKey: string; catalogId: string; groupIds: string[]; catalog: CatalogProduct }> = [];
          const seen = new Set<string>();
          for (const cat of masterData) {
            for (const item of (cat.items || [])) {
              const docId: string | undefined = item.docId;
              if (docId && blankIdSet.has(docId) && !seen.has(docId)) {
                seen.add(docId);
                fallback.push({
                  id: `fallback:${docId}`,
                  shelfKey: docId,
                  catalogId: selectedCatalogId!,
                  groupIds: [],
                  catalog: item as CatalogProduct,
                });
              }
            }
          }
          console.log(`[ProductsModule] Fallback resolved ${fallback.length} items from master catalog`);
          return fallback;
        } catch (fallbackErr: any) {
          console.error("[ProductsModule] Master catalog fallback failed:", fallbackErr.message);
        }
      }

      return items;
    },
    enabled: dataMode === "catalog",
  });

  // Full master catalog data — used as the authoritative source for catalog-mode products.
  // Same approach as useAdminBlanksController (which works in production): read catalog.blankIds
  // then look up each blank in master_catalog. This avoids depending on admin_build_shelf
  // (which blanks added via BlankPickerModal never write to).
  const { data: masterCatalogFull = [], isLoading: loadingCatalogProducts } = useQuery<Array<{ name: string; items: CatalogProduct[]; count: number }>>({
    queryKey: ["/api/master-catalog"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: dataMode === "catalog",
    staleTime: 60000,
  });

  const activeCatalog = selectedCatalogId !== "all"
    ? adminCatalogs.find(c => c.id === selectedCatalogId) || null
    : null;

  const shelfKeyToGroupIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of buildShelfItems) {
      map.set(item.shelfKey, item.groupIds || []);
    }
    return map;
  }, [buildShelfItems]);

  // Fast lookup from any canonical product key → shelf item (used for shelfItemId in build sessions)
  const shelfItemByCanonicalId = useMemo(() => {
    const map = new Map<string, { id: string; shelfKey: string; catalogId: string }>();
    for (const item of buildShelfItems) {
      const catDocId = (item.catalog as any).docId as string | undefined;
      if (catDocId) map.set(catDocId, item);
      map.set(item.shelfKey, item);
      const numId = String((item.catalog as any).id || "");
      if (numId) map.set(numId, item);
    }
    return map;
  }, [buildShelfItems]);

  // O(1) membership check — used in selectItemMap to resolve the canonical blankKey
  // without going through catalogKeyMap (which is keyed by numeric provider ID and
  // loses precision when two qrg_STNNN entries share the same blueprint number).
  const activeCatalogBlankIdSet = useMemo(
    () => new Set<string>(activeCatalog?.blankIds || []),
    [activeCatalog],
  );


  const handleCatalogChange = useCallback((catalogId: string) => {
    setSelectedCatalogId(catalogId);
    if (catalogId === "all") {
      setDataMode("all");
    } else if (catalogId === "joint") {
      setDataMode("joint");
      selectProduct(null);
    } else {
      setDataMode("catalog");
      selectProduct(null);
    }
  }, [selectProduct]);

  // catalogModeProducts — derived from master_catalog filtered by catalog.blankIds.
  // Mirrors the approach used by useAdminBlanksController (the working "add blanks" path):
  // catalog.blankIds are qrg_STNNN keys; master_catalog items carry docId + qrgCategory.
  // This bypasses admin_build_shelf entirely, which blanks added via BlankPickerModal
  // never write to (they only write to catalogs.blankIds).
  const { catalogModeProducts, catalogKeyMap } = useMemo(() => {
    if (!activeCatalog || masterCatalogFull.length === 0) {
      return { catalogModeProducts: [] as CatalogProduct[], catalogKeyMap: new Map<string, string>() };
    }
    const blankIdSet = new Set<string>(activeCatalog.blankIds || []);
    const products: CatalogProduct[] = [];
    const keyMap = new Map<string, string>();
    const seen = new Set<string>();
    for (const cat of masterCatalogFull) {
      for (const item of (cat.items || [])) {
        const docId = (item as any).docId as string | undefined;
        const numId = String((item as any).id || "");
        const canonicalId = docId || numId;
        if (seen.has(canonicalId)) continue;
        if ((docId && blankIdSet.has(docId)) || blankIdSet.has(numId)) {
          seen.add(canonicalId);
          const withCategory = { ...item, qrgCategory: (item as any).qrgCategory || cat.name || null } as CatalogProduct;
          products.push(withCategory);
          if (numId) keyMap.set(numId, docId || numId);
          if (docId) keyMap.set(docId, docId);
        }
      }
    }
    return { catalogModeProducts: products, catalogKeyMap: keyMap };
  }, [activeCatalog, masterCatalogFull]);

  useEffect(() => {
    if (dataMode !== "catalog" || catalogModeProducts.length === 0) return;
    const categoryKeys = Array.from(
      new Set(catalogModeProducts.map((p: any) => p.qrgCategory || "Other"))
    );
    setOpenShelfIds(new Set(categoryKeys.map(key => `qrg-shelf-${key}`)));
  }, [dataMode, selectedCatalogId, catalogModeProducts]);

  const { data: jointCatalogProducts = [], isLoading: loadingJointProducts } = useQuery<CatalogProduct[]>({
    queryKey: ["joint-catalog-products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog/joint");
      const data = (await res.json()) as CatalogCategoryResponse[];
      const items: CatalogProduct[] = [];
      const seen = new Set<string>();
      for (const cat of data) {
        for (const item of (cat.items || [])) {
          const key = getLookupBlankKey(item);
          if (!seen.has(key)) {
            seen.add(key);
            items.push({ ...item, qrgCategory: item.qrgCategory ?? cat.name ?? null });
          }
        }
      }
      return items;
    },
    enabled: dataMode === "joint",
    staleTime: 60000,
  });

  const applyLocationFilter = useCallback((loc: LocationFilter) => {
    setLocationFilter(loc);
    if (loc === "all") setOriginFilter({ showUSA: true, showOther: true });
    else if (loc === "usa") setOriginFilter({ showUSA: true, showOther: false });
    else setOriginFilter({ showUSA: false, showOther: true });
  }, [setOriginFilter]);

  const prevProviderRef = useRef(provider);
  const internalProviderSwitch = useRef(false);
  useEffect(() => {
    if (prevProviderRef.current !== provider) {
      if (internalProviderSwitch.current) {
        internalProviderSwitch.current = false;
      } else {
        setCategory(null);
        selectProduct(null);
      }
      prevProviderRef.current = provider;
    }
  }, [provider, setCategory, selectProduct]);

  const { data: categories = [], isLoading: loadingCategories } = useQuery<CatalogCategory[]>({
    queryKey: ["catalog-categories", "master"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog");
      const data = await res.json();
      return (data as Array<{ name: string; items: any[]; count: number }>).map((cat) => ({
        name: cat.name,
        itemCount: cat.count || cat.items?.length || 0,
      }));
    },
  });

  const sortedCategories = useMemo(() => {
    if (dataMode === "catalog" && activeCatalog) {
      const counts = new Map<string, number>();
      for (const p of catalogModeProducts) {
        const catName = p.qrgCategory || null;
        if (catName) counts.set(catName, (counts.get(catName) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([name, itemCount]) => ({ name, itemCount }))
        .filter(c => c.itemCount > 0 && c.name && c.name.trim() !== "")
        .sort((a, b) => {
          if (a.name === "T-Shirts & Tops") return -1;
          if (b.name === "T-Shirts & Tops") return 1;
          return a.name.localeCompare(b.name);
        });
    }
    if (dataMode === "joint") {
      const counts = new Map<string, number>();
      for (const p of jointCatalogProducts) {
        const catName = p.qrgCategory || null;
        if (catName) counts.set(catName, (counts.get(catName) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([name, itemCount]) => ({ name, itemCount }))
        .filter(c => c.itemCount > 0 && c.name && c.name.trim() !== "")
        .sort((a, b) => {
          if (a.name === "T-Shirts & Tops") return -1;
          if (b.name === "T-Shirts & Tops") return 1;
          return a.name.localeCompare(b.name);
        });
    }
    return [...categories]
      .filter(c => c.itemCount > 0 && c.name && c.name.trim() !== "")
      .sort((a, b) => {
        if (a.name === "T-Shirts & Tops") return -1;
        if (b.name === "T-Shirts & Tops") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [categories, dataMode, activeCatalog, catalogModeProducts, jointCatalogProducts]);

  const categoryOptions = sortedCategories.map(cat => ({
    value: cat.name,
    label: `${cat.name} (${cat.itemCount})`,
    icon: <Layers className="h-4 w-4 flex-shrink-0" />,
  }));

  const { data: categoryData, isLoading, error } = useQuery<CatalogCategoryResponse | null>({
    queryKey: ["catalog-products", "master", state.category],
    queryFn: async () => {
      if (!state.category) return null;
      try {
        const res = await apiRequest("GET", "/api/master-catalog");
        if (!res.ok) return null;
        const data = (await res.json()) as CatalogCategoryResponse[];
        return data.find((cat) => cat.name === state.category) || null;
      } catch (e) {
        console.error("[ProductsModule] Catalog load failed:", e);
        return null;
      }
    },
    enabled: !!state.category,
  });

  const products = categoryData?.items || [];

  const productsWithGender = useMemo(() =>
    products.map(p => ({ ...p, gender: detectGender(p.title) })),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return productsWithGender.filter(p => {
      const passesOrigin = (state.originFilter.showUSA && p.madeInUSA) ||
                           (state.originFilter.showOther && !p.madeInUSA);
      const passesGender = state.genderFilter === "all" || p.gender === state.genderFilter;
      const passesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
      return passesOrigin && passesGender && passesSearch;
    });
  }, [productsWithGender, state.originFilter, state.genderFilter, search]);

  const usaCount = products.filter(p => p.madeInUSA).length;
  const otherCount = products.filter(p => !p.madeInUSA).length;

  const originFilteredProducts = useMemo(() => {
    return productsWithGender.filter(p =>
      (state.originFilter.showUSA && p.madeInUSA) ||
      (state.originFilter.showOther && !p.madeInUSA)
    );
  }, [productsWithGender, state.originFilter]);

  const genderCounts = useMemo(() => ({
    all: originFilteredProducts.length,
    mens: originFilteredProducts.filter(p => p.gender === "mens").length,
    womens: originFilteredProducts.filter(p => p.gender === "womens").length,
    unisex: originFilteredProducts.filter(p => p.gender === "unisex").length,
  }), [originFilteredProducts]);

  const selectedProductId = state.selectedProduct ? String(state.selectedProduct.id) : null;
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeProducts = dataMode === "catalog" ? catalogModeProducts : dataMode === "joint" ? jointCatalogProducts : filteredProducts;

  const selectItemMap = useMemo(() => {
    const map = new Map<string, { selectItem: ProductSelectItem; catalog: CatalogProduct & { gender: string }; blankKey: string }>();
    const seen = new Set<string>();
    activeProducts.forEach(p => {
      // Canonical identity: qrg_STNNN docId takes priority over numeric provider id
      const canonicalId = (p as any).docId || String(p.id);
      // Skip duplicates — enforce one card per canonical ID
      if (seen.has(canonicalId)) return;
      seen.add(canonicalId);
      const withGender = { ...p, gender: detectGender(p.title) };
      // Canonical blank key resolution — priority order:
      //   1. p.docId (qrg_STNNN) when it is directly present in the catalog's blankIds.
      //      This is the only correct path for QRG-classified blanks: two distinct qrg_STNNN
      //      entries that share a provider blueprint numeric ID must each resolve to their own
      //      docId, not whatever the catalogKeyMap last wrote for that shared numeric ID.
      //   2. catalogKeyMap lookup by numeric provider ID — legacy/unclassified blanks only.
      //   3. Fallback to docId or provider-shaped key.
      const docId = (p as any).docId as string | undefined;
      const blankKey = (docId && activeCatalogBlankIdSet.has(docId))
        ? docId
        : (catalogKeyMap.get(String(p.id))
            ?? docId
            ?? (p.fulfillmentProvider === "printful" ? `pf:${p.id}` : String(p.id)));
      // Load catalog-level admin overrides so cards always show the admin's version
      const adminDesc = activeCatalog?.blankDescriptions?.[blankKey] ?? null;
      const adminTitle = activeCatalog?.blankTitles?.[blankKey] ?? null;
      const adminImages = activeCatalog?.blankImages?.[blankKey] ?? null;
      map.set(canonicalId, { selectItem: catalogToSelectItem(p, adminDesc, adminTitle, adminImages), catalog: withGender, blankKey });
    });
    return map;
  }, [activeProducts, activeCatalog, catalogKeyMap, activeCatalogBlankIdSet]);

  const handleDescriptionSave = useCallback(async (id: string, description: string) => {
    const entry = selectItemMap.get(id);
    if (!entry) return;
    if (!state.selectedProduct || String(state.selectedProduct.id) !== id) {
      const curatedProduct = {
        ...entry.catalog,
        title: entry.selectItem.name || entry.catalog.title,
        description: entry.selectItem.description ?? entry.catalog.description,
        images: entry.selectItem.images?.length ? entry.selectItem.images : ((entry.catalog as any).images || []),
        imageUrl: entry.selectItem.primaryImageUrl || (entry.catalog as any).imageUrl,
      } as typeof entry.catalog;
      selectProduct(curatedProduct);
    }
    // source='manual' — admin explicitly typed/confirmed this value in the builder
    setProductDescription(description || null, 'manual');

    if (activeCatalog) {
      try {
        await apiRequest("PUT", `/api/admin/catalogs/${activeCatalog.id}/blank-description`, { blankId: entry.blankKey, description: description || "" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
        toast({ title: "Description saved to catalog" });
      } catch {
        toast({ title: "Description set for this session only", description: "Could not save to catalog", variant: "destructive" });
      }
    } else {
      toast({ title: "Description set for this session" });
    }
  }, [selectItemMap, state.selectedProduct, selectProduct, setProductDescription, activeCatalog, queryClient, toast]);

  const handleTitleSave = useCallback(async (id: string, title: string) => {
    const entry = selectItemMap.get(id);
    if (!entry) return;
    if (!state.selectedProduct || String(state.selectedProduct.id) !== id) {
      const curatedProduct = {
        ...entry.catalog,
        title: entry.selectItem.name || entry.catalog.title,
        description: entry.selectItem.description ?? entry.catalog.description,
        images: entry.selectItem.images?.length ? entry.selectItem.images : ((entry.catalog as any).images || []),
        imageUrl: entry.selectItem.primaryImageUrl || (entry.catalog as any).imageUrl,
      } as typeof entry.catalog;
      selectProduct(curatedProduct);
    }
    // source='manual' — admin explicitly typed/confirmed this value in the builder
    setProductTitle(title || null, 'manual');

    if (activeCatalog) {
      try {
        await apiRequest("PUT", `/api/admin/catalogs/${activeCatalog.id}/blank-title`, { blankId: entry.blankKey, title: title || "" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
        toast({ title: "Title saved to catalog" });
      } catch {
        toast({ title: "Title set for this session only", description: "Could not save to catalog", variant: "destructive" });
      }
    } else {
      toast({ title: "Title set for this session" });
    }
  }, [selectItemMap, state.selectedProduct, selectProduct, setProductTitle, activeCatalog, queryClient, toast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!activeCatalog) return;
    const entry = selectItemMap.get(id);
    if (!entry) return;
    setDeletingId(id);

    // Optimistic update — immediately remove from local cache so UI responds instantly
    const catalogId = activeCatalog.id;
    const removedKey = entry.blankKey;
    queryClient.setQueryData(["/api/admin/catalogs"], (old: any) => {
      if (!old?.catalogs) return old;
      return {
        ...old,
        catalogs: old.catalogs.map((cat: any) => {
          if (cat.id !== catalogId) return cat;
          return { ...cat, blankIds: (cat.blankIds || []).filter((k: string) => k !== removedKey) };
        }),
      };
    });

    try {
      const res = await apiRequest("DELETE", `/api/admin/catalogs/${catalogId}/blanks`, { blankIds: [removedKey] });
      const data = await res.json().catch(() => null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      if (data?.removed === 0) {
        toast({ title: "Nothing removed", description: `Key "${removedKey}" did not match any entry in this catalog`, variant: "destructive" });
      } else {
        toast({ title: "Removed from catalog" });
      }
    } catch (err: any) {
      // Roll back optimistic update on failure
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: "Could not remove item", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }, [activeCatalog, selectItemMap, queryClient, toast]);

  const handleImageDelete = useCallback(async (id: string, imageUrl: string) => {
    if (!activeCatalog) return;
    const entry = selectItemMap.get(id);
    if (!entry) return;
    const blankKey = entry.blankKey;
    const currentImages = entry.selectItem.images || [];
    const newImages = currentImages.filter(img => img !== imageUrl);
    // Optimistic update
    queryClient.setQueryData(["/api/admin/catalogs"], (old: any) => {
      if (!old?.catalogs) return old;
      return {
        ...old,
        catalogs: old.catalogs.map((cat: any) => {
          if (cat.id !== activeCatalog.id) return cat;
          return { ...cat, blankImages: { ...(cat.blankImages || {}), [blankKey]: newImages } };
        }),
      };
    });
    try {
      await apiRequest("PUT", `/api/admin/catalogs/${activeCatalog.id}/blank-images`, { blankId: blankKey, images: newImages });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: `Image removed — ${newImages.length} remaining for members` });
    } catch (err: any) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: "Could not save image change", description: err?.message || "Unknown error", variant: "destructive" });
    }
  }, [activeCatalog, selectItemMap, queryClient, toast]);

  const handleImagesBulkSave = useCallback(async (id: string, images: string[]) => {
    if (!activeCatalog) return;
    const entry = selectItemMap.get(id);
    if (!entry) return;
    const blankKey = entry.blankKey;
    queryClient.setQueryData(["/api/admin/catalogs"], (old: any) => {
      if (!old?.catalogs) return old;
      return {
        ...old,
        catalogs: old.catalogs.map((cat: any) => {
          if (cat.id !== activeCatalog.id) return cat;
          return { ...cat, blankImages: { ...(cat.blankImages || {}), [blankKey]: images } };
        }),
      };
    });
    try {
      await apiRequest("PUT", `/api/admin/catalogs/${activeCatalog.id}/blank-images`, { blankId: blankKey, images });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: `Images updated — ${images.length} forwarded to members` });
    } catch (err: any) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: "Could not save images", description: err?.message || "Unknown error", variant: "destructive" });
    }
  }, [activeCatalog, selectItemMap, queryClient, toast]);

  const handleTierChange = useCallback(async (id: string, tier: string | null) => {
    if (!activeCatalog) return;
    const entry = selectItemMap.get(id);
    if (!entry) return;
    const blankKey = entry.blankKey;
    queryClient.setQueryData(["/api/admin/catalogs"], (old: any) => {
      if (!old?.catalogs) return old;
      return {
        ...old,
        catalogs: old.catalogs.map((cat: any) => {
          if (cat.id !== activeCatalog.id) return cat;
          const blankTiers = { ...(cat.blankTiers || {}) };
          if (tier) blankTiers[blankKey] = tier;
          else delete blankTiers[blankKey];
          return { ...cat, blankTiers };
        }),
      };
    });
    try {
      await apiRequest("PUT", `/api/admin/catalogs/${activeCatalog.id}/blank-tier`, { blankId: blankKey, tier: tier || null });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
    } catch (err: any) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: "Could not save tier", description: err?.message || "Unknown error", variant: "destructive" });
    }
  }, [activeCatalog, selectItemMap, queryClient, toast]);

  const handleAddShelf = useCallback(async () => {
    const name = newShelfName.trim();
    if (!name) return;
    setSavingShelf(true);
    try {
      const maxOrder = shelfGroups.reduce((m, g) => Math.max(m, g.sortOrder ?? 0), 0);
      await apiRequest("POST", "/api/admin/shelf-groups", { name, sortOrder: maxOrder + 1 });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shelf-groups"] });
      toast({ title: `"${name}" shelf added` });
      setNewShelfName("");
      setAddingShelf(false);
    } catch (err: any) {
      toast({ title: "Could not add shelf", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSavingShelf(false);
    }
  }, [newShelfName, shelfGroups, queryClient, toast]);

  const handleImageRestore = useCallback(async (id: string) => {
    if (!activeCatalog) return;
    const entry = selectItemMap.get(id);
    if (!entry) return;
    const blankKey = entry.blankKey;
    queryClient.setQueryData(["/api/admin/catalogs"], (old: any) => {
      if (!old?.catalogs) return old;
      return {
        ...old,
        catalogs: old.catalogs.map((cat: any) => {
          if (cat.id !== activeCatalog.id) return cat;
          const blankImages = { ...(cat.blankImages || {}) };
          delete blankImages[blankKey];
          return { ...cat, blankImages };
        }),
      };
    });
    try {
      await apiRequest("PUT", `/api/admin/catalogs/${activeCatalog.id}/blank-images`, { blankId: blankKey, images: [] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: "Images restored from master catalog" });
    } catch (err: any) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: "Could not restore images", description: err?.message || "Unknown error", variant: "destructive" });
    }
  }, [activeCatalog, selectItemMap, queryClient, toast]);

  const scrollItems: ScrollViewItem[] = useMemo(() =>
    activeProducts.map(p => ({
      id: (p as any).docId || String(p.id),
      imageUrl: p.imageUrl || "",
      title: p.title,
      subtitle: p.brand,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      colorCount: p.colorCount,
      madeInUSA: p.madeInUSA,
      hasMockupMapping: p.hasMockupMapping,
    })),
    [activeProducts]
  );

  const handleCardSelect = useCallback((id: string, _item: ProductSelectItem) => {
    const entry = selectItemMap.get(id);
    if (!entry) return;

    const catalogProduct = entry.catalog as any;
    if (catalogProduct.fulfillmentProvider && catalogProduct.fulfillmentProvider !== provider) {
      internalProviderSwitch.current = true;
      setSelectedProviders([catalogProduct.fulfillmentProvider]);
    }

    // Build curated product — prefer admin-overridden title/description/images over master
    const curatedProduct = {
      ...entry.catalog,
      title: entry.selectItem.name || entry.catalog.title,
      description: entry.selectItem.description ?? entry.catalog.description,
      images: entry.selectItem.images?.length ? entry.selectItem.images : (catalogProduct.images || []),
      imageUrl: entry.selectItem.primaryImageUrl || catalogProduct.imageUrl,
    } as typeof entry.catalog;
    selectProduct(curatedProduct);

    // Card selection is the explicit copy-forward action per Progressive Truth.
    // If the catalog has an override for this blank, upgrade the packet-owned fields
    // from 'provider' seed (set in selectProduct) to 'catalog' level. Either way the
    // packet owns its copy from this point — upstream changes after selection do not
    // affect it unless the admin explicitly edits the field.
    const adminDesc = activeCatalog?.blankDescriptions?.[entry.blankKey] ?? null;
    const adminTitle = activeCatalog?.blankTitles?.[entry.blankKey] ?? null;
    if (adminDesc) setProductDescription(adminDesc, 'catalog');
    if (adminTitle) setProductTitle(adminTitle, 'catalog');

    // Clear any previous session then start/resume a build session for this master product
    setActiveSession(null, null, null);
    // Use the Firestore document ID (docId), not the blueprint number (id)
    const sourceMasterId = entry.catalog.docId ?? String(entry.catalog.id);
    // P6: resolve shelf item to pass its Firestore ID for catalog-scope validation on the backend
    const shelfItem = shelfItemByCanonicalId.get(id) ?? shelfItemByCanonicalId.get(entry.blankKey) ?? null;
    apiRequest("POST", "/api/admin/build-sessions/from-master", {
      sourceMasterId,
      catalogId: activeCatalog?.id || null,
      blankKey: entry.blankKey || null,
      shelfItemId: shelfItem?.id || null,
    })
      .then(r => r.json())
      .then(data => {
        if (!data.sessionId) {
          console.error("[ProductsModule] from-master returned no sessionId:", data);
          selectProduct(null);
          toast({ title: "Could not start build session", description: data.error || "Please try selecting the product again.", variant: "destructive" });
          return;
        }
        const status = (data.session?.status || 'working') as 'working' | 'artifact_ready' | 'committed';
        setActiveSession(data.sessionId, status, data.session?.committedInstanceId || null);

        // Restore the packet ID so CreateGraphicsModule can re-display the packet result
        const existingPacketId: string | null = data.session?.generated?.packetId || null;
        if (existingPacketId) {
          setActivePacketId(existingPacketId);
          console.log(`[ProductsModule] Restored activePacketId: ${existingPacketId}`);
        }

        if (data.isExisting && data.session?.working && Object.keys(data.session.working).length > 0) {
          loadFromWorkingState(data.session.working, curatedProduct);
          const draftName = data.session.draftName || curatedProduct.title || "your draft";
          toast({ title: "Draft resumed", description: `Picked up where you left off on "${draftName}".` });
          console.log(`[ProductsModule] Working state restored for session ${data.sessionId}`);
        } else {
          console.log(`[ProductsModule] Build session ${data.isExisting ? 'resumed (no working state)' : 'started'}: ${data.sessionId} (${status})`);
        }
      })
      .catch(err => {
        console.error("[ProductsModule] Failed to start build session:", err.message || err);
        selectProduct(null);
        toast({ title: "Could not start build session", description: "Please try selecting the product again.", variant: "destructive" });
      });
  }, [selectItemMap, selectProduct, provider, setSelectedProviders, activeCatalog, setProductDescription, setProductTitle, setActiveSession, setActivePacketId, loadFromWorkingState, toast, shelfItemByCanonicalId]);

  const renderProductCard = useCallback(
    (scrollItem: ScrollViewItem) => {
      const entry = selectItemMap.get(String(scrollItem.id));
      if (!entry) return null;
      const cardId = String(scrollItem.id);
      const rawProduct = entry.catalog as any;
      const rawImages: string[] = rawProduct.images?.length
        ? rawProduct.images
        : rawProduct.imageUrl ? [rawProduct.imageUrl] : [];
      const blankKey = entry.blankKey;
      const itemTier = (activeCatalog?.blankTiers?.[blankKey] ?? null) as "good" | "better" | "best" | null;
      return (
        <ProductSelectCardSkin
          item={entry.selectItem}
          isSelected={selectedProductId === cardId}
          onSelect={handleCardSelect}
          editableDescription={true}
          onDescriptionSave={handleDescriptionSave}
          editableTitle={true}
          onTitleSave={handleTitleSave}
          onDelete={activeCatalog ? handleDelete : undefined}
          deleting={deletingId === cardId}
          onImageDelete={activeCatalog ? handleImageDelete : undefined}
          onImageRestore={activeCatalog ? handleImageRestore : undefined}
          onImagesBulkSave={activeCatalog ? handleImagesBulkSave : undefined}
          masterCatalogImages={rawImages}
          fulfillmentProvider={rawProduct.fulfillmentProvider as string | undefined}
          tier={itemTier}
          onTierChange={activeCatalog ? handleTierChange : undefined}
          showTierControls={!!activeCatalog}
          mockupImageUrl={selectedProductId === cardId ? (state.loadedGraphic?.compositeUrl ?? null) : null}
        />
      );
    },
    [selectItemMap, selectedProductId, handleCardSelect, handleDescriptionSave, handleTitleSave, activeCatalog, handleDelete, deletingId, handleImageDelete, handleImageRestore, handleTierChange, state.loadedGraphic, handleImagesBulkSave]
  );

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md" data-testid="active-provider-indicator">
        <span className="text-xs text-muted-foreground">Browsing:</span>
        <span className="text-sm font-medium capitalize">{provider}</span>
      </div>

      <div data-testid="module-catalog-select">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Product Source</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            data-testid="button-open-blank-picker"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Blank
          </Button>
        </div>
        <select
          value={selectedCatalogId}
          onChange={e => handleCatalogChange(e.target.value)}
          className="w-full text-sm bg-background border rounded-md px-3 py-2"
          data-testid="select-catalog"
        >
          <option value="all">All Products (by category)</option>
          <option value="joint">⭐ Joint Catalog (master + admin descriptions)</option>
          {adminCatalogs.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name} ({cat.blankIds?.length || 0} blanks)</option>
          ))}
        </select>
      </div>

      {dataMode === "catalog" && activeCatalog && (
        <>
          {loadingCatalogProducts ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
              ))}
            </div>
          ) : catalogModeProducts.length === 0 ? (
            <div className="p-6 text-center space-y-2 border rounded-md bg-muted/20">
              <p className="text-sm text-muted-foreground">
                No products found in this catalog.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(() => {
                // Auto-group by qrgCategory derived from the QRG STNNN schema.
                // Use the master catalog category order for consistent sort order.
                const categoryOrder = sortedCategories.map(c => c.name);
                const sectionMap = new Map<string, CatalogProduct[]>();
                for (const p of catalogModeProducts) {
                  const cat = (p as any).qrgCategory || "Other";
                  if (!sectionMap.has(cat)) sectionMap.set(cat, []);
                  sectionMap.get(cat)!.push(p);
                }
                // Sort sections: known categories in API order first, then "Other" last
                const sectionKeys = Array.from(sectionMap.keys()).sort((a, b) => {
                  if (a === "Other") return 1;
                  if (b === "Other") return -1;
                  const ai = categoryOrder.indexOf(a);
                  const bi = categoryOrder.indexOf(b);
                  if (ai === -1 && bi === -1) return a.localeCompare(b);
                  if (ai === -1) return 1;
                  if (bi === -1) return -1;
                  return ai - bi;
                });

                const sections: JSX.Element[] = [];
                for (const shelfKey of sectionKeys) {
                  const groupProducts = sectionMap.get(shelfKey)!;
                  const shelfId = `qrg-shelf-${shelfKey}`;
                  const isOpen = openShelfIds.has(shelfId);
                  const groupScrollItems = groupProducts.map(p => ({
                    id: (p as any).docId || String(p.id),
                    imageUrl: p.imageUrl || "",
                    title: p.title,
                    subtitle: p.brand,
                    minPrice: p.minPrice,
                    maxPrice: p.maxPrice,
                    colorCount: p.colorCount,
                    madeInUSA: p.madeInUSA,
                    hasMockupMapping: p.hasMockupMapping,
                  }));
                  sections.push(
                    <div key={shelfId} className="border rounded-md overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/30 hover-elevate"
                        onClick={() => toggleShelf(shelfId)}
                        data-testid={`shelf-group-${shelfId}`}
                      >
                        <span>
                          {shelfKey}{" "}
                          <span className="text-muted-foreground font-normal">({groupProducts.length})</span>
                        </span>
                        {isOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />}
                      </button>
                      {isOpen && (
                        <ScrollVerticalView
                          items={groupScrollItems}
                          renderItem={(item) => renderProductCard(item as ScrollViewItem)}
                          height={isMobile ? undefined : "calc(100vh - 280px)"}
                          emptyMessage=""
                        />
                      )}
                    </div>
                  );
                }

                return sections.length > 0 ? sections : (
                  <ScrollVerticalView
                    items={scrollItems}
                    renderItem={(item) => renderProductCard(item as ScrollViewItem)}
                    height={isMobile ? undefined : "calc(100vh - 160px)"}
                    emptyMessage="No products in this catalog."
                    footer={
                      <p className="text-sm text-muted-foreground text-center mt-3 font-medium">
                        {scrollItems.length} products available
                      </p>
                    }
                  />
                );
              })()}

              {addingShelf ? (
                <div className="flex items-center gap-2 pt-1" data-testid="add-shelf-form">
                  <Input
                    autoFocus
                    placeholder="Shelf name…"
                    value={newShelfName}
                    onChange={e => setNewShelfName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        await handleAddShelf();
                      } else if (e.key === "Escape") {
                        setAddingShelf(false);
                        setNewShelfName("");
                      }
                    }}
                    className="flex-1"
                    data-testid="input-new-shelf-name"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddShelf}
                    disabled={savingShelf || !newShelfName.trim()}
                    data-testid="button-save-shelf"
                  >
                    {savingShelf ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setAddingShelf(false); setNewShelfName(""); }}
                    data-testid="button-cancel-shelf"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setAddingShelf(true)}
                  data-testid="button-add-shelf"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Shelf
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {dataMode === "joint" && (
        <>
          <div className="flex items-center gap-2 py-1">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Joint Catalog — {loadingJointProducts ? "loading…" : `${jointCatalogProducts.length} products with verified descriptions`}
            </span>
          </div>
          {loadingJointProducts ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
              ))}
            </div>
          ) : jointCatalogProducts.length === 0 ? (
            <div className="p-6 text-center space-y-2 border rounded-md bg-muted/20">
              <p className="text-sm text-muted-foreground">
                No products have both a master description and an admin description yet. Add admin descriptions to products in a catalog first.
              </p>
            </div>
          ) : (
            <ScrollVerticalView
              items={scrollItems}
              renderItem={(item) => renderProductCard(item as ScrollViewItem)}
              height={isMobile ? undefined : "calc(100vh - 160px)"}
              emptyMessage="No products in joint catalog."
              footer={
                <p className="text-sm text-muted-foreground text-center mt-3 font-medium">
                  {scrollItems.length} verified products
                </p>
              }
            />
          )}
        </>
      )}

      {dataMode === "all" && (
        <>
          <div data-testid="module-category">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Product Category</p>
            </div>
            <CustomDropdown
              value={state.category || ""}
              onChange={(value) => setCategory(value)}
              options={categoryOptions}
              placeholder="Select a category..."
              loading={loadingCategories}
              data-testid="select-category"
            />
          </div>

          {state.category && (
            <>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-search"
                />
              </div>

              <div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMoreFiltersOpen(o => !o)}
                  data-testid="button-toggle-more-filters"
                >
                  <Filter className="h-3 w-3" />
                  {moreFiltersOpen ? "Hide filters" : "More filters"}
                  {(locationFilter !== "all" || state.genderFilter !== "all") && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {(locationFilter !== "all" ? 1 : 0) + (state.genderFilter !== "all" ? 1 : 0)}
                    </span>
                  )}
                  {moreFiltersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {moreFiltersOpen && (
                  <div className="mt-2 space-y-2 pl-1" data-testid="more-filters-panel">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">Location</span>
                      <Badge
                        variant={locationFilter === "all" ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => applyLocationFilter("all")}
                        data-testid="filter-location-all"
                      >
                        <Globe className="w-3 h-3 mr-1" /> All ({products.length})
                      </Badge>
                      <Badge
                        variant={locationFilter === "usa" ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => applyLocationFilter("usa")}
                        data-testid="filter-location-usa"
                      >
                        <Flag className="w-3 h-3 mr-1" /> USA ({usaCount})
                      </Badge>
                      <Badge
                        variant={locationFilter === "other" ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => applyLocationFilter("other")}
                        data-testid="filter-location-other"
                      >
                        Other ({otherCount})
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground w-14">Gender</span>
                      {(["all", "mens", "womens", "unisex"] as const).map((g) => (
                        <Badge
                          key={g}
                          variant={state.genderFilter === g ? "default" : "outline"}
                          className="cursor-pointer text-xs capitalize"
                          onClick={() => setGenderFilter(g)}
                          data-testid={`filter-gender-${g}`}
                        >
                          {g === "all" ? "All" : g === "mens" ? "Men" : g === "womens" ? "Women" : "Unisex"} ({genderCounts[g]})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error ? (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md space-y-2">
                  <p className="text-sm text-destructive">
                    {error instanceof Error ? error.message : "Failed to load products"}
                  </p>
                </div>
              ) : isLoading ? (
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
                  ))}
                </div>
              ) : (
                <ScrollVerticalView
                  items={scrollItems}
                  renderItem={(item) => renderProductCard(item as ScrollViewItem)}
                  height={isMobile ? undefined : "calc(100vh - 160px)"}
                  emptyMessage="No products match the current filters."
                  footer={
                    <p className="text-sm text-muted-foreground text-center mt-3 font-medium">
                      {scrollItems.length} products available
                    </p>
                  }
                />
              )}
            </>
          )}
        </>
      )}

      {state.selectedProduct && (
        <p className="text-xs text-muted-foreground px-1" data-testid="selected-product-hint">
          Product selected — choose your QR type below.
        </p>
      )}
    </div>

    {pickerOpen && (
      <BlankPickerModal open={pickerOpen} onOpenChange={setPickerOpen} />
    )}
    </>
  );
}
