import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Package } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Skeleton } from "@/components/ui/skeleton";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useBuilderContext } from "../BuilderContext";
import { ProductViewerControls } from "../components/ProductViewerControls";
import type { CatalogProduct, GenderFilter } from "../types";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

function detectGender(title: string): "mens" | "womens" | "unisex" {
  const lowerTitle = title.toLowerCase();
  const mensKeywords = ["men's", "mens", "men ", "male", "guys", "boy's", "boys"];
  const womensKeywords = ["women's", "womens", "women ", "female", "ladies", "lady", "girl's", "girls"];
  const unisexKeywords = ["unisex"];
  
  if (unisexKeywords.some(k => lowerTitle.includes(k))) return "unisex";
  if (mensKeywords.some(k => lowerTitle.includes(k))) return "mens";
  if (womensKeywords.some(k => lowerTitle.includes(k))) return "womens";
  return "unisex";
}

interface CatalogCategoryResponse {
  name: string;
  items: CatalogProduct[];
  count: number;
}

export function ProductsModule() {
  const { state, setOriginFilter, setGenderFilter, selectProduct, api } = useBuilderContext();

  const { data: categoryData, isLoading, error } = useQuery<CatalogCategoryResponse | null>({
    queryKey: ["catalog-products", state.fulfillmentProvider, state.category],
    queryFn: async () => {
      if (!state.fulfillmentProvider || !state.category) return null;
      
      const headers = await api.getAuthHeaders();
      let endpoint = "";
      
      if (state.fulfillmentProvider === "printify") {
        endpoint = `${api.baseUrl}/admin/printify/catalog`;
      } else if (state.fulfillmentProvider === "printful") {
        endpoint = `${api.baseUrl}/admin/catalog/printful-products`;
      }
      
      if (!endpoint) throw new Error("No catalog endpoint for this provider");
      
      const res = await fetch(endpoint, { headers });
      
      if (res.status === 401 || res.status === 403) {
        throw new Error("Authorization failed - please refresh and try again");
      }
      
      if (!res.ok) {
        throw new Error(`Failed to load catalog: ${res.status}`);
      }
      
      const data = await res.json() as CatalogCategoryResponse[];
      return data.find(cat => cat.name === state.category) || null;
    },
    enabled: !!state.fulfillmentProvider && !!state.category,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes("Authorization")) return false;
      return failureCount < 2;
    },
  });

  if (state.sourceType !== "custom" || !state.fulfillmentProvider || !state.category) {
    return null;
  }

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
      return passesOrigin && passesGender;
    });
  }, [productsWithGender, state.originFilter, state.genderFilter]);

  const usaCount = products.filter(p => p.madeInUSA).length;
  const otherCount = products.filter(p => !p.madeInUSA).length;
  
  const genderCounts = useMemo(() => ({
    all: productsWithGender.length,
    mens: productsWithGender.filter(p => p.gender === "mens").length,
    womens: productsWithGender.filter(p => p.gender === "womens").length,
    unisex: productsWithGender.filter(p => p.gender === "unisex").length,
  }), [productsWithGender]);

  const scrollItems: ScrollViewItem[] = filteredProducts.map(p => ({
    id: String(p.id),
    imageUrl: p.imageUrl || "",
    title: p.title,
    subtitle: p.brand,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    colorCount: p.colorCount,
    madeInUSA: p.madeInUSA,
  }));

  const handleSelect = (item: ScrollViewItem) => {
    const product = filteredProducts.find(p => String(p.id) === item.id);
    if (product) {
      selectProduct(product);
    }
  };

  return (
    <CollapsibleModule
      title="Select Product"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <ProductViewerControls
          showUSA={state.originFilter.showUSA}
          showOther={state.originFilter.showOther}
          usaCount={usaCount}
          otherCount={otherCount}
          genderFilter={state.genderFilter}
          genderCounts={genderCounts}
          onShowUSAChange={(checked) => setOriginFilter({ showUSA: checked })}
          onShowOtherChange={(checked) => setOriginFilter({ showOther: checked })}
          onGenderFilterChange={setGenderFilter}
        />

        {error ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
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
              selectedId: state.selectedProduct ? String(state.selectedProduct.id) : undefined,
              onSelect: handleSelect,
              aspectRatio: "square",
              emptyMessage: "No products match the current filters.",
              layout: "grid",
              gridHeight: "420px",
            }}
          />
        )}

        {state.selectedProduct && (
          <div className="p-3 bg-primary/5 rounded-md border">
            <p className="text-sm font-medium">Selected: {state.selectedProduct.title}</p>
            <p className="text-xs text-muted-foreground">
              {state.selectedProduct.brand} - {state.selectedProduct.model}
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
