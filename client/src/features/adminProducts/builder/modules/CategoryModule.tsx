import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
          <ScrollArea className="w-full">
            <div className="flex flex-wrap gap-2">
              {sortedCategories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    state.category === cat.name
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`button-category-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {cat.name} ({cat.itemCount})
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </CollapsibleModule>
  );
}
