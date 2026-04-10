import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Layers,
  Search,
  Filter,
  Flag,
  Globe,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface AdminCatalog {
  id: string;
  name: string;
  blankIds: string[];
  blankDescriptions?: Record<string, string>;
  blankTitles?: Record<string, string>;
}

type LocationFilter = "all" | "usa" | "other";
type DataMode = "all" | "catalog";

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
    adminCatalogDescription: adminCatalogDescription ?? null,
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
  const { state, setCategory, setOriginFilter, setGenderFilter, selectProduct, setProductDescription, api } = useBuilderContext();
  const { selectedProviders, setSelectedProviders } = useProductsContext();
  const { toast } = useToast();

  const provider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [dataMode, setDataMode] = useState<DataMode>("all");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("all");

  const { data: adminCatalogsData } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });
  const adminCatalogs = adminCatalogsData?.catalogs || [];

  const activeCatalog = selectedCatalogId !== "all"
    ? adminCatalogs.find(c => c.id === selectedCatalogId) || null
    : null;


  const handleCatalogChange = useCallback((catalogId: string) => {
    setSelectedCatalogId(catalogId);
    if (catalogId !== "all") {
      setDataMode("catalog");
      selectProduct(null);
    } else {
      setDataMode("all");
    }
  }, [selectProduct]);

  const { data: masterCatalogAllProducts = [], isLoading: loadingCatalogProducts } = useQuery<CatalogProduct[]>({
    queryKey: ["all-catalog-products", "master"],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/master-catalog`, { headers });
      if (!res.ok) return [];
      const data = (await res.json()) as CatalogCategoryResponse[];
      const items: CatalogProduct[] = [];
      const seen = new Set<string>();
      for (const cat of data) {
        for (const item of (cat.items || [])) {
          const key = item.fulfillmentProvider === 'printful' ? `pf:${item.id}` : String(item.id);
          if (!seen.has(key)) { seen.add(key); items.push(item); }
        }
      }
      return items;
    },
    enabled: dataMode === "catalog",
    staleTime: 60000,
  });

  const catalogModeProducts = useMemo(() => {
    const catalogSet = new Set(activeCatalog?.blankIds.map(String) || []);
    return masterCatalogAllProducts.filter(p => {
      const blankKey = p.fulfillmentProvider === 'printful' ? `pf:${p.id}` : String(p.id);
      return catalogSet.has(blankKey);
    });
  }, [masterCatalogAllProducts, activeCatalog]);

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
      const headers = await api.getAuthHeaders();
      const res = await fetch(`${api.baseUrl}/master-catalog`, { headers });
      if (!res.ok) return [];
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
      const headers = await api.getAuthHeaders();
      try {
        const res = await fetch(`${api.baseUrl}/master-catalog`, { headers });
        if (res.status === 401 || res.status === 403) return null;
        if (!res.ok) return null;
        const data = (await res.json()) as CatalogCategoryResponse[];
        return data.find((cat) => cat.name === state.category) || null;
      } catch (e) {
        console.error("[ProductsModule] Catalog load failed:", e);
        return null;
      }
    },
    enabled: !!state.category,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes("Authorization")) return false;
      return failureCount < 2;
    },
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

  const activeProducts = dataMode === "catalog" ? catalogModeProducts : filteredProducts;

  const blankDescriptions = activeCatalog?.blankDescriptions || {};
  const blankTitles = activeCatalog?.blankTitles || {};

  const selectItemMap = useMemo(() => {
    const map = new Map<string, { selectItem: ProductSelectItem; catalog: CatalogProduct & { gender: string }; blankKey: string }>();
    activeProducts.forEach(p => {
      const withGender = { ...p, gender: detectGender(p.title) };
      const blankKey = p.fulfillmentProvider === "printful" ? `pf:${p.id}` : String(p.id);
      const adminDesc = blankDescriptions[blankKey] || null;
      const adminTitle = blankTitles[blankKey] || null;
      map.set(String(p.id), { selectItem: catalogToSelectItem(p, adminDesc, adminTitle), catalog: withGender, blankKey });
    });
    return map;
  }, [activeProducts, blankDescriptions, blankTitles]);

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

  const handleDescriptionSave = useCallback(async (id: string, description: string) => {
    if (!activeCatalog) {
      toast({ title: "Select a catalog first", variant: "destructive" });
      return;
    }
    const entry = selectItemMap.get(id);
    if (!entry) return;
    await saveDescriptionMutation.mutateAsync({ catalogId: activeCatalog.id, blankId: entry.blankKey, description });
    if (state.selectedProduct && String(state.selectedProduct.id) === id) {
      setProductDescription(description || null);
    }
  }, [activeCatalog, selectItemMap, saveDescriptionMutation, toast, state.selectedProduct, setProductDescription]);

  const handleTitleSave = useCallback(async (id: string, title: string) => {
    if (!activeCatalog) {
      toast({ title: "Select a catalog first", variant: "destructive" });
      return;
    }
    const entry = selectItemMap.get(id);
    if (!entry) return;
    await saveTitleMutation.mutateAsync({ catalogId: activeCatalog.id, blankId: entry.blankKey, title });
  }, [activeCatalog, selectItemMap, saveTitleMutation, toast]);

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
    if (entry) {
      const catalogProduct = entry.catalog as any;
      if (catalogProduct.fulfillmentProvider && catalogProduct.fulfillmentProvider !== provider) {
        internalProviderSwitch.current = true;
        setSelectedProviders([catalogProduct.fulfillmentProvider]);
      }
      selectProduct(entry.catalog);
    }
  }, [selectItemMap, selectProduct, provider, setSelectedProviders]);

  const renderProductCard = useCallback(
    (scrollItem: ScrollViewItem) => {
      const entry = selectItemMap.get(String(scrollItem.id));
      if (!entry) return null;
      return (
        <ProductSelectCardSkin
          item={entry.selectItem}
          isSelected={selectedProductId === String(scrollItem.id)}
          onSelect={handleCardSelect}
          editableDescription={!!activeCatalog}
          onDescriptionSave={handleDescriptionSave}
          descriptionSaving={saveDescriptionMutation.isPending}
          editableTitle={!!activeCatalog}
          onTitleSave={handleTitleSave}
          titleSaving={saveTitleMutation.isPending}
        />
      );
    },
    [selectItemMap, selectedProductId, handleCardSelect, activeCatalog, handleDescriptionSave, saveDescriptionMutation.isPending, handleTitleSave, saveTitleMutation.isPending]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md" data-testid="active-provider-indicator">
        <span className="text-xs text-muted-foreground">Browsing:</span>
        <span className="text-sm font-medium capitalize">{provider}</span>
      </div>

      <div data-testid="module-catalog-select">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Product Source</p>
        </div>
        <select
          value={selectedCatalogId}
          onChange={e => handleCatalogChange(e.target.value)}
          className="w-full text-sm bg-background border rounded-md px-3 py-2"
          data-testid="select-catalog"
        >
          <option value="all">All Products (by category)</option>
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
              height="calc(100vh - 160px)"
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

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-3 w-3 text-muted-foreground" />
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
                  height="calc(100vh - 160px)"
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
        <div className="p-3 bg-primary/5 rounded-md border space-y-3">
          <div>
            <p className="text-sm font-medium">Selected: {state.selectedProduct.title}</p>
            <p className="text-xs text-muted-foreground">
              {state.selectedProduct.brand} - {state.selectedProduct.model}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Now choose your QR product type below
          </p>
        </div>
      )}
    </div>
  );
}
