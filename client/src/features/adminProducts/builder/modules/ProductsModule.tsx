import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Layers, Search, Filter, Flag, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  ProductSelectCardSkin,
  type ProductSelectItem,
} from "@/features/shared/components/skins/ProductSelectCardSkin";
import { useBuilderContext } from "../BuilderContext";
import { useProductsContext } from "../../ProductsContext";
import type { CatalogProduct, GenderFilter, CatalogCategory } from "../types";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

type LocationFilter = "all" | "usa" | "other";

function detectGender(title: string): "mens" | "womens" | "unisex" {
  const lowerTitle = title.toLowerCase();
  
  // Check unisex first
  if (lowerTitle.includes("unisex")) return "unisex";
  
  // Check women's BEFORE men's because "women's" contains "men's"
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
  
  // Check men's after women's
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

function catalogToSelectItem(p: CatalogProduct): ProductSelectItem {
  const minPrice = p.minPrice ? parseFloat(p.minPrice) : null;
  return {
    id: String(p.id),
    name: p.title,
    price: minPrice,
    cost: minPrice,
    manufacturer: p.brand || null,
    madeInUSA: p.madeInUSA,
    primaryImageUrl: p.imageUrl || null,
    description: p.description || p.model || null,
    colorsAvailable: (p.availableColors || []).map(c => ({ name: c.name, hex: c.hex })),
    sizesAvailable: p.availableSizes || [],
    defaultColor: p.availableColors?.length > 0 ? p.availableColors[0].name : null,
  };
}

interface CatalogCategoryResponse {
  name: string;
  items: CatalogProduct[];
  count: number;
}

interface CatalogCategoryListResponse {
  name: string;
  items: { id: number }[];
}

export function ProductsModule() {
  const { state, setCategory, setOriginFilter, setGenderFilter, selectProduct, api } = useBuilderContext();
  const { selectedProviders } = useProductsContext();
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  const applyLocationFilter = useCallback((loc: LocationFilter) => {
    setLocationFilter(loc);
    if (loc === "all") setOriginFilter({ showUSA: true, showOther: true });
    else if (loc === "usa") setOriginFilter({ showUSA: true, showOther: false });
    else setOriginFilter({ showUSA: false, showOther: true });
  }, [setOriginFilter]);

  // Provider comes from ProductsContext's selectedProviders (set by ProductsControlBar)
  // Use the first selected provider, or default to printify if none selected
  const provider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";
  
  // Track previous provider to reset category when it changes
  const prevProviderRef = useRef(provider);
  useEffect(() => {
    if (prevProviderRef.current !== provider) {
      // Provider changed - reset category and product selection
      setCategory(null);
      selectProduct(null);
      prevProviderRef.current = provider;
    }
  }, [provider, setCategory, selectProduct]);

  // Fetch categories for the dropdown
  const { data: categories = [], isLoading: loadingCategories } = useQuery<CatalogCategory[]>({
    queryKey: ["catalog-categories", provider],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      let endpoint = "";
      
      if (provider === "printify") {
        endpoint = `${api.baseUrl}/printify/catalog`;
      } else if (provider === "printful") {
        endpoint = `${api.baseUrl}/catalog/printful-products`;
      }
      
      if (!endpoint) return [];
      
      const res = await fetch(endpoint, { headers });
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
    queryKey: ["catalog-products", provider, state.category],
    queryFn: async () => {
      if (!state.category) return null;
      
      const headers = await api.getAuthHeaders();
      let endpoint = "";
      
      if (provider === "printify") {
        endpoint = `${api.baseUrl}/printify/catalog`;
      } else if (provider === "printful") {
        endpoint = `${api.baseUrl}/catalog/printful-products`;
      }
      
      if (!endpoint) {
        console.error("[ProductsModule] No catalog endpoint for provider:", provider);
        return null;
      }
      
      let res: Response | null = null;

      try {
        res = await fetch(endpoint, { headers });

        // If auth fails, just return null so UI shows error panel instead of boundary
        if (res.status === 401 || res.status === 403) {
          return null;
        }

        // If anything non-OK, return null (the component already handles empty states)
        if (!res.ok) {
          return null;
        }

        // IMPORTANT: res.json() can throw if Firebase rewrites return HTML
        const data = (await res.json()) as CatalogCategoryResponse[];
        return data.find((cat) => cat.name === state.category) || null;
      } catch (e) {
        // Never throw — keep app alive and show error in-module
        console.error("[ProductsModule] Catalog load failed:", e, { endpoint, status: res?.status });
        return null;
      }
    },
    enabled: !!state.category,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes("Authorization")) return false;
      return failureCount < 2;
    },
  });

  // All hooks MUST be called before any early returns (React rules of hooks)
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
  
  // Filter by origin first, then count genders from that subset
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

  const selectItemMap = useMemo(() => {
    const map = new Map<string, { selectItem: ProductSelectItem; catalog: CatalogProduct & { gender: string } }>();
    filteredProducts.forEach(p => {
      map.set(String(p.id), { selectItem: catalogToSelectItem(p), catalog: p });
    });
    return map;
  }, [filteredProducts]);

  const scrollItems: ScrollViewItem[] = filteredProducts.map(p => ({
    id: String(p.id),
    imageUrl: p.imageUrl || "",
    title: p.title,
    subtitle: p.brand,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    colorCount: p.colorCount,
    madeInUSA: p.madeInUSA,
    hasMockupMapping: p.hasMockupMapping,
  }));

  const selectedProductId = state.selectedProduct ? String(state.selectedProduct.id) : null;

  const handleCardSelect = useCallback((id: string, _item: ProductSelectItem) => {
    const entry = selectItemMap.get(id);
    if (entry) {
      selectProduct(entry.catalog);
    }
  }, [selectItemMap, selectProduct]);

  const renderCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const entry = selectItemMap.get(String(scrollItem.id));
      if (!entry) return null;
      return (
        <ProductSelectCardSkin
          item={entry.selectItem}
          isSelected={selectedProductId === String(scrollItem.id)}
          onSelect={handleCardSelect}
        />
      );
    },
    [selectItemMap, selectedProductId, handleCardSelect]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md" data-testid="active-provider-indicator">
        <span className="text-xs text-muted-foreground">Browsing:</span>
        <span className="text-sm font-medium capitalize">{provider}</span>
        {selectedProviders.length > 1 && (
          <span className="text-xs text-muted-foreground">
            ({selectedProviders.length} providers enabled - showing first)
          </span>
        )}
      </div>

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
              data-testid="input-search-builder-products"
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
        </>
      )}

      {state.category && (
        <>
          {error ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md space-y-2">
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load products"}
              </p>
              <p className="text-xs text-muted-foreground break-all">
                Debug: endpoint =
                {" "}
                {(() => {
                  if (provider === "printify") return `${api.baseUrl}/printify/catalog`;
                  if (provider === "printful") return `${api.baseUrl}/catalog/printful-products`;
                  return "NO_PROVIDER";
                })()}
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
              ))}
            </div>
          ) : (
            <SharedViewer
              mode="scroll"
              scrollProps={{
                items: scrollItems,
                selectedId: selectedProductId,
                emptyMessage: "No products match the current filters.",
                layout: "vertical",
                gridHeight: "calc(100vh - 240px)",
                renderItem: renderCard,
              }}
            />
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
        </>
      )}

    </div>
  );
}
