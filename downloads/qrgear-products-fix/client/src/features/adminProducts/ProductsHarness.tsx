import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductsProvider, useProductsContext } from "./ProductsContext";
import { FulfillmentPickerModule } from "./modules/FulfillmentPickerModule";
import { StoreChannelDropdownModule } from "./modules/StoreChannelDropdownModule";
import { SyncModule } from "./modules/SyncModule";
import { BuilderHarness } from "./builder/BuilderHarness";
import { CatalogListModule } from "./modules/CatalogListModule";
import type { Product } from "./shared/types";

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
        <div className="glass-card">
          <CatalogListModule products={filteredProducts} />
        </div>
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
