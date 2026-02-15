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
  Library,
  Plus,
  Pencil,
  Trash2,
  X,
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

type LocationFilter = "all" | "usa" | "other";
type ViewMode = "catalog" | "shelf";

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
  return {
    id: String(p.id),
    name: p.title,
    price: minPrice,
    cost: null,
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

function GroupManager({
  onClose,
}: {
  onClose: () => void;
}) {
  const shelf = useBuildShelf();
  const [newGroupName, setNewGroupName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = () => {
    if (!newGroupName.trim()) return;
    shelf.createGroup.mutate(
      { name: newGroupName.trim(), sortOrder: shelf.groups.length },
      { onSuccess: () => setNewGroupName("") }
    );
  };

  const handleRename = (groupId: string) => {
    if (!editName.trim()) return;
    shelf.renameGroup.mutate(
      { groupId, name: editName.trim() },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <div className="space-y-3 p-3 border rounded-md bg-muted/30" data-testid="group-manager">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Manage Groups</p>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-groups">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New group name..."
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          data-testid="input-new-group-name"
        />
        <Button
          onClick={handleCreate}
          disabled={!newGroupName.trim() || shelf.createGroup.isPending}
          data-testid="button-create-group"
        >
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {shelf.groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No groups yet. Create one above.</p>
      ) : (
        <div className="space-y-1">
          {shelf.groups.map((group) => (
            <div key={group.id} className="flex items-center gap-2 p-2 rounded-md bg-background">
              {editingId === group.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleRename(group.id)}
                    autoFocus
                    data-testid={`input-rename-group-${group.id}`}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleRename(group.id)}
                    disabled={shelf.renameGroup.isPending}
                    data-testid={`button-save-rename-${group.id}`}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{group.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(group.id);
                      setEditName(group.name);
                    }}
                    data-testid={`button-rename-group-${group.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete group "${group.name}"? Items won't be deleted.`)) {
                        shelf.deleteGroup.mutate(group.id);
                      }
                    }}
                    data-testid={`button-delete-group-${group.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export function ProductsModule() {
  const { state, setCategory, setOriginFilter, setGenderFilter, selectProduct, api } = useBuilderContext();
  const { selectedProviders, setSelectedProviders } = useProductsContext();
  const shelf = useBuildShelf();
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("shelf");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [shelfProviderFilter, setShelfProviderFilter] = useState<"all" | "printify" | "printful">("all");
  const [showGroupManager, setShowGroupManager] = useState(false);

  const applyLocationFilter = useCallback((loc: LocationFilter) => {
    setLocationFilter(loc);
    if (loc === "all") setOriginFilter({ showUSA: true, showOther: true });
    else if (loc === "usa") setOriginFilter({ showUSA: true, showOther: false });
    else setOriginFilter({ showUSA: false, showOther: true });
  }, [setOriginFilter]);

  const provider = selectedProviders.length > 0 ? selectedProviders[0] : "printify";

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
      let res: Response | null = null;
      try {
        res = await fetch(endpoint, { headers });
        if (res.status === 401 || res.status === 403) return null;
        if (!res.ok) return null;
        const data = (await res.json()) as CatalogCategoryResponse[];
        return data.find((cat) => cat.name === state.category) || null;
      } catch (e) {
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

  const handleShelfSelect = useCallback((shelfItem: ShelfItem) => {
    const catalogWithProvider = {
      ...shelfItem.catalog,
      fulfillmentProvider: shelfItem.providerId as "printify" | "printful",
    };
    if (shelfItem.providerId !== provider) {
      setSelectedProviders([shelfItem.providerId]);
      setTimeout(() => selectProduct(catalogWithProvider), 0);
    } else {
      selectProduct(catalogWithProvider);
    }
  }, [provider, setSelectedProviders, selectProduct]);

  const filteredShelfItems = useMemo(() => {
    let items = shelf.items;
    if (shelfProviderFilter !== "all") {
      items = items.filter(item => item.providerId === shelfProviderFilter);
    }
    if (activeGroupFilter) {
      items = items.filter(item => (item.groupIds || []).includes(activeGroupFilter));
    }
    if (search) {
      items = items.filter(item =>
        item.catalog.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    return items;
  }, [shelf.items, shelfProviderFilter, activeGroupFilter, search]);

  const shelfProducts = useMemo(() =>
    filteredShelfItems.map(item => ({
      ...item.catalog,
      gender: detectGender(item.catalog.title),
      _shelfItem: item,
    })),
    [filteredShelfItems]
  );

  const filteredShelfProducts = useMemo(() => {
    return shelfProducts.filter(p => {
      const passesOrigin = (state.originFilter.showUSA && p.madeInUSA) ||
                           (state.originFilter.showOther && !p.madeInUSA);
      const passesGender = state.genderFilter === "all" || p.gender === state.genderFilter;
      return passesOrigin && passesGender;
    });
  }, [shelfProducts, state.originFilter, state.genderFilter]);

  const shelfSelectItemMap = useMemo(() => {
    const map = new Map<string, { selectItem: ProductSelectItem; catalog: CatalogProduct & { gender: string }; shelfItem: ShelfItem }>();
    filteredShelfProducts.forEach(p => {
      map.set(String(p.id), { selectItem: catalogToSelectItem(p), catalog: p, shelfItem: p._shelfItem });
    });
    return map;
  }, [filteredShelfProducts]);

  const shelfScrollItems: ScrollViewItem[] = useMemo(() =>
    filteredShelfProducts.map(p => ({
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
    [filteredShelfProducts]
  );

  const shelfUsaCount = shelfProducts.filter(p => p.madeInUSA).length;
  const shelfOtherCount = shelfProducts.filter(p => !p.madeInUSA).length;

  const shelfOriginFiltered = useMemo(() => {
    return shelfProducts.filter(p =>
      (state.originFilter.showUSA && p.madeInUSA) ||
      (state.originFilter.showOther && !p.madeInUSA)
    );
  }, [shelfProducts, state.originFilter]);

  const shelfGenderCounts = useMemo(() => ({
    all: shelfOriginFiltered.length,
    mens: shelfOriginFiltered.filter(p => p.gender === "mens").length,
    womens: shelfOriginFiltered.filter(p => p.gender === "womens").length,
    unisex: shelfOriginFiltered.filter(p => p.gender === "unisex").length,
  }), [shelfOriginFiltered]);

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
              if (onShelf) {
                handleRemoveFromShelf(onShelf);
              } else {
                handleAddToShelf(entry.catalog);
              }
            }}
            disabled={shelf.addItem.isPending || shelf.removeItem.isPending}
            data-testid={`button-shelf-toggle-${scrollItem.id}`}
          >
            {onShelf ? (
              <><BookmarkMinus className="h-3 w-3 mr-1" /> On Shelf</>
            ) : (
              <><BookmarkPlus className="h-3 w-3 mr-1" /> Add to Shelf</>
            )}
          </Button>
        </div>
      );
    },
    [selectItemMap, selectedProductId, handleCardSelect, shelf, provider, handleAddToShelf, handleRemoveFromShelf]
  );

  const handleShelfCardSelect = useCallback((id: string, _item: ProductSelectItem) => {
    const entry = shelfSelectItemMap.get(id);
    if (entry) handleShelfSelect(entry.shelfItem);
  }, [shelfSelectItemMap, handleShelfSelect]);

  const renderShelfCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const entry = shelfSelectItemMap.get(String(scrollItem.id));
      if (!entry) return null;
      return (
        <div className="space-y-1" data-testid={`shelf-item-${scrollItem.id}`}>
          <ProductSelectCardSkin
            item={entry.selectItem}
            isSelected={selectedProductId === String(scrollItem.id)}
            onSelect={handleShelfCardSelect}
          />
          <Button
            variant="secondary"
            className="w-full text-xs"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFromShelf(entry.shelfItem);
            }}
            disabled={shelf.removeItem.isPending}
            data-testid={`button-shelf-remove-${scrollItem.id}`}
          >
            <BookmarkMinus className="h-3 w-3 mr-1" /> Remove from Shelf
          </Button>
        </div>
      );
    },
    [shelfSelectItemMap, selectedProductId, handleShelfCardSelect, handleRemoveFromShelf, shelf]
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

      <div className="flex flex-col sm:flex-row gap-2" data-testid="view-mode-tabs">
        <Button
          variant={viewMode === "shelf" ? "default" : "outline"}
          className="flex-1 min-h-11"
          onClick={() => setViewMode("shelf")}
          data-testid="tab-shelf"
        >
          <Library className="h-4 w-4 mr-2" />
          Build Shelf ({shelf.items.length})
        </Button>
        <Button
          variant={viewMode === "catalog" ? "default" : "outline"}
          className="flex-1 min-h-11"
          onClick={() => setViewMode("catalog")}
          data-testid="tab-catalog"
        >
          <Layers className="h-4 w-4 mr-2" />
          Full Catalog
        </Button>
      </div>

      {viewMode === "shelf" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={activeGroupFilter === null ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setActiveGroupFilter(null)}
              data-testid="filter-shelf-all"
            >
              All ({shelf.items.length})
            </Badge>
            {shelf.groups.map(group => {
              const count = shelf.items.filter(i => (i.groupIds || []).includes(group.id)).length;
              return (
                <Badge
                  key={group.id}
                  variant={activeGroupFilter === group.id ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setActiveGroupFilter(group.id)}
                  data-testid={`filter-shelf-group-${group.id}`}
                >
                  {group.name} ({count})
                </Badge>
              );
            })}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowGroupManager(!showGroupManager)}
              data-testid="button-manage-groups"
            >
              <Pencil className="h-3 w-3 mr-1" /> Manage
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Provider:</span>
            {(["all", "printify", "printful"] as const).map((pv) => {
              const count = pv === "all"
                ? shelf.items.length
                : shelf.items.filter(i => i.providerId === pv).length;
              return (
                <Badge
                  key={pv}
                  variant={shelfProviderFilter === pv ? "default" : "outline"}
                  className="cursor-pointer text-xs capitalize"
                  onClick={() => setShelfProviderFilter(pv)}
                  data-testid={`filter-shelf-provider-${pv}`}
                >
                  {pv === "all" ? "All" : pv} ({count})
                </Badge>
              );
            })}
          </div>

          {showGroupManager && <GroupManager onClose={() => setShowGroupManager(false)} />}

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search shelf..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="input-search-shelf"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <Badge
                variant={locationFilter === "all" ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => applyLocationFilter("all")}
                data-testid="filter-shelf-location-all"
              >
                <Globe className="w-3 h-3 mr-1" /> All ({shelfProducts.length})
              </Badge>
              <Badge
                variant={locationFilter === "usa" ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => applyLocationFilter("usa")}
                data-testid="filter-shelf-location-usa"
              >
                <Flag className="w-3 h-3 mr-1" /> USA ({shelfUsaCount})
              </Badge>
              <Badge
                variant={locationFilter === "other" ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => applyLocationFilter("other")}
                data-testid="filter-shelf-location-other"
              >
                Other ({shelfOtherCount})
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "mens", "womens", "unisex"] as const).map((g) => (
                <Badge
                  key={g}
                  variant={state.genderFilter === g ? "default" : "outline"}
                  className="cursor-pointer text-xs capitalize"
                  onClick={() => setGenderFilter(g)}
                  data-testid={`filter-shelf-gender-${g}`}
                >
                  {g === "all" ? "All" : g === "mens" ? "Men" : g === "womens" ? "Women" : "Unisex"} ({shelfGenderCounts[g]})
                </Badge>
              ))}
            </div>
          </div>

          {shelf.itemsLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
              ))}
            </div>
          ) : filteredShelfProducts.length === 0 ? (
            <div className="p-6 text-center space-y-2 border rounded-md bg-muted/20">
              <Library className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {shelf.items.length === 0
                  ? "Your Build Shelf is empty. Browse the Full Catalog to save your favorite products here."
                  : "No shelf items match your current filters."}
              </p>
              {shelf.items.length === 0 && (
                <Button
                  variant="outline"
                  onClick={() => setViewMode("catalog")}
                  data-testid="button-go-to-catalog"
                >
                  Browse Catalog
                </Button>
              )}
            </div>
          ) : (
            <SharedViewer
              mode="scroll"
              scrollProps={{
                items: shelfScrollItems,
                selectedId: selectedProductId,
                emptyMessage: "No shelf items match the current filters.",
                layout: "vertical",
                gridHeight: "calc(100vh - 160px)",
                renderItem: renderShelfCard,
              }}
            />
          )}
        </div>
      )}

      {viewMode === "catalog" && (
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
                    Debug: endpoint ={" "}
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
