import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Skeleton } from "@/components/ui/skeleton";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useBuilderContext } from "../BuilderContext";
import { ProductViewerControls } from "../components/ProductViewerControls";
import type { CatalogProduct } from "../types";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

interface CatalogCategoryResponse {
  name: string;
  items: CatalogProduct[];
  count: number;
}

export function ProductsModule() {
  const { state, setOriginFilter, selectProduct, api } = useBuilderContext();

  const { data: categoryData, isLoading, error } = useQuery<CatalogCategoryResponse | null>({
    queryKey: ["catalog-products", state.fulfillmentProvider, state.category],
    queryFn: async () => {
      if (!state.fulfillmentProvider || !state.category) return null;
      
      const headers = await api.getAuthHeaders();
      let endpoint = "";
      
      if (state.fulfillmentProvider === "printify") {
        endpoint = `${api.baseUrl}/test/admin/printify/catalog`;
      } else if (state.fulfillmentProvider === "printful") {
        endpoint = `${api.baseUrl}/test/admin/catalog/printful-products`;
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
  const filteredProducts = products.filter(p => {
    if (state.originFilter.showUSA && state.originFilter.showOther) return true;
    if (state.originFilter.showUSA && p.madeInUSA) return true;
    if (state.originFilter.showOther && !p.madeInUSA) return true;
    return false;
  });

  const usaCount = products.filter(p => p.madeInUSA).length;
  const otherCount = products.filter(p => !p.madeInUSA).length;

  const scrollItems: ScrollViewItem[] = filteredProducts.map(p => ({
    id: String(p.id),
    imageUrl: p.imageUrl || "",
    title: p.title,
    subtitle: p.brand,
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
          onShowUSAChange={(checked) => setOriginFilter({ showUSA: checked })}
          onShowOtherChange={(checked) => setOriginFilter({ showOther: checked })}
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
