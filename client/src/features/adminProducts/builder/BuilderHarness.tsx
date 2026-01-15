import { BuilderProvider, useBuilderContext } from "./BuilderContext";
import { FulfillmentModule } from "./modules/FulfillmentModule";
import { CategoryModule } from "./modules/CategoryModule";
import { ProductsModule } from "./modules/ProductsModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";

function BuilderModules() {
  const { state } = useBuilderContext();
  
  console.log("DEBUG STATE SNAPSHOT", {
    sourceType: state?.sourceType,
    fulfillment: state?.fulfillmentProvider,
    category: state?.category,
    selectedProduct: state?.selectedProduct?.title,
    originFilter: state?.originFilter,
    genderFilter: state?.genderFilter,
  });

  return (
    <div className="space-y-4">
      <InlineDebugBoundary label="FulfillmentModule">
        <FulfillmentModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="CategoryModule">
        <CategoryModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="ProductsModule">
        <ProductsModule />
      </InlineDebugBoundary>
    </div>
  );
}

export function BuilderHarness() {
  return (
    <BuilderProvider>
      <InlineDebugBoundary label="BuilderModules">
        <BuilderModules />
      </InlineDebugBoundary>
    </BuilderProvider>
  );
}
