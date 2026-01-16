import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const sortedCategories = useMemo(() => {
    const filtered = [...categories]
      .filter(c => c.itemCount > 0 && c.name && c.name.trim() !== "")
      .sort((a, b) => {
        if (a.name === "T-Shirts") return -1;
        if (b.name === "T-Shirts") return 1;
        return a.name.localeCompare(b.name);
      });
    console.log("[CategoryModule] sortedCategories:", filtered);
    return filtered;
  }, [categories]);

  if (state.sourceType !== "custom" || !state.fulfillmentProvider) {
    return null;
  }

  return (
    <div className="p-3 bg-muted/30 rounded-lg border" data-testid="module-category">
      <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
        <Layers className="h-3 w-3" />
        Product Category
      </label>
      <Select 
        value={state.category || ""} 
        onValueChange={(value) => setCategory(value)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full" data-testid="select-category">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading categories...
            </span>
          ) : (
            <SelectValue placeholder="Select a category..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {sortedCategories.map((cat) => (
            <SelectItem 
              key={cat.name} 
              value={cat.name}
              data-testid={`option-category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {cat.name} ({cat.itemCount})
            </SelectItem>
          ))}
          {sortedCategories.length === 0 && !isLoading && (
            <SelectItem value="_none" disabled>No categories found</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
