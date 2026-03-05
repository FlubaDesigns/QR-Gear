import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Save, Loader2, Search, Filter, Flag, Globe, Layers, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AdminShell from "@/components/AdminShell";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import {
  ProductSelectCardSkin,
  type ProductSelectItem,
} from "@/features/shared/components/skins/ProductSelectCardSkin";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

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
}

interface CatalogCategory {
  name: string;
  items: CatalogProduct[];
  count: number;
}

function catalogToSelectItem(p: CatalogProduct): ProductSelectItem {
  const minPrice = p.minPrice ? parseFloat(p.minPrice) : null;
  const imageUrl = p.imageUrl || p.image_url || p.thumbnailUrl || null;
  return {
    id: String(p.id),
    name: p.title || "",
    price: minPrice,
    cost: null,
    manufacturer: p.brand || null,
    madeInUSA: p.madeInUSA ?? false,
    primaryImageUrl: imageUrl,
    description: p.description || p.model || null,
    colorsAvailable: (p.availableColors || []).map(c => ({ name: c.name, hex: c.hex })),
    sizesAvailable: p.availableSizes || [],
    defaultColor: (p.availableColors || []).length > 0 ? p.availableColors![0].name : null,
  };
}

type LocationFilter = "all" | "usa" | "other";

export default function AdminBlanks() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");

  const { data: categories = [], isLoading: loadingCatalog } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/printify/catalog", "blanks"],
    queryFn: async () => {
      const res = await fetch("/api/printify/catalog");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: allowedData, isLoading: loadingAllowed } = useQuery({
    queryKey: ["/api/members/allowed-products"],
    queryFn: async () => {
      const res = await fetch("/api/members/allowed-products");
      return res.json();
    },
  });

  const allProducts = useMemo(() => {
    const items: CatalogProduct[] = [];
    const seen = new Set<number>();
    for (const cat of categories) {
      for (const item of (cat.items || [])) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      }
    }
    return items;
  }, [categories]);

  const productMap = useMemo(() => {
    const map = new Map<string, CatalogProduct>();
    allProducts.forEach(p => map.set(String(p.id), p));
    return map;
  }, [allProducts]);

  const categoryNames = useMemo(() => {
    return ["all", ...categories.map(c => c.name)];
  }, [categories]);

  useEffect(() => {
    if (allowedData?.products) {
      setSelectedIds(new Set<string>(
        allowedData.products.map((p: any) => String(p.blueprintId))
      ));
      setHasChanges(false);
    }
  }, [allowedData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const products = Array.from(selectedIds).map(id => {
        const item = productMap.get(id);
        const imageUrl = item?.imageUrl || item?.image_url || item?.thumbnailUrl || "";
        return {
          blueprintId: Number(id),
          title: item?.title || `Product ${id}`,
          provider: item?.fulfillmentProvider || "printify",
          imageUrl,
          colors: (item?.availableColors || []).map(c => c.name),
          sizes: item?.availableSizes || [],
          printProviderId: item?.printProviderId || null,
          addedAt: new Date().toISOString(),
        };
      });
      const res = await fetch("/api/members/allowed-products", {
        method: "POST",
        body: JSON.stringify({ products }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Blanks saved", description: `${selectedIds.size} products available for members` });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/members/allowed-products"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setHasChanges(true);
  }, []);

  const filtered = useMemo(() => {
    let items = allProducts;
    if (categoryFilter !== "all") {
      const cat = categories.find(c => c.name === categoryFilter);
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
  }, [allProducts, categories, categoryFilter, locationFilter, search]);

  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filtered.forEach(item => next.add(String(item.id)));
      return next;
    });
    setHasChanges(true);
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setHasChanges(true);
  };

  const selectItemMap = useMemo(() => {
    const map = new Map<string, ProductSelectItem>();
    filtered.forEach(p => map.set(String(p.id), catalogToSelectItem(p)));
    return map;
  }, [filtered]);

  const scrollItems: ScrollViewItem[] = useMemo(() =>
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

  const renderCatalogCard = useCallback(
    (scrollItem: ScrollViewItem, _isSelected: boolean, _onSelect: () => void) => {
      const selectItem = selectItemMap.get(String(scrollItem.id));
      if (!selectItem) return null;
      const isSelected = selectedIds.has(String(scrollItem.id));
      return (
        <ProductSelectCardSkin
          item={selectItem}
          isSelected={isSelected}
          onSelect={(id) => toggleItem(id)}
        />
      );
    },
    [selectItemMap, selectedIds, toggleItem]
  );

  const selectedProducts = useMemo(() => {
    return Array.from(selectedIds)
      .map(id => productMap.get(id))
      .filter(Boolean) as CatalogProduct[];
  }, [selectedIds, productMap]);

  const isLoading = loadingCatalog || loadingAllowed;

  return (
    <AdminShell title="Blanks" subtitle="Choose base products for members" icon={Box}>
      <div className="space-y-4">

        {selectedProducts.length > 0 && (
          <Card className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedProducts.length} Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAll}
                  data-testid="button-clear-selected"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={!hasChanges || saveMutation.isPending}
                  data-testid="button-save-blanks-top"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {selectedProducts.map(p => (
                  <div
                    key={p.id}
                    className="flex-shrink-0 w-28 relative group rounded-md overflow-hidden border bg-muted"
                    data-testid={`selected-thumb-${p.id}`}
                  >
                    <div className="aspect-square flex items-center justify-center p-1">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        <Box className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="px-1 pb-1">
                      <p className="text-[10px] leading-tight line-clamp-2 text-foreground">{p.title}</p>
                    </div>
                    <button
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ visibility: "visible" }}
                      onClick={() => toggleItem(String(p.id))}
                      data-testid={`button-remove-${p.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>
        )}

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, brand, or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-blanks"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-sm bg-background border rounded-md px-2 py-1.5"
              data-testid="select-category-filter"
            >
              {categoryNames.map(name => (
                <option key={name} value={name}>
                  {name === "all" ? `All Categories (${allProducts.length})` : `${name} (${categories.find(c => c.name === name)?.count || 0})`}
                </option>
              ))}
            </select>

            {([
              { value: "all" as LocationFilter, label: "All", icon: null },
              { value: "usa" as LocationFilter, label: "USA", icon: Flag },
              { value: "other" as LocationFilter, label: "Global", icon: Globe },
            ]).map(f => (
              <Badge
                key={f.value}
                variant={locationFilter === f.value ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setLocationFilter(f.value)}
                data-testid={`filter-location-${f.value}`}
              >
                {f.icon && <f.icon className="w-3 h-3" />}
                {f.label}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={selectAllFiltered} data-testid="button-select-all-blanks">
              Select All ({filtered.length})
            </Button>
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            {hasChanges && (
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-blanks"
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[calc(50vw-3rem)] max-w-[180px] aspect-[9/16] rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {allProducts.length === 0
                ? "No products in catalog yet. Sync your Printify catalog first from the Products page."
                : "No products match your search or filters."}
            </p>
          </Card>
        ) : (
          <SharedViewer
            mode="scroll"
            scrollProps={{
              items: scrollItems,
              selectedId: null,
              emptyMessage: "No products match the current filters.",
              layout: "vertical",
              gridHeight: "calc(100vh - 200px)",
              renderItem: renderCatalogCard,
            }}
          />
        )}
      </div>
    </AdminShell>
  );
}
