import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Search, Loader2, ChevronRight } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreBuilderContext } from "../StoreBuilderContext";

interface PrintifyBlueprint {
  id: number;
  title: string;
  brand?: string;
  model?: string;
  images?: string[];
}

interface CategoryGroup {
  category: string;
  products: PrintifyBlueprint[];
}

export function CatalogBrowserModule() {
  const { step, currentChannel, selectedBaseProduct, setSelectedBaseProduct, setStep } = useStoreBuilderContext();
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: blueprints = [], isLoading } = useQuery<PrintifyBlueprint[]>({
    queryKey: ["/api/test/printify-catalog"],
    enabled: !!currentChannel,
  });

  if (!currentChannel) {
    return null;
  }

  const filteredProducts = blueprints.filter(p =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const groupedProducts = filteredProducts.reduce<Record<string, PrintifyBlueprint[]>>((acc, product) => {
    const category = product.brand || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {});

  const categories = Object.keys(groupedProducts).sort();

  const handleSelectProduct = (product: PrintifyBlueprint) => {
    setSelectedBaseProduct({
      id: String(product.id),
      name: product.title,
      brand: product.brand,
      model: product.model,
      images: product.images,
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
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No products found</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {categories.map(category => (
              <div key={category} className="border rounded-md">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted/30"
                  data-testid={`button-category-${category}`}
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandedCategory === category ? "rotate-90" : ""}`} />
                  <span className="font-medium text-sm">{category}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {groupedProducts[category].length}
                  </Badge>
                </button>

                {expandedCategory === category && (
                  <div className="border-t p-2 space-y-1">
                    {groupedProducts[category].map(product => (
                      <Button
                        key={product.id}
                        variant={selectedBaseProduct?.id === String(product.id) ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => handleSelectProduct(product)}
                        data-testid={`button-product-${product.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {product.images?.[0] && (
                            <img 
                              src={product.images[0]} 
                              alt="" 
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <span className="truncate">{product.title}</span>
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
