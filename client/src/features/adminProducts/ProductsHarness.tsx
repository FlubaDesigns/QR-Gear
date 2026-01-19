import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductsProvider, useProductsContext } from "./ProductsContext";
import { FulfillmentPickerModule } from "./modules/FulfillmentPickerModule";
import { StoreChannelDropdownModule } from "./modules/StoreChannelDropdownModule";
import { BuilderHarness } from "./builder/BuilderHarness";
import type { Product } from "./shared/types";

interface ProductsHarnessProps {
  showHeader?: boolean;
}

function ProductsHarnessInner({ showHeader = true }: ProductsHarnessProps) {
  const { 
    api, 
    providers, 
    selectedProviders, 
    setSelectedProviders,
  } = useProductsContext();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: api.getQueryKey("all"),
    queryFn: api.fetchProducts,
  });

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
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

      <StoreChannelDropdownModule />

      <div className="glass-card">
        <BuilderHarness />
      </div>
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
