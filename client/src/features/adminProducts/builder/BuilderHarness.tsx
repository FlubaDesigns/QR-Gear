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
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { PartnerStore } from "@shared/schema";

interface SaveStatus {
  type: "success" | "error" | "saving";
  message: string;
  timestamp: Date;
}

function BuilderModules() {
  const { state } = useBuilderContext();
  const { toast } = useToast();
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const { saveToStore, saveAsTemplate, saveAll, isSaving } = useSaveProduct();

  const showStoreModule = saveTarget === "store" || saveTarget === "all";

  const handleStoreSelect = async (store: PartnerStore, channel: string) => {
    const builderState = {
      selectedProduct: state.selectedProduct,
      qrProductState: state.qrProductState,
      content: state.content,
    };

    setSaveStatus({ type: "saving", message: "Saving...", timestamp: new Date() });

    try {
      if (saveTarget === "all") {
        const results = await saveAll.mutateAsync({ store, channel, builderState });
        const allSuccess = results.every(r => r.success);
        const message = results.map(r => r.message).join(" | ");
        toast({
          title: allSuccess ? "Saved Successfully" : "Partially Saved",
          description: message,
          variant: allSuccess ? "default" : "destructive",
        });
        setSaveStatus({ 
          type: allSuccess ? "success" : "error", 
          message: allSuccess ? `Saved to ${store.name} / ${channel}` : message, 
          timestamp: new Date() 
        });
      } else {
        const result = await saveToStore.mutateAsync({ store, channel, builderState });
        toast({
          title: "Saved to Store",
          description: result.message,
        });
        setSaveStatus({ 
          type: "success", 
          message: `Saved to ${store.name} / ${channel}`, 
          timestamp: new Date() 
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || "An error occurred while saving";
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setSaveStatus({ type: "error", message: errorMessage, timestamp: new Date() });
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
      setSaveStatus({ type: "saving", message: "Saving template...", timestamp: new Date() });
      try {
        const result = await saveAsTemplate.mutateAsync(builderState);
        toast({
          title: "Template Saved",
          description: result.message,
        });
        setSaveStatus({ type: "success", message: "Template saved successfully", timestamp: new Date() });
      } catch (error: any) {
        const errorMessage = error.message || "Could not save template";
        toast({
          title: "Save Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setSaveStatus({ type: "error", message: errorMessage, timestamp: new Date() });
      }
    } else if (target === "graphic-set") {
      toast({
        title: "Graphic Set",
        description: "Graphic set save coming soon",
      });
      setSaveStatus({ type: "success", message: "Graphic set feature coming soon", timestamp: new Date() });
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

      {saveStatus && (
        <div 
          className={`p-3 rounded-md border flex items-center gap-2 ${
            saveStatus.type === "success" 
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200" 
              : saveStatus.type === "error" 
                ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200" 
                : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200"
          }`}
          data-testid="save-status"
        >
          {saveStatus.type === "success" && <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
          {saveStatus.type === "error" && <XCircle className="h-5 w-5 flex-shrink-0" />}
          {saveStatus.type === "saving" && <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />}
          <span className="text-sm font-medium">{saveStatus.message}</span>
          <span className="text-xs ml-auto opacity-70">
            {saveStatus.timestamp.toLocaleTimeString()}
          </span>
        </div>
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
