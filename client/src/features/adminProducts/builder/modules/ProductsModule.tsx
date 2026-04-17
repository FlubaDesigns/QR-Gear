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
import { getCanonicalBlankKey, safeBlankId } from "@shared/blankKeys";
import { BlankPickerModal } from "./BlankPickerModal";

interface AdminCatalog {
  id: string;
  name: string;
  blankIds: string[];
  blankDescriptions?: Record<string, string>;
  blankTitles?: Record<string, string>;
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
): ProductSelectItem {
  const minPrice = p.minPrice ? parseFloat(p.minPrice) : null;
  const raw = p as any;
  const imageUrl = p.imageUrl || raw.image_url || raw.thumbnailUrl || raw.thumbnail || raw.image || null;
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
    id: String(p.id),
    name: effectiveTitle,
    providerTitle,
    adminCatalogTitle: normalizedAdminTitle,
    price: minPrice,
    cost: null,
    manufacturer: p.brand || raw.manufacturer || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: imageUrl,
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
  const { state, setCategory, setOriginFilter, setGenderFilter, selectProduct, setProductDescription, setProductTitle, setActiveSession } = useBuilderContext();
  const { selectedProviders, setSelectedProviders } = useProductsContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const provider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [dataMode, setDataMode] = useState<DataMode>("all");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const { data: adminCatalogsData } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });
  const adminCatalogs = adminCatalogsData?.catalogs || [];

  const activeCatalog = selectedCatalogId !== "all"
    ? adminCatalogs.find(c => c.id === selectedCatalogId) || null
    : null;


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

  const { data: masterCatalogAllProducts = [], isLoading: loadingCatalogProducts } = useQuery<CatalogProduct[]>({
    queryKey: ["all-catalog-products", "master"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog");
      const data = (await res.json()) as CatalogCategoryResponse[];
      const items: CatalogProduct[] = [];
      const seen = new Set<string>();
      for (const cat of data) {
        for (const item of (cat.items || [])) {
          const key = getCanonicalBlankKey(item);
          if (!seen.has(key)) { seen.add(key); items.push(item); }
        }
      }
      return items;
    },
    enabled: dataMode === "catalog",
    staleTime: 60000,
  });

  const catalogModeProducts = useMemo(() => {
    const catalogSet = new Set((activeCatalog?.blankIds || []).map(id => safeBlankId(id)));
    return masterCatalogAllProducts.filter(p => {
      if (catalogSet.has(getCanonicalBlankKey(p))) return true;
      // Cross-provider matched items (e.g. stored as "pf:456" but id is Printify blueprint)
      if ((p as any).printfulId) return catalogSet.has(`pf:${(p as any).printfulId}`);
      return false;
    });
  }, [masterCatalogAllProducts, activeCatalog]);

  const { data: jointCatalogProducts = [], isLoading: loadingJointProducts } = useQuery<CatalogProduct[]>({
    queryKey: ["joint-catalog-products"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/master-catalog/joint");
      const data = (await res.json()) as CatalogCategoryResponse[];
      const items: CatalogProduct[] = [];
      const seen = new Set<string>();
      for (const cat of data) {
        for (const item of (cat.items || [])) {
          const key = getCanonicalBlankKey(item);
          if (!seen.has(key)) { seen.add(key); items.push(item); }
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
    return [...categories]
      .filter(c => c.itemCount > 0 && c.name && c.name.trim() !== "")
      .sort((a, b) => {
        if (a.name === "T-Shirts & Tops") return -1;
        if (b.name === "T-Shirts & Tops") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [categories]);

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
    activeProducts.forEach(p => {
      const withGender = { ...p, gender: detectGender(p.title) };
      const blankKey = p.fulfillmentProvider === "printful" ? `pf:${p.id}` : String(p.id);
      // Load catalog-level admin overrides so cards always show the admin's version
      const adminDesc = activeCatalog?.blankDescriptions?.[blankKey] ?? null;
      const adminTitle = activeCatalog?.blankTitles?.[blankKey] ?? null;
      map.set(String(p.id), { selectItem: catalogToSelectItem(p, adminDesc, adminTitle), catalog: withGender, blankKey });
    });
    return map;
  }, [activeProducts, activeCatalog]);

  const handleDescriptionSave = useCallback(async (id: string, description: string) => {
    const entry = selectItemMap.get(id);
    if (!entry) return;
    if (!state.selectedProduct || String(state.selectedProduct.id) !== id) {
      selectProduct(entry.catalog);
    }
    setProductDescription(description || null);

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
      selectProduct(entry.catalog);
    }
    setProductTitle(title || null);

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
    try {
      await apiRequest("DELETE", `/api/admin/catalogs/${activeCatalog.id}/blanks`, { blankIds: [entry.blankKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogs"] });
      toast({ title: "Removed from catalog" });
    } catch (err: any) {
      toast({ title: "Could not remove item", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }, [activeCatalog, selectItemMap, queryClient, toast]);

  const scrollItems: ScrollViewItem[] = useMemo(() =>
    activeProducts.map(p => ({
      id: String(p.id),
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
    selectProduct(entry.catalog);

    // Immediately load the catalog's admin overrides into builder state so the
    // description and title the admin saved always appear — never revert to master
    const adminDesc = activeCatalog?.blankDescriptions?.[entry.blankKey] ?? null;
    const adminTitle = activeCatalog?.blankTitles?.[entry.blankKey] ?? null;
    if (adminDesc) setProductDescription(adminDesc);
    if (adminTitle) setProductTitle(adminTitle);

    // Clear any previous session then start/resume a build session for this master product
    setActiveSession(null, null, null);
    const sourceMasterId = String(entry.catalog.id);
    apiRequest("POST", "/api/admin/build-sessions/from-master", { sourceMasterId })
      .then(r => r.json())
      .then(data => {
        if (!data.sessionId) {
          console.error("[ProductsModule] from-master returned no sessionId:", data);
          return;
        }
        const status = (data.session?.status || 'working') as 'working' | 'artifact_ready' | 'committed';
        setActiveSession(data.sessionId, status, data.session?.committedInstanceId || null);
        console.log(`[ProductsModule] Build session ${data.isExisting ? 'resumed' : 'started'}: ${data.sessionId} (${status})`);
      })
      .catch(err => {
        console.error("[ProductsModule] Failed to start build session:", err.message || err);
      });
  }, [selectItemMap, selectProduct, provider, setSelectedProviders, activeCatalog, setProductDescription, setProductTitle, setActiveSession]);

  const renderProductCard = useCallback(
    (scrollItem: ScrollViewItem) => {
      const entry = selectItemMap.get(String(scrollItem.id));
      if (!entry) return null;
      const cardId = String(scrollItem.id);
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
        />
      );
    },
    [selectItemMap, selectedProductId, handleCardSelect, handleDescriptionSave, handleTitleSave, activeCatalog, handleDelete, deletingId]
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
