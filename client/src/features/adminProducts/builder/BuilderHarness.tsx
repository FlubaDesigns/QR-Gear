import { useState } from "react";
import { BuilderProvider, useBuilderContext } from "./BuilderContext";
import { StateModule } from "./modules/StateModule";
import { ContentModule } from "./modules/ContentModule";
import { SaveOptionsModule, type SaveTarget } from "./modules/SaveOptionsModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import { useToast } from "@/hooks/use-toast";
import { useSaveProduct } from "./hooks/useSaveProduct";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
  const { saveAsTemplate, saveGraphics, saveAll } = useSaveProduct();

  const handleSaveTargetChange = async (target: SaveTarget) => {
    setSaveTarget(target);

    if (target === "template") {
      const builderState = {
        selectedProduct: state.selectedProduct,
        qrProductState: state.qrProductState,
        content: state.content,
        placements: ["front", "back"],
        artworkUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
        qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
        artworkVariant: "black" as const,
      };
      setSaveStatus({ type: "saving", message: "Saving template...", timestamp: new Date() });
      try {
        const result = await saveAsTemplate.mutateAsync(builderState);
        toast({
          title: "Template Saved",
          description: result.message,
        });
        setSaveStatus({ type: "success", message: result.message || "Template saved successfully", timestamp: new Date() });
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
      const builderState = {
        selectedProduct: state.selectedProduct,
        qrProductState: state.qrProductState,
        content: state.content,
        artworkUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
        qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
      };
      setSaveStatus({ type: "saving", message: "Saving graphics...", timestamp: new Date() });
      try {
        const result = await saveGraphics.mutateAsync(builderState);
        toast({
          title: "Graphics Saved",
          description: result.message,
        });
        setSaveStatus({ type: "success", message: result.message || "Graphics saved to library", timestamp: new Date() });
      } catch (error: any) {
        const errorMessage = error.message || "Could not save graphics";
        toast({
          title: "Save Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setSaveStatus({ type: "error", message: errorMessage, timestamp: new Date() });
      }
    } else if (target === "all") {
      const qrState = state.qrProductState as Record<string, any> | null;
      const productPackage: Record<string, any> = {
        productName: (state.selectedProduct as any)?.name || (state.selectedProduct as any)?.title || "Untitled Product",
        compositeUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
        qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
        qrContent: qrState?.url || qrState?.text || "",
      };
      
      setSaveStatus({ type: "saving", message: "Saving template and graphics...", timestamp: new Date() });
      try {
        const builderState = {
          selectedProduct: state.selectedProduct,
          qrProductState: state.qrProductState,
          content: state.content,
          placements: ["front", "back"],
          artworkUrl: productPackage.compositeUrl,
          qrOnlyUrl: productPackage.qrOnlyUrl,
          artworkVariant: "black" as const,
        };
        
        const templateResult = await saveAsTemplate.mutateAsync(builderState) as any;
        const graphicsResult = await saveGraphics.mutateAsync(builderState) as any;
        
        productPackage.templateId = templateResult.templateId;
        productPackage.graphicsId = graphicsResult.qrAssetId;
        
        sessionStorage.setItem("productPackage", JSON.stringify(productPackage));
        
        toast({
          title: "Saved! Ready for Store Assignment",
          description: "Go to Store Builder to assign to a store.",
        });
        setSaveStatus({ 
          type: "success", 
          message: "Package saved! Go to Store Builder to assign.", 
          timestamp: new Date() 
        });
      } catch (error: any) {
        const errorMessage = error.message || "Could not save";
        toast({
          title: "Save Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setSaveStatus({ type: "error", message: errorMessage, timestamp: new Date() });
      }
    }
  };

  return (
    <div className="space-y-4">
      <InlineDebugBoundary label="StateModule">
        <StateModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="ContentModule">
        <ContentModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="SaveOptionsModule">
        <SaveOptionsModule onSaveTargetChange={handleSaveTargetChange} />
      </InlineDebugBoundary>

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
