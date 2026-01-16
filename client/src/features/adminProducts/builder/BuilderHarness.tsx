import { useState } from "react";
import { BuilderProvider, useBuilderContext } from "./BuilderContext";
import { FulfillmentModule } from "./modules/FulfillmentModule";
import { CategoryModule } from "./modules/CategoryModule";
import { ProductsModule } from "./modules/ProductsModule";
import { StateModule } from "./modules/StateModule";
import { ContentModule } from "./modules/ContentModule";
import { SaveOptionsModule, type SaveTarget } from "./modules/SaveOptionsModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";

function BuilderModules() {
  const { state } = useBuilderContext();
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);

  const showStoreModule = saveTarget === "store" || saveTarget === "all";

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
      <InlineDebugBoundary label="StateModule">
        <StateModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="ContentModule">
        <ContentModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="SaveOptionsModule">
        <SaveOptionsModule onSaveTargetChange={setSaveTarget} />
      </InlineDebugBoundary>
      {showStoreModule && (
        <InlineDebugBoundary label="StoreModule">
          <div className="p-4 bg-muted/30 rounded-lg border text-center">
            <p className="text-sm text-muted-foreground">StoreModule coming in Stage 2...</p>
          </div>
        </InlineDebugBoundary>
      )}
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
