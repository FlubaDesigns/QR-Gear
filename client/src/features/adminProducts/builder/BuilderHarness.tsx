import { useState } from "react";
import { BuilderProvider, useBuilderContext } from "./BuilderContext";
import { FulfillmentModule } from "./modules/FulfillmentModule";
import { CategoryModule } from "./modules/CategoryModule";
import { ProductsModule } from "./modules/ProductsModule";
import { StateModule } from "./modules/StateModule";
import { ContentModule } from "./modules/ContentModule";
import { SaveOptionsModule, type SaveTarget } from "./modules/SaveOptionsModule";
import { StoreModule } from "./modules/StoreModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import { useToast } from "@/hooks/use-toast";
import type { PartnerStore } from "@shared/schema";

function BuilderModules() {
  const { state } = useBuilderContext();
  const { toast } = useToast();
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);

  const showStoreModule = saveTarget === "store" || saveTarget === "all";

  const handleStoreSelect = (store: PartnerStore, segment: string) => {
    toast({
      title: "Store Selected",
      description: `Ready to save to ${store.name} → ${segment}. Save logic coming in Stage 4.`,
    });
  };

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
          <StoreModule saveTarget={saveTarget} onStoreSelect={handleStoreSelect} />
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
