import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProductsProvider, useProductsContext } from "./ProductsContext";
import { FulfillmentPickerModule } from "./modules/FulfillmentPickerModule";
import { StoreChannelDropdownModule } from "./modules/StoreChannelDropdownModule";
import { SyncModule } from "./modules/SyncModule";
import { BuilderHarness } from "./builder/BuilderHarness";
import { ProductConfigSkin } from "@/features/shared/components/ProductConfigSkin";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import type { Product } from "./shared/types";

interface ProductConfigItem {
  id: string;
  name: string;
  imageUrl: string;
  sizes: string[];
  colors: Array<{ name: string; hex: string }>;
  enabledSizes: string[];
  enabledColors: string[];
  defaultColor: string | null;
  mockupsByColor: Record<string, { front?: string; lifestyle?: string }>;
  blueprintId?: number;
  printProviderId?: number;
  cachedMinCost?: number | null;
  cachedMaxCost?: number | null;
}

function ProductConfigCatalog({ products, apiBase }: { products: Product[]; apiBase: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: configProducts = [], isLoading, refetch } = useQuery<ProductConfigItem[]>({
    queryKey: [`${apiBase}/product-configs`],
  });

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: [`${apiBase}/product-configs`] });
  };

  const filtered = useMemo(() => {
    if (!search) return configProducts;
    const q = search.toLowerCase();
    return configProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [configProducts, search]);

  return (
    <div className="glass-card">
      <CollapsibleModule
        title={`Products (${filtered.length})`}
        icon={<Package className="h-4 w-4" />}
        defaultOpen
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                data-testid="input-search-products"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-products"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12" data-testid="loader-product-configs">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <SharedViewer mode="grid" className="w-full">
              <div className="space-y-4" data-testid="product-config-list">
                {filtered.map((product) => (
                  <ProductConfigSkin
                    key={product.id}
                    productId={product.id}
                    productName={product.name}
                    productImage={product.imageUrl}
                    sizes={product.sizes}
                    colors={product.colors}
                    enabledSizes={product.enabledSizes}
                    enabledColors={product.enabledColors}
                    defaultColor={product.defaultColor || undefined}
                    mockupsByColor={product.mockupsByColor}
                    blueprintId={product.blueprintId}
                    printProviderId={product.printProviderId}
                    apiBase={apiBase}
                    onUpdate={handleUpdate}
                  />
                ))}

                {filtered.length === 0 && (
                  <div className="text-center py-8 border rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground" data-testid="text-no-products">
                      No products match your search
                    </p>
                  </div>
                )}
              </div>
            </SharedViewer>
          )}
        </div>
      </CollapsibleModule>
    </div>
  );
}

interface ProductsHarnessProps {
  showHeader?: boolean;
  showCatalog?: boolean;
  showBuilder?: boolean;
  showSync?: boolean;
}

function ProductsHarnessInner({
  showHeader = true,
  showCatalog = true,
  showBuilder = true,
  showSync = true,
}: ProductsHarnessProps) {
  const { 
    api, 
    providers, 
    selectedProviders, 
    setSelectedProviders,
  } = useProductsContext();

  const primaryProvider = selectedProviders.length === 1 ? selectedProviders[0] : undefined;

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: [...api.getQueryKey("all"), primaryProvider],
    queryFn: () => api.fetchProducts(primaryProvider),
  });

  const filteredProducts = useMemo(() => {
    return products.filter((product: Product) => {
      const productProvider = product.printifyId
        ? "printify"
        : (product.metadata as Record<string, unknown>)?.fulfillmentProvider || "printify";
      return selectedProviders.length === 0 || selectedProviders.includes(productProvider as string);
    });
  }, [products, selectedProviders]);

  const productCount = {
    filtered: filteredProducts.length,
    total: products.length,
  };

  return (
    <div className="mobile-compact-stack">
      {showHeader && (
        <div className="glass-card">
          <h1 className="glass-title text-2xl mb-2">Products</h1>
          <p className="glass-body">
            Manage products, sync catalog, and configure pricing.
          </p>
        </div>
      )}

      <div className="glass-card">
        <FulfillmentPickerModule
          providers={providers}
          selectedProviders={selectedProviders}
          onSelectionChange={setSelectedProviders}
          productCount={productCount}
        />
      </div>

      {showSync && (
        <div className="glass-card">
          <SyncModule selectedProviders={selectedProviders} />
        </div>
      )}

      <StoreChannelDropdownModule />

      {showCatalog && filteredProducts.length > 0 && (
        <ProductConfigCatalog products={filteredProducts} apiBase={api.baseUrl} />
      )}

      {showBuilder && (
        <div className="glass-card">
          <BuilderHarness />
        </div>
      )}
    </div>
  );
}

export function ProductsHarness(props: ProductsHarnessProps) {
  return (
    <ProductsProvider>
      <ProductsHarnessInner {...props} />
    </ProductsProvider>
  );
}

export default ProductsHarness;
