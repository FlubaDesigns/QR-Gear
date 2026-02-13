import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Loader2 } from "lucide-react";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SharedViewer } from "./SharedViewer";
import type { ScrollViewItem } from "./views/ScrollView";

export interface CatalogProduct {
  id: number;
  title: string;
  brand?: string;
  model?: string;
  imageUrl?: string | null;
  minPrice?: number;
  maxPrice?: number;
  colorCount?: number;
  madeInUSA?: boolean;
  hasMockupMapping?: boolean;
}

export type GenderFilter = "all" | "mens" | "womens" | "unisex";

export interface OriginFilter {
  showUSA: boolean;
  showOther: boolean;
}

export interface ProductCatalogPickerProps {
  provider: "printify" | "printful";
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  genderFilter: GenderFilter;
  onGenderFilterChange: (filter: GenderFilter) => void;
  originFilter: OriginFilter;
  onOriginFilterChange: (filter: Partial<OriginFilter>) => void;
  selectedProductId?: number | null;
  onProductSelect: (product: CatalogProduct) => void;
  apiBase?: string;
  showProviderIndicator?: boolean;
  showFilters?: boolean;
  gridHeight?: string;
}

function detectGender(title: string): "mens" | "womens" | "unisex" {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("unisex")) return "unisex";
  if (lowerTitle.includes("women") || lowerTitle.includes("ladies") || lowerTitle.includes("girl")) return "womens";
  if (lowerTitle.includes("men") || lowerTitle.includes("guys") || lowerTitle.includes("boy")) return "mens";
  return "unisex";
}

export function ProductCatalogPicker({
  provider,
  category,
  onCategoryChange,
  genderFilter,
  onGenderFilterChange,
  originFilter,
  onOriginFilterChange,
  selectedProductId,
  onProductSelect,
  apiBase = "/api/test",
  showProviderIndicator = true,
  showFilters = true,
  gridHeight = "min(60vh, 500px)",
}: ProductCatalogPickerProps) {
  const { data: categories = [], isLoading: loadingCategories } = useQuery<{ name: string; itemCount: number }[]>({
    queryKey: ["shared-catalog-categories", provider, apiBase],
    queryFn: async () => {
      const endpoint = provider === "printify" 
        ? `${apiBase}/printify/catalog` 
        : `/api/catalog/printful-products`;
      const res = await fetch(endpoint);
      if (!res.ok) return [];
      const data = await res.json();
      
      if (provider === "printify") {
        return data.map((cat: { name: string; items?: { id: number }[] }) => ({
          name: cat.name,
          itemCount: cat.items?.length || 0,
        }));
      } else {
        return data.map((cat: { name: string; items?: unknown[]; count?: number }) => ({
          name: cat.name,
          itemCount: cat.count || cat.items?.length || 0,
        }));
      }
    },
  });

  const sortedCategories = useMemo(() => {
    return [...categories]
      .filter(c => c.itemCount > 0 && c.name?.trim())
      .sort((a, b) => {
        if (a.name === "T-Shirts") return -1;
        if (b.name === "T-Shirts") return 1;
        return a.name.localeCompare(b.name);
      });
  }, [categories]);

  const categoryOptions = sortedCategories.map(cat => ({
    value: cat.name,
    label: `${cat.name} (${cat.itemCount})`,
    icon: <Layers className="h-4 w-4 flex-shrink-0" />,
  }));

  const { data: categoryData, isLoading: loadingProducts } = useQuery<{ items: CatalogProduct[] } | null>({
    queryKey: ["shared-catalog-products", provider, category, apiBase],
    queryFn: async () => {
      if (!category) return null;
      const endpoint = provider === "printify" 
        ? `${apiBase}/printify/catalog` 
        : `/api/catalog/printful-products`;
      const res = await fetch(endpoint);
      if (!res.ok) return null;
      const data = await res.json();
      return data.find((cat: { name: string }) => cat.name === category) || null;
    },
    enabled: !!category,
  });

  const products = categoryData?.items || [];
  
  const productsWithGender = useMemo(() => 
    products.map(p => ({ ...p, gender: detectGender(p.title) })),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return productsWithGender.filter(p => {
      const passesOrigin = (originFilter.showUSA && p.madeInUSA) || (originFilter.showOther && !p.madeInUSA);
      const passesGender = genderFilter === "all" || p.gender === genderFilter;
      return passesOrigin && passesGender;
    });
  }, [productsWithGender, originFilter, genderFilter]);

  const scrollItems: ScrollViewItem[] = filteredProducts.map(p => ({
    id: String(p.id),
    imageUrl: p.imageUrl || "",
    title: p.title,
    subtitle: p.brand,
    minPrice: p.minPrice != null ? String(p.minPrice) : null,
    maxPrice: p.maxPrice != null ? String(p.maxPrice) : null,
    colorCount: p.colorCount,
    madeInUSA: p.madeInUSA,
    hasMockupMapping: p.hasMockupMapping,
  }));

  const handleItemTap = (item: ScrollViewItem) => {
    const product = filteredProducts.find(p => String(p.id) === item.id);
    if (product) {
      onProductSelect(product);
    }
  };

  const genderCounts = useMemo(() => {
    const originFiltered = productsWithGender.filter(p => 
      (originFilter.showUSA && p.madeInUSA) || (originFilter.showOther && !p.madeInUSA)
    );
    return {
      all: originFiltered.length,
      mens: originFiltered.filter(p => p.gender === "mens").length,
      womens: originFiltered.filter(p => p.gender === "womens").length,
      unisex: originFiltered.filter(p => p.gender === "unisex").length,
    };
  }, [productsWithGender, originFilter]);

  return (
    <div className="space-y-4">
      {showProviderIndicator && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
          <span className="text-xs text-muted-foreground">Catalog:</span>
          <span className="text-sm font-medium capitalize">{provider}</span>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Category</p>
        </div>
        <CustomDropdown
          value={category || ""}
          onChange={onCategoryChange}
          options={categoryOptions}
          placeholder="Select a category..."
          loading={loadingCategories}
        />
      </div>

      {category && showFilters && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onGenderFilterChange("all")}
            className={`px-3 py-1 text-sm rounded ${genderFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            All ({genderCounts.all})
          </button>
          <button
            onClick={() => onGenderFilterChange("mens")}
            className={`px-3 py-1 text-sm rounded ${genderFilter === "mens" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Men ({genderCounts.mens})
          </button>
          <button
            onClick={() => onGenderFilterChange("womens")}
            className={`px-3 py-1 text-sm rounded ${genderFilter === "womens" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Women ({genderCounts.womens})
          </button>
          <button
            onClick={() => onGenderFilterChange("unisex")}
            className={`px-3 py-1 text-sm rounded ${genderFilter === "unisex" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Unisex ({genderCounts.unisex})
          </button>
        </div>
      )}

      {category && (
        loadingProducts ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SharedViewer
            mode="scroll"
            scrollProps={{
              items: scrollItems,
              selectedId: selectedProductId ? String(selectedProductId) : undefined,
              onSelect: handleItemTap,
              aspectRatio: "square",
              emptyMessage: "No products match filters.",
              layout: "vertical",
              gridHeight,
            }}
          />
        )
      )}
    </div>
  );
}
