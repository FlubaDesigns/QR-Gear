import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductsProvider, useProductsContext } from "./ProductsContext";
import { StoreChannelDropdownModule } from "./modules/StoreChannelDropdownModule";
import { BuilderHarness } from "./builder/BuilderHarness";
import { CatalogListModule } from "./modules/CatalogListModule";
import { ProductChooserModule } from "./modules/ProductChooserModule";
import type { ProductSelectItem } from "@/features/shared/components/skins/ProductSelectCardSkin";
import type { Product } from "./shared/types";

interface ProductsHarnessProps {
  showHeader?: boolean;
  showCatalog?: boolean;
  showChooser?: boolean;
  showBuilder?: boolean;
  showSync?: boolean;
  onProductSelected?: (productId: string, product: ProductSelectItem) => void;
}

function ProductsHarnessInner({
  showHeader = true,
  showCatalog = true,
  showChooser = false,
  showBuilder = true,
  showSync = true,
  onProductSelected,
}: ProductsHarnessProps) {
  const { api, selectedProviders } = useProductsContext();

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

      <StoreChannelDropdownModule />

      {showChooser && filteredProducts.length > 0 && (
        <div className="glass-card">
          <ProductChooserModule
            products={filteredProducts}
            onProductSelected={onProductSelected}
            showControlBar={showSync}
          />
        </div>
      )}

      {showCatalog && !showChooser && filteredProducts.length > 0 && (
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
