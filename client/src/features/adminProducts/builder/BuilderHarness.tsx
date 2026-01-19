import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { BuilderProvider, useBuilderContext } from "./BuilderContext";
import { StateModule } from "./modules/StateModule";
import { PlacementModule } from "./modules/PlacementModule";
import { URLContentModule } from "./modules/URLContentModule";
import { PlayContentModule } from "./modules/PlayContentModule";
import { PreviewModule } from "./modules/PreviewModule";
import { CreateGraphicsModule } from "./modules/CreateGraphicsModule";
import { PricingModule } from "./modules/PricingModule";
import { SaveOptionsModule, type SaveTarget } from "./modules/SaveOptionsModule";
import { InlineDebugBoundary } from "@/debug/InlineDebugBoundary";
import { useToast } from "@/hooks/use-toast";
import { useSaveProduct } from "./hooks/useSaveProduct";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { PricingBreakdown } from "./types";

interface SaveStatus {
  type: "success" | "error" | "saving";
  message: string;
  timestamp: Date;
}

function BuilderModules() {
  const { state } = useBuilderContext();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [currentPricing, setCurrentPricing] = useState<PricingBreakdown | null>(null);
  const { saveAsTemplate, saveGraphics } = useSaveProduct();

  const handlePricingCalculated = useCallback((pricing: PricingBreakdown | null) => {
    setCurrentPricing(pricing);
  }, []);

  const storePackageAndNavigate = () => {
    const productPackage = {
      productName: state.selectedProduct?.title || "Untitled Product",
      qrContent: state.content?.url || state.content?.title || "",
      compositeUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
      qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
      pricing: currentPricing,
    };
    sessionStorage.setItem("productPackage", JSON.stringify(productPackage));
    navigate("/test-store-builder");
  };

  const handleSaveTargetChange = async (target: SaveTarget) => {
    if (target === "store") {
      storePackageAndNavigate();
      return;
    }

    if (target === "template") {
      const builderState = {
        selectedProduct: state.selectedProduct,
        qrProductState: state.qrProductState,
        content: state.content,
        placements: (state.selectedPlacements || []).length > 0 ? state.selectedPlacements : ["front-chest"],
        artworkUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
        qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
        artworkVariant: "black" as const,
        pricing: currentPricing,
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
    }

    if (target === "graphic-set") {
      const builderState = {
        selectedProduct: state.selectedProduct,
        qrProductState: state.qrProductState,
        content: state.content,
        placements: (state.selectedPlacements || []).length > 0 ? state.selectedPlacements : ["front-chest"],
        artworkUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
        qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
        artworkVariant: "black" as const,
        pricing: currentPricing,
      };
      setSaveStatus({ type: "saving", message: "Saving graphics...", timestamp: new Date() });
      try {
        const result = await saveGraphics.mutateAsync(builderState);
        toast({
          title: "Graphics Saved",
          description: result.message,
        });
        setSaveStatus({ type: "success", message: result.message || "Graphics saved successfully", timestamp: new Date() });
      } catch (error: any) {
        const errorMessage = error.message || "Could not save graphics";
        toast({
          title: "Save Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setSaveStatus({ type: "error", message: errorMessage, timestamp: new Date() });
      }
    }

    if (target === "all") {
      const builderState = {
        selectedProduct: state.selectedProduct,
        qrProductState: state.qrProductState,
        content: state.content,
        placements: (state.selectedPlacements || []).length > 0 ? state.selectedPlacements : ["front-chest"],
        artworkUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
        qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
        artworkVariant: "black" as const,
        pricing: currentPricing,
      };
      setSaveStatus({ type: "saving", message: "Saving all...", timestamp: new Date() });
      try {
        const [templateResult, graphicsResult] = await Promise.all([
          saveAsTemplate.mutateAsync(builderState),
          saveGraphics.mutateAsync(builderState),
        ]);
        
        const productPackage = {
          templateId: templateResult.templateId,
          graphicsId: graphicsResult.compositeAssetId || graphicsResult.qrAssetId,
          productName: state.selectedProduct?.title || "Untitled Product",
          qrContent: state.content?.url || state.content?.title || "",
          compositeUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
          qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
          pricing: currentPricing,
        };
        sessionStorage.setItem("productPackage", JSON.stringify(productPackage));
        
        toast({
          title: "Saved Successfully",
          description: "Template and graphics saved. Going to store assignment...",
        });
        setSaveStatus({ type: "success", message: "Saved! Redirecting...", timestamp: new Date() });
        
        setTimeout(() => navigate("/test-store-builder"), 500);
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
    <div className="mobile-compact-stack">
      {/* Step 1: Product Type & QR State Selection */}
      <InlineDebugBoundary label="StateModule">
        <StateModule />
      </InlineDebugBoundary>
      
      {/* Step 2: Placement Selection */}
      <InlineDebugBoundary label="PlacementModule">
        <PlacementModule />
      </InlineDebugBoundary>
      
      {/* Step 3: URL Settings (Background, Title, Description, Top/Bottom Text) */}
      <InlineDebugBoundary label="URLContentModule">
        <URLContentModule />
      </InlineDebugBoundary>
      
      {/* Step 4: Play Media (for QR Play mode) */}
      <InlineDebugBoundary label="PlayContentModule">
        <PlayContentModule />
      </InlineDebugBoundary>
      
      {/* Step 6: Live Preview */}
      <InlineDebugBoundary label="PreviewModule">
        <PreviewModule />
      </InlineDebugBoundary>
      
      {/* Step 7: Create Graphics (generates QR, composite, calculates pricing) */}
      <InlineDebugBoundary label="CreateGraphicsModule">
        <CreateGraphicsModule />
      </InlineDebugBoundary>
      
      {/* Step 8: Pricing Breakdown */}
      <InlineDebugBoundary label="PricingModule">
        <PricingModule onPricingCalculated={handlePricingCalculated} />
      </InlineDebugBoundary>
      
      {/* Step 9: Save Options */}
      <InlineDebugBoundary label="SaveOptionsModule">
        <SaveOptionsModule onSaveTargetChange={handleSaveTargetChange} />
      </InlineDebugBoundary>

      {/* Save Status Indicator */}
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
