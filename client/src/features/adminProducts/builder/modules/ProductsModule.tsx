import { useQuery } from "@tanstack/react-query";
import { Package, Flag, Globe } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBuilderContext } from "../BuilderContext";
import type { CatalogProduct } from "../types";

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

  return (
    <CollapsibleModule
      title="Select Product"
      icon={<Package className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="filter-usa"
              checked={state.originFilter.showUSA}
              onCheckedChange={(checked) => setOriginFilter({ showUSA: checked })}
              data-testid="switch-filter-usa"
            />
            <Label htmlFor="filter-usa" className="flex items-center gap-1.5 cursor-pointer">
              <Flag className="h-3.5 w-3.5 text-blue-600" />
              Made in USA ({usaCount})
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="filter-other"
              checked={state.originFilter.showOther}
              onCheckedChange={(checked) => setOriginFilter({ showOther: checked })}
              data-testid="switch-filter-other"
            />
            <Label htmlFor="filter-other" className="flex items-center gap-1.5 cursor-pointer">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              Made Elsewhere ({otherCount})
            </Label>
          </div>
        </div>

        {error ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load products"}
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No products match the current filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className={`relative cursor-pointer overflow-hidden hover-elevate ${
                  state.selectedProduct?.id === product.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => selectProduct(product)}
                data-testid={`card-product-${product.id}`}
              >
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs font-medium line-clamp-2 leading-tight">
                    {product.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{product.brand}</p>
                  {product.madeInUSA && (
                    <Badge variant="secondary" className="text-xs py-0">
                      <Flag className="h-2.5 w-2.5 mr-1" />
                      USA
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
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
