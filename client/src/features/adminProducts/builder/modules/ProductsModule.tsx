import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Skeleton } from "@/components/ui/skeleton";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useBuilderContext } from "../BuilderContext";
import { ProductViewerControls } from "../components/ProductViewerControls";
import { ProductDetailModal } from "../components/ProductDetailModal";
import type { CatalogProduct, GenderFilter } from "../types";
import type { ScrollViewItem } from "@/features/shared/components/views/ScrollView";

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

interface CatalogCategoryResponse {
  name: string;
  items: CatalogProduct[];
  count: number;
}

export function ProductsModule() {
  const { state, setOriginFilter, setGenderFilter, selectProduct, api } = useBuilderContext();
  const [previewProduct, setPreviewProduct] = useState<CatalogProduct | null>(null);

  const { data: categoryData, isLoading, error } = useQuery<CatalogCategoryResponse | null>({
    queryKey: ["catalog-products", state.fulfillmentProvider, state.category],
    queryFn: async () => {
      if (!state.fulfillmentProvider || !state.category) return null;
      
      const headers = await api.getAuthHeaders();
      const isTestEndpoint = api.baseUrl.includes("/test");
      const adminSegment = isTestEndpoint ? "" : "/admin";
      let endpoint = "";
      
      if (state.fulfillmentProvider === "printify") {
        // Printify is NOT under /admin in server routes
        endpoint = `${api.baseUrl}/printify/catalog`;
      } else if (state.fulfillmentProvider === "printful") {
        // Printful IS under /admin in prod, but NOT in /api/test
        endpoint = `${api.baseUrl}${adminSegment}/catalog/printful-products`;
      }
      
      if (!endpoint) {
        console.error("[ProductsModule] No catalog endpoint for provider:", state.fulfillmentProvider);
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
    enabled: !!state.fulfillmentProvider && !!state.category,
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

  // Early return AFTER all hooks are called
  if (state.sourceType !== "custom" || !state.fulfillmentProvider || !state.category) {
    return null;
  }

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

  const handleItemTap = (item: ScrollViewItem) => {
    const product = filteredProducts.find(p => String(p.id) === item.id);
    if (product) {
      setPreviewProduct(product);
    }
  };

  const handleProductSelect = (product: CatalogProduct) => {
    selectProduct(product);
    setPreviewProduct(null);
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
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md space-y-2">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load products"}
            </p>
            <p className="text-xs text-muted-foreground break-all">
              Debug: endpoint =
              {" "}
              {(() => {
                const isTestEndpoint = api.baseUrl.includes("/test");
                const adminSegment = isTestEndpoint ? "" : "/admin";
                if (state.fulfillmentProvider === "printify") return `${api.baseUrl}${adminSegment}/printify/catalog`;
                if (state.fulfillmentProvider === "printful") return `${api.baseUrl}${adminSegment}/catalog/printful-products`;
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
              selectedId: state.selectedProduct ? String(state.selectedProduct.id) : undefined,
              onSelect: handleItemTap,
              aspectRatio: "square",
              emptyMessage: "No products match the current filters.",
              layout: "vertical",
              gridHeight: "min(70vh, 600px)",
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
              Now choose your QR product type below ↓
            </p>
          </div>
        )}
      </div>

      <ProductDetailModal
        product={previewProduct}
        open={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
        onSelect={handleProductSelect}
      />
    </CollapsibleModule>
  );
}
