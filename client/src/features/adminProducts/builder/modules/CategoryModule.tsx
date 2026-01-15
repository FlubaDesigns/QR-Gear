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
      let endpoint = "";
      
      if (state.fulfillmentProvider === "printify") {
        endpoint = `${api.baseUrl}/admin/printify/catalog`;
      } else if (state.fulfillmentProvider === "printful") {
        endpoint = `${api.baseUrl}/admin/catalog/printful-products`;
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
          const category = product.category || "Other";
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
        ) : categories.length === 0 ? (
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
            <SelectContent>
              {categories.map((cat) => (
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
