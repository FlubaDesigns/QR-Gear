import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { BuilderProvider, useBuilderContext } from "./BuilderContext";
import { StateModule } from "./modules/StateModule";
import { ContentModule } from "./modules/ContentModule";
import { BackgroundPickerModule } from "./modules/BackgroundPickerModule";
import { PlacementModule } from "./modules/PlacementModule";
import { TextConfigModule } from "./modules/TextConfigModule";
import { PreviewModule } from "./modules/PreviewModule";
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
  const [location, navigate] = useLocation();
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [currentPricing, setCurrentPricing] = useState<PricingBreakdown | null>(null);
  const { saveAsTemplate, saveGraphics, saveAsTemplateWithOptions, saveGraphicsWithOptions } = useSaveProduct();
  
  // Use test endpoints when on /test-products page
  const useTestEndpoints = location.startsWith("/test-products");

  const handlePricingCalculated = useCallback((pricing: PricingBreakdown | null) => {
    setCurrentPricing(pricing);
  }, []);

  const storePackageAndNavigate = () => {
    const productPackage = {
      productName: state.selectedProduct?.title || "Untitled Product",
      qrContent: state.content.url || state.content.title || "",
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
        const result = useTestEndpoints 
          ? await saveAsTemplateWithOptions(builderState, true)
          : await saveAsTemplate.mutateAsync(builderState);
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
        pricing: currentPricing,
      };
      setSaveStatus({ type: "saving", message: "Saving graphics...", timestamp: new Date() });
      try {
        const result = useTestEndpoints
          ? await saveGraphicsWithOptions(builderState, true)
          : await saveGraphics.mutateAsync(builderState);
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
      
      const results: { template?: any; graphics?: any; errors: string[] } = { errors: [] };
      
      // Save template first
      try {
        results.template = useTestEndpoints 
          ? await saveAsTemplateWithOptions(builderState, true)
          : await saveAsTemplate.mutateAsync(builderState);
      } catch (error: any) {
        results.errors.push(`Template: ${error.message}`);
      }
      
      // Save graphics (skip if no artwork available)
      const hasArtwork = builderState.artworkUrl || builderState.qrOnlyUrl;
      if (hasArtwork) {
        try {
          results.graphics = useTestEndpoints
            ? await saveGraphicsWithOptions(builderState, true)
            : await saveGraphics.mutateAsync(builderState);
        } catch (error: any) {
          results.errors.push(`Graphics: ${error.message}`);
        }
      }
      
      // Check results
      if (results.template || results.graphics) {
        const productPackage = {
          templateId: results.template?.templateId,
          graphicsId: results.graphics?.compositeAssetId || results.graphics?.qrAssetId,
          productName: state.selectedProduct?.title || "Untitled Product",
          qrContent: state.content.url || state.content.title || "",
          compositeUrl: state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "",
          qrOnlyUrl: state.loadedGraphic?.qrOnlyUrl || "",
          pricing: currentPricing,
        };
        sessionStorage.setItem("productPackage", JSON.stringify(productPackage));
        
        const successMsg = results.errors.length > 0 
          ? `Saved with warnings: ${results.errors.join("; ")}` 
          : "Template and graphics saved!";
        
        toast({
          title: results.errors.length > 0 ? "Partially Saved" : "Saved Successfully",
          description: successMsg,
          variant: results.errors.length > 0 ? "default" : "default",
        });
        setSaveStatus({ type: "success", message: successMsg, timestamp: new Date() });
        
        setTimeout(() => navigate("/test-store-builder"), 500);
      } else {
        const errorMessage = results.errors.join("; ") || "Could not save";
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
      <InlineDebugBoundary label="PlacementModule">
        <PlacementModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="ContentModule">
        <ContentModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="TextConfigModule">
        <TextConfigModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="BackgroundPickerModule">
        <BackgroundPickerModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="PreviewModule">
        <PreviewModule />
      </InlineDebugBoundary>
      <InlineDebugBoundary label="PricingModule">
        <PricingModule onPricingCalculated={handlePricingCalculated} />
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
