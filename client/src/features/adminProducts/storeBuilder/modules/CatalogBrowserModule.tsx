import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Search, Loader2, ChevronRight } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreBuilderContext } from "../StoreBuilderContext";

interface CatalogItem {
  id: string;
  title: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  minPrice?: string;
  maxPrice?: string;
  colorCount?: number;
}

interface CatalogCategory {
  name: string;
  items: CatalogItem[];
  count: number;
}

export function CatalogBrowserModule() {
  const { step, currentChannel, selectedBaseProduct, setSelectedBaseProduct, setStep } = useStoreBuilderContext();
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<CatalogCategory[]>({
    queryKey: ["/api/test/printify/catalog"],
    enabled: !!currentChannel,
  });

  if (!currentChannel) {
    return null;
  }

  const searchLower = search.toLowerCase();
  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      (item.title?.toLowerCase()?.includes(searchLower) ?? false) ||
      (item.brand?.toLowerCase()?.includes(searchLower) ?? false)
    ),
  })).filter(cat => cat.items.length > 0);

  const handleSelectProduct = (product: CatalogItem) => {
    setSelectedBaseProduct({
      id: product.id,
      name: product.title,
      brand: product.brand,
      model: product.model,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    });
    if (step === "catalog") setStep("configure");
  };

  return (
    <CollapsibleModule
      title="Browse Blank Products"
      icon={<Package className="h-4 w-4" />}
      defaultOpen={step === "catalog"}
      badge={selectedBaseProduct ? <Badge variant="secondary">{selectedBaseProduct.name}</Badge> : undefined}
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            inputMode="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-catalog-search"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading catalog...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No products found</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredCategories.map(category => (
              <div key={category.name} className="border rounded-md">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(expandedCategory === category.name ? null : category.name)}
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted/30"
                  data-testid={`button-category-${category.name}`}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandedCategory === category.name ? "rotate-90" : ""}`} />
                  <span className="font-medium text-sm">{category.name}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {category.items.length}
                  </Badge>
                </button>

                {expandedCategory === category.name && (
                  <div className="border-t p-2 space-y-1">
                    {category.items.map(product => (
                      <Button
                        key={product.id}
                        variant={selectedBaseProduct?.id === product.id ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => handleSelectProduct(product)}
                        data-testid={`button-product-${product.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {product.imageUrl && (
                            <img 
                              src={product.imageUrl} 
                              alt="" 
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{product.title}</span>
                            {product.colorCount && (
                              <span className="text-xs text-muted-foreground">{product.colorCount} colors</span>
                            )}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
