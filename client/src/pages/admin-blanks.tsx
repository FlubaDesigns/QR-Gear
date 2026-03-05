import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Save, Loader2, Search, Filter, Flag, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AdminShell from "@/components/AdminShell";
import {
  ProductSelectCardSkin,
  type ProductSelectItem,
} from "@/features/shared/components/skins/ProductSelectCardSkin";

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
        const item = allProducts.find(p => String(p.id) === id);
        return {
          blueprintId: Number(id),
          title: item?.title || `Product ${id}`,
          provider: item?.fulfillmentProvider || "printify",
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

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setHasChanges(true);
  };

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

  const isLoading = loadingCatalog || loadingAllowed;

  return (
    <AdminShell title="Blanks" subtitle="Set up base products for members to customize" icon={Box}>
      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Choose which blank products members can use in their sandbox. Members will add their own QR codes, graphics, and text to these items.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary">{allProducts.length} in catalog</Badge>
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            {categories.length > 0 && (
              <Badge variant="secondary">{categories.length} categories</Badge>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-2">
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
            <div className="flex items-center gap-1">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="text-sm bg-background border rounded-md px-2 py-1.5"
                data-testid="select-category-filter"
              >
                {categoryNames.map(name => (
                  <option key={name} value={name}>
                    {name === "all" ? "All Categories" : name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              {([
                { value: "all" as LocationFilter, label: "All", icon: null },
                { value: "usa" as LocationFilter, label: "USA", icon: Flag },
                { value: "other" as LocationFilter, label: "Global", icon: Globe },
              ]).map(f => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={locationFilter === f.value ? "default" : "outline"}
                  onClick={() => setLocationFilter(f.value)}
                  data-testid={`button-location-${f.value}`}
                >
                  {f.icon && <f.icon className="h-3 w-3" />}
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={selectAllFiltered} data-testid="button-select-all-blanks">
              Select All Shown ({filtered.length})
            </Button>
            <Button size="sm" variant="outline" onClick={clearAll} data-testid="button-clear-all-blanks">
              Clear All
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              data-testid="button-save-blanks"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save ({selectedIds.size})
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(product => {
              const selectItem = catalogToSelectItem(product);
              const isSelected = selectedIds.has(selectItem.id);
              return (
                <ProductSelectCardSkin
                  key={selectItem.id}
                  item={selectItem}
                  isSelected={isSelected}
                  onSelect={(id) => toggleItem(id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
