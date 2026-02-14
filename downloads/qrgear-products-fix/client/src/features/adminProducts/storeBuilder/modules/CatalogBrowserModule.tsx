import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Package, Search, Loader2, ChevronRight, Flag, Link2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useStoreBuilderContext } from "../StoreBuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";

interface CatalogItem {
  id: string;
  rawId: number;
  title: string;
  brand?: string;
  model?: string;
  imageUrl?: string;
  minPrice?: string;
  maxPrice?: string;
  colorCount?: number;
  madeInUSA?: boolean;
  provider?: 'printify' | 'printful';
  dualProvider?: boolean;
  matchedProviderId?: string | null;
}

interface CatalogCategory {
  name: string;
  items: CatalogItem[];
  count: number;
  usaCount?: number;
  printifyCount?: number;
  printfulCount?: number;
}

type ProviderFilter = 'all' | 'printify' | 'printful' | 'matched';

export function CatalogBrowserModule() {
  const { step, currentChannel, selectedBaseProduct, setSelectedBaseProduct, setStep } = useStoreBuilderContext();
  const { apiBase } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [usaOnly, setUsaOnly] = useState(false);
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<CatalogCategory[]>({
    queryKey: [`${apiBase}/printify/catalog`, { provider: providerFilter }],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/printify/catalog?provider=${providerFilter}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load catalog');
      return res.json();
    },
    enabled: !!currentChannel,
  });

  if (!currentChannel) {
    return null;
  }

  const searchLower = search.toLowerCase();
  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => {
      const matchesSearch = (item.title?.toLowerCase()?.includes(searchLower) ?? false) ||
        (item.brand?.toLowerCase()?.includes(searchLower) ?? false);
      const matchesUSA = !usaOnly || item.madeInUSA;
      return matchesSearch && matchesUSA;
    }),
  })).filter(cat => cat.items.length > 0);

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const totalUSA = categories.reduce((sum, cat) => sum + (cat.items?.filter(i => i.madeInUSA)?.length || 0), 0);
  const totalFiltered = filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0);

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

  const providerLabel = providerFilter === 'all' ? '' : 
    providerFilter === 'printify' ? ' from Printify' : 
    providerFilter === 'printful' ? ' from Printful' : 
    ' matched across both providers';

  return (
    <CollapsibleModule
      title="Browse Blank Products"
      icon={<Package className="h-4 w-4" />}
      defaultOpen={step === "catalog"}
      badge={selectedBaseProduct ? <Badge variant="secondary">{selectedBaseProduct.name}</Badge> : undefined}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={providerFilter === 'all' ? "default" : "outline"}
            size="sm"
            onClick={() => setProviderFilter('all')}
            className="text-xs"
            data-testid="button-provider-all"
          >
            All
          </Button>
          <Button
            variant={providerFilter === 'printify' ? "default" : "outline"}
            size="sm"
            onClick={() => setProviderFilter('printify')}
            className="text-xs"
            data-testid="button-provider-printify"
          >
            Printify
          </Button>
          <Button
            variant={providerFilter === 'printful' ? "default" : "outline"}
            size="sm"
            onClick={() => setProviderFilter('printful')}
            className="text-xs"
            data-testid="button-provider-printful"
          >
            Printful
          </Button>
          <Button
            variant={providerFilter === 'matched' ? "default" : "outline"}
            size="sm"
            onClick={() => setProviderFilter('matched')}
            className="text-xs gap-1"
            data-testid="button-provider-matched"
          >
            <Link2 className="h-3 w-3" />
            Dual
          </Button>
          <div className="ml-auto">
            <Button
              variant={usaOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setUsaOnly(!usaOnly)}
              className={`gap-1 ${usaOnly ? "toggle-elevate toggle-elevated" : "toggle-elevate"}`}
              data-testid="button-usa-filter"
            >
              <Flag className="h-3.5 w-3.5" />
              USA
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
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
        </div>

        <p className="text-xs text-muted-foreground" data-testid="text-catalog-count">
          {totalFiltered} products{usaOnly ? ` (${totalUSA} USA-made)` : ` of ${totalItems} total`}
          {providerLabel}
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading catalog...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No products found</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
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
                            <span className="truncate block">
                              {product.title}
                              {product.madeInUSA && (
                                <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 align-middle border-blue-500 text-blue-600 dark:text-blue-400">USA</Badge>
                              )}
                              {product.dualProvider && (
                                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 align-middle border-purple-500 text-purple-600 dark:text-purple-400">Dual</Badge>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                              {product.brand && <span>{product.brand}</span>}
                              {product.model && <span className="opacity-60">{product.model}</span>}
                              {product.provider && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 no-default-hover-elevate no-default-active-elevate">
                                  {product.provider === 'printify' ? 'Printify' : 'Printful'}
                                </Badge>
                              )}
                            </span>
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
