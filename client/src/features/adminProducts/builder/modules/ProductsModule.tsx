import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Layers,
  Search,
  Filter,
  Flag,
  Globe,
  BookmarkPlus,
  BookmarkMinus,
  Heart,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import {
  ProductSelectCardSkin,
  type ProductSelectItem,
} from "@/features/shared/components/skins/ProductSelectCardSkin";
import { useBuilderContext } from "../BuilderContext";
import { useProductsContext } from "../../ProductsContext";
import { useBuildShelf, type ShelfItem } from "../hooks/useBuildShelf";
import type { CatalogProduct, GenderFilter, CatalogCategory } from "../types";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

interface AdminCatalog {
  id: string;
  name: string;
  blankIds: string[];
}

type LocationFilter = "all" | "usa" | "other";
type DataMode = "all" | "favorites";

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

function catalogToSelectItem(p: CatalogProduct): ProductSelectItem {
  const minPrice = p.minPrice ? parseFloat(p.minPrice) : null;
  const raw = p as any;
  const imageUrl = p.imageUrl || raw.image_url || raw.thumbnailUrl || raw.thumbnail || raw.image || null;
  return {
    id: String(p.id),
    name: p.title || raw.name || "",
    price: minPrice,
    cost: null,
    manufacturer: p.brand || raw.manufacturer || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: imageUrl,
    description: p.description || p.model || null,
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
  const { state, setCategory, setOriginFilter, setGenderFilter, selectProduct, api } = useBuilderContext();
  const { selectedProviders, setSelectedProviders } = useProductsContext();
  const shelf = useBuildShelf();

  const provider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [dataMode, setDataMode] = useState<DataMode>("all");
  const [catalogFilter, setCatalogFilter] = useState<string>("all");

  const { data: adminCatalogsData } = useQuery<{ catalogs: AdminCatalog[] }>({
    queryKey: ["/api/admin/catalogs"],
  });
  const adminCatalogs = adminCatalogsData?.catalogs || [];

  const applyLocationFilter = useCallback((loc: LocationFilter) => {
    setLocationFilter(loc);
    if (loc === "all") setOriginFilter({ showUSA: true, showOther: true });
    else if (loc === "usa") setOriginFilter({ showUSA: true, showOther: false });
    else setOriginFilter({ showUSA: false, showOther: true });
  }, [setOriginFilter]);

  const prevProviderRef = useRef(provider);
  useEffect(() => {
    if (prevProviderRef.current !== provider) {
      setCategory(null);
      selectProduct(null);
      prevProviderRef.current = provider;
    }
  }, [provider, setCategory, selectProduct]);

  const { data: categories = [], isLoading: loadingCategories } = useQuery<CatalogCategory[]>({
    queryKey: ["catalog-categories", provider],
    queryFn: async () => {
      const headers = await api.getAuthHeaders();
      let endpoint = "";
      if (provider === "printify") endpoint = `${api.baseUrl}/printify/catalog`;
      else if (provider === "printful") endpoint = `${api.baseUrl}/catalog/printful-products`;
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
      if (provider === "printify") endpoint = `${api.baseUrl}/printify/catalog`;
      else if (provider === "printful") endpoint = `${api.baseUrl}/catalog/printful-products`;
      if (!endpoint) return null;
      try {
        const res = await fetch(endpoint, { headers });
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

  const activeCatalogBlankSet = useMemo(() => {
    if (catalogFilter === "all") return null;
    const cat = adminCatalogs.find(c => c.id === catalogFilter);
    return cat ? new Set(cat.blankIds.map(String)) : null;
  }, [catalogFilter, adminCatalogs]);

  const filteredProducts = useMemo(() => {
    return productsWithGender.filter(p => {
      const passesOrigin = (state.originFilter.showUSA && p.madeInUSA) ||
                           (state.originFilter.showOther && !p.madeInUSA);
      const passesGender = state.genderFilter === "all" || p.gender === state.genderFilter;
      const passesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
      const passesCatalog = !activeCatalogBlankSet || activeCatalogBlankSet.has(String(p.id));
      return passesOrigin && passesGender && passesSearch && passesCatalog;
    });
  }, [productsWithGender, state.originFilter, state.genderFilter, search, activeCatalogBlankSet]);

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

  const selectItemMap = useMemo(() => {
    const map = new Map<string, { selectItem: ProductSelectItem; catalog: CatalogProduct & { gender: string } }>();
    filteredProducts.forEach(p => {
      map.set(String(p.id), { selectItem: catalogToSelectItem(p), catalog: p });
    });
    return map;
  }, [filteredProducts]);

  const scrollItems: ScrollViewItem[] = useMemo(() =>
    filteredProducts.map(p => ({
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
    [filteredProducts]
  );

  const handleCardSelect = useCallback((id: string, _item: ProductSelectItem) => {
    const entry = selectItemMap.get(id);
    if (entry) selectProduct(entry.catalog);
  }, [selectItemMap, selectProduct]);

  const handleAddToShelf = useCallback((catalogProduct: CatalogProduct) => {
    shelf.addItem.mutate({
      providerId: provider,
      catalogId: String(catalogProduct.id),
      catalog: catalogProduct,
      groupIds: [],
    });
  }, [provider, shelf.addItem]);

  const handleRemoveFromShelf = useCallback((shelfItem: ShelfItem) => {
    shelf.removeItem.mutate(shelfItem.id);
  }, [shelf.removeItem]);

  const filteredShelfItems = shelf.items;

  const shelfSelectItemMap = useMemo(() => {
    const map = new Map<string, { selectItem: ProductSelectItem; shelfItem: ShelfItem; catalogWithProvider: CatalogProduct }>();
    filteredShelfItems.forEach(it => {
      const catalogWithProvider: any = {
        ...it.catalog,
        fulfillmentProvider: it.providerId as "printify" | "printful",
      };
      map.set(it.shelfKey, {
        selectItem: catalogToSelectItem(it.catalog),
        shelfItem: it,
        catalogWithProvider,
      });
    });
    return map;
  }, [filteredShelfItems]);

  const shelfScrollItems: ScrollViewItem[] = useMemo(() =>
    filteredShelfItems.map(it => ({
      id: it.shelfKey,
      imageUrl: it.catalog.imageUrl || "",
      title: it.catalog.title,
      subtitle: it.catalog.brand,
      minPrice: it.catalog.minPrice,
      maxPrice: it.catalog.maxPrice,
      colorCount: it.catalog.colorCount,
      madeInUSA: it.catalog.madeInUSA,
      hasMockupMapping: (it.catalog as any).hasMockupMapping,
    })),
    [filteredShelfItems]
  );


  const handleShelfPick = useCallback((shelfKey: string) => {
    const entry = shelfSelectItemMap.get(shelfKey);
    if (!entry) return;
    if (entry.shelfItem.providerId !== provider) {
      setSelectedProviders([entry.shelfItem.providerId]);
      setTimeout(() => selectProduct(entry.catalogWithProvider), 0);
    } else {
      selectProduct(entry.catalogWithProvider);
    }
  }, [provider, setSelectedProviders, selectProduct, shelfSelectItemMap]);

  const renderCatalogCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const entry = selectItemMap.get(String(scrollItem.id));
      if (!entry) return null;
      const onShelf = shelf.isOnShelf(provider, String(scrollItem.id));
      return (
        <div className="space-y-1">
          <ProductSelectCardSkin
            item={entry.selectItem}
            isSelected={selectedProductId === String(scrollItem.id)}
            onSelect={handleCardSelect}
          />
          <Button
            variant={onShelf ? "secondary" : "outline"}
            className="w-full text-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (onShelf) handleRemoveFromShelf(onShelf);
              else handleAddToShelf(entry.catalog);
            }}
            disabled={shelf.addItem.isPending || shelf.removeItem.isPending}
            data-testid={`button-favorite-toggle-${scrollItem.id}`}
          >
            {onShelf ? (
              <><BookmarkMinus className="h-3 w-3 mr-1" /> Favorited</>
            ) : (
              <><BookmarkPlus className="h-3 w-3 mr-1" /> Add to Favorites</>
            )}
          </Button>
        </div>
      );
    },
    [selectItemMap, selectedProductId, handleCardSelect, shelf, provider, handleAddToShelf, handleRemoveFromShelf]
  );

  const renderFavoriteCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const entry = shelfSelectItemMap.get(String(scrollItem.id));
      if (!entry) return null;
      return (
        <div className="space-y-1" data-testid={`favorite-item-${scrollItem.id}`}>
          <ProductSelectCardSkin
            item={entry.selectItem}
            isSelected={false}
            onSelect={() => handleShelfPick(String(scrollItem.id))}
          />
          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFromShelf(entry.shelfItem);
            }}
            disabled={shelf.removeItem.isPending}
            data-testid={`button-favorite-remove-${scrollItem.id}`}
          >
            <BookmarkMinus className="h-3 w-3 mr-1" /> Remove Favorite
          </Button>
        </div>
      );
    },
    [shelfSelectItemMap, handleShelfPick, handleRemoveFromShelf, shelf.removeItem.isPending]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md" data-testid="active-provider-indicator">
        <span className="text-xs text-muted-foreground">Browsing:</span>
        <span className="text-sm font-medium capitalize">{provider}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap" data-testid="data-mode-toggle">
        <Badge
          variant={dataMode === "all" ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => setDataMode("all")}
          data-testid="toggle-all"
        >
          <Layers className="w-3 h-3 mr-1" /> All
        </Badge>
        <Badge
          variant={dataMode === "favorites" ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => setDataMode("favorites")}
          data-testid="toggle-favorites"
        >
          <Heart className="w-3 h-3 mr-1" /> Favorites ({shelf.items.length})
        </Badge>
        {adminCatalogs.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <select
              value={catalogFilter}
              onChange={e => setCatalogFilter(e.target.value)}
              className="text-xs bg-background border rounded-md px-1.5 py-1"
              data-testid="select-catalog-filter"
            >
              <option value="all">All Catalogs</option>
              {adminCatalogs.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.blankIds?.length || 0})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {dataMode === "favorites" && (
        <>
          {shelf.itemsLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
              ))}
            </div>
          ) : shelfScrollItems.length === 0 ? (
            <div className="p-6 text-center space-y-2 border rounded-md bg-muted/20">
              <p className="text-sm text-muted-foreground">
                No favorites yet. Browse the catalog and add products you like.
              </p>
              <Button
                variant="outline"
                onClick={() => setDataMode("all")}
                data-testid="button-go-to-catalog"
              >
                Browse Catalog
              </Button>
            </div>
          ) : (
            <SharedViewer
              mode="scroll"
              scrollProps={{
                items: shelfScrollItems,
                selectedId: selectedProductId,
                emptyMessage: "No favorites yet.",
                layout: "vertical",
                gridHeight: "calc(100vh - 160px)",
                renderItem: renderFavoriteCard,
              }}
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
                <SharedViewer
                  mode="scroll"
                  scrollProps={{
                    items: scrollItems,
                    selectedId: selectedProductId,
                    emptyMessage: "No products match the current filters.",
                    layout: "vertical",
                    gridHeight: "calc(100vh - 160px)",
                    renderItem: renderCatalogCard,
                  }}
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
