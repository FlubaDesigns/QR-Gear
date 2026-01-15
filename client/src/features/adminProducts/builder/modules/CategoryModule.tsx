import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuilderContext } from "../BuilderContext";
import type { CatalogCategory } from "../types";

interface CatalogCategoryResponse {
  name: string;
  items: { id: number }[];
}

export function CategoryModule() {
  const { state, setCategory, api } = useBuilderContext();

  const { data: categories = [], isLoading } = useQuery<CatalogCategory[]>({
    queryKey: ["catalog-categories", state.fulfillmentProvider],
    queryFn: async () => {
      if (!state.fulfillmentProvider) return [];
      
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
      
      if (!endpoint) return [];
      
      const res = await fetch(endpoint, { headers });
      if (!res.ok) return [];
      
      const data = await res.json();
      
      if (state.fulfillmentProvider === "printify") {
        return (data as CatalogCategoryResponse[]).map((cat) => ({
          name: cat.name,
          itemCount: cat.items?.length || 0,
        }));
      } else if (state.fulfillmentProvider === "printful") {
        const grouped: Record<string, number> = {};
        for (const product of data) {
          // Printful uses 'type' field (e.g., "KNITWEAR", "CUT-SEW")
          const category = product.type || "Other";
          grouped[category] = (grouped[category] || 0) + 1;
        }
        return Object.entries(grouped).map(([name, count]) => ({
          name,
          itemCount: count,
        }));
      }
      
      return [];
    },
    enabled: !!state.fulfillmentProvider,
  });

  if (state.sourceType !== "custom" || !state.fulfillmentProvider) {
    return null;
  }

  const sortedCategories = [...categories]
    .filter(c => c.itemCount > 0)
    .sort((a, b) => {
      if (a.name === "T-Shirts") return -1;
      if (b.name === "T-Shirts") return 1;
      return a.name.localeCompare(b.name);
    });

  useEffect(() => {
    if (state.fulfillmentProvider && !state.category && sortedCategories.length > 0) {
      const tshirts = sortedCategories.find(c => c.name === "T-Shirts");
      if (tshirts) {
        setCategory("T-Shirts");
      } else {
        setCategory(sortedCategories[0].name);
      }
    }
  }, [state.fulfillmentProvider, state.category, sortedCategories, setCategory]);

  return (
    <CollapsibleModule
      title="Product Category"
      icon={<Layers className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Select a product category to browse available items.
        </p>
        
        {isLoading ? (
          <Skeleton className="h-10 w-full max-w-xs" />
        ) : sortedCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories found for this provider.
          </p>
        ) : (
          <Select
            value={state.category || ""}
            onValueChange={(value) => setCategory(value || null)}
          >
            <SelectTrigger className="w-full max-w-xs" data-testid="select-category">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60">
              {sortedCategories.map((cat) => (
                <SelectItem 
                  key={cat.name} 
                  value={cat.name}
                  data-testid={`option-category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {cat.name} ({cat.itemCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </CollapsibleModule>
  );
}
