import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Loader2 } from "lucide-react";
import { useBuilderContext } from "../BuilderContext";
import type { CatalogCategory } from "../types";

const selectStyles = "w-full min-h-12 text-base px-4 py-3 rounded-lg border border-input bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

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
        endpoint = `${api.baseUrl}/printify/catalog`;
      } else if (state.fulfillmentProvider === "printful") {
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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value) {
      setCategory(value);
    }
  };

  return (
    <div className="p-3 bg-muted/30 rounded-lg border" data-testid="module-category">
      <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
        <Layers className="h-3 w-3" />
        Product Category
      </label>
      <div className="relative">
        <select
          value={state.category || ""}
          onChange={handleChange}
          disabled={isLoading}
          className={selectStyles}
          data-testid="select-category"
        >
          <option value="" disabled>
            {isLoading ? "Loading categories..." : "Select a category..."}
          </option>
          {sortedCategories.map((cat) => (
            <option 
              key={cat.name} 
              value={cat.name}
              data-testid={`option-category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {cat.name} ({cat.itemCount})
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
