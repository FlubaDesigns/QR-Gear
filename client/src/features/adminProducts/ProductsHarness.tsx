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
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            <p className="text-muted-foreground">
              Manage products, sync catalog, and configure pricing.
            </p>
          </div>
        </div>
      )}

      <FulfillmentPickerModule
        providers={providers}
        selectedProviders={selectedProviders}
        onSelectionChange={setSelectedProviders}
        productCount={productCount}
      />

      <StoreChannelDropdownModule />

      <BuilderHarness />
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
