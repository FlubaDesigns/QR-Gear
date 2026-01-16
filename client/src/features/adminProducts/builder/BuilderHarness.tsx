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
import { useSaveProduct } from "./hooks/useSaveProduct";
import type { PartnerStore } from "@shared/schema";

function BuilderModules() {
  const { state } = useBuilderContext();
  const { toast } = useToast();
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);
  const { saveToStore, saveAsTemplate, saveAll, isSaving } = useSaveProduct();

  const showStoreModule = saveTarget === "store" || saveTarget === "all";

  const handleStoreSelect = async (store: PartnerStore, segment: string) => {
    const builderState = {
      selectedProduct: state.selectedProduct,
      qrProductState: state.qrProductState,
      content: state.content,
    };

    try {
      if (saveTarget === "all") {
        const results = await saveAll.mutateAsync({ store, segment, builderState });
        const allSuccess = results.every(r => r.success);
        toast({
          title: allSuccess ? "Saved Successfully" : "Partially Saved",
          description: results.map(r => r.message).join(" | "),
          variant: allSuccess ? "default" : "destructive",
        });
      } else {
        const result = await saveToStore.mutateAsync({ store, segment, builderState });
        toast({
          title: "Saved to Store",
          description: result.message,
        });
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "An error occurred while saving",
        variant: "destructive",
      });
    }
  };

  const handleSaveTargetChange = async (target: SaveTarget) => {
    setSaveTarget(target);

    if (target === "template") {
      const builderState = {
        selectedProduct: state.selectedProduct,
        qrProductState: state.qrProductState,
        content: state.content,
      };
      try {
        const result = await saveAsTemplate.mutateAsync(builderState);
        toast({
          title: "Template Saved",
          description: result.message,
        });
      } catch (error: any) {
        toast({
          title: "Save Failed",
          description: error.message || "Could not save template",
          variant: "destructive",
        });
      }
    } else if (target === "graphic-set") {
      toast({
        title: "Graphic Set",
        description: "Graphic set save coming soon",
      });
    }
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
        <SaveOptionsModule onSaveTargetChange={handleSaveTargetChange} />
      </InlineDebugBoundary>
      {showStoreModule && (
        <InlineDebugBoundary label="StoreModule">
          <StoreModule saveTarget={saveTarget} onStoreSelect={handleStoreSelect} isSaving={isSaving} />
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
