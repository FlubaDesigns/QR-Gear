import { ProductsProvider } from "./ProductsContext";
import { ProductsControlBar } from "./modules/ProductsControlBar";
import { StoreChannelDropdownModule } from "./modules/StoreChannelDropdownModule";
import { MasterCatalogDebugModule } from "./modules/MasterCatalogDebugModule";
import { BuilderHarness } from "./builder/BuilderHarness";

interface ProductsHarnessProps {
  showHeader?: boolean;
  showBuilder?: boolean;
  showSync?: boolean;
}

function ProductsHarnessInner({
  showHeader = true,
  showBuilder = true,
  showSync = true,
}: ProductsHarnessProps) {
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

      {showSync && (
        <div className="glass-card">
          <ProductsControlBar />
        </div>
      )}

      <StoreChannelDropdownModule />

      <MasterCatalogDebugModule />

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
