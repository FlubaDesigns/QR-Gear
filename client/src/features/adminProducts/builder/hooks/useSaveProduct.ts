import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PartnerStore } from "@shared/schema";

interface PricingData {
  baseProductCost: number;
  placementCost: number;
  textUpcharge: number;
  hostingCost: number;
  subtotal: number;
  markupAmount: number;
  customerPrice: number;
  hostingTierCode: string;
}

interface BuilderState {
  selectedProduct: any;
  qrProductState: any;
  content: {
    url?: string;
    title?: string;
    description?: string;
  };
  colors?: Array<{ name: string; hex: string }>;
  placements?: string[];
  artworkUrl?: string;
  qrOnlyUrl?: string;
  artworkVariant?: "black" | "white";
  pricing?: PricingData | null;
}

interface SaveToStoreParams {
  store: PartnerStore;
  channel: string;
  builderState: BuilderState;
  useTestEndpoints?: boolean;
}

interface SaveResult {
  success: boolean;
  message: string;
  templateId?: string;
  productId?: string;
  jobsQueued?: number;
  qrAssetId?: string;
  compositeAssetId?: string;
}

export function useSaveProduct() {
  const queryClient = useQueryClient();

  // Helper to invalidate both admin + test library keys so whichever surface is open updates
  const invalidateLibrary = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/library-assets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/test/library-assets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
    queryClient.invalidateQueries({ queryKey: ["/api/test/templates"] });
  };

  const saveToStoreMutation = useMutation({
    mutationFn: async ({ store, channel, builderState }: SaveToStoreParams): Promise<SaveResult> => {
      const { selectedProduct, qrProductState, content } = builderState;
      
      if (!selectedProduct?.id) {
        throw new Error("No product selected");
      }

      // Get current products in store
      const currentProductsRes = await fetch(`/api/admin/partner-stores/${store.id}/products`);
      if (!currentProductsRes.ok) {
        throw new Error("Failed to fetch store products");
      }
      const currentProducts = await currentProductsRes.json();
      const existingProductIds = currentProducts.map((p: any) => p.productId);
      
      // Add this product if not already in store
      if (!existingProductIds.includes(selectedProduct.id)) {
        const syncRes = await apiRequest("POST", `/api/admin/partner-stores/${store.id}/products`, {
          productIds: [...existingProductIds, selectedProduct.id],
        });
        if (!syncRes.ok) {
          throw new Error("Failed to add product to store");
        }
      }

      // Update product's channel assignment
      const updateRes = await apiRequest("PUT", `/api/admin/products/${selectedProduct.id}`, {
        segment: channel,
        storeType: store.isInternal ? "Internal" : "External",
        storeName: store.name,
      });
      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update product channel");
      }

      return {
        success: true,
        message: `Added to ${store.name} → ${channel}`,
        productId: selectedProduct.id,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
  });

  const saveAsTemplate = async (builderState: BuilderState, useTestEndpoints = false): Promise<SaveResult> => {
    const { selectedProduct, qrProductState, content, colors, placements, artworkUrl, artworkVariant } = builderState;
    
    if (!selectedProduct?.id) {
      throw new Error("No product selected");
    }

    // Use full-save endpoint for batch mockup generation
    const pricing = (builderState as any).pricing;
    const templateData = {
      name: content.title || `Template - ${new Date().toLocaleDateString()}`,
      description: content.description || "",
      category: qrProductState?.line || "General",
      productId: selectedProduct.id,
      blueprintId: selectedProduct.blueprintId || 0,
      printProviderId: selectedProduct.printProviderId || 0,
      colors: colors || [],
      placements: placements || ["front"],
      qrSizes: ["small", "medium", "large"] as const,
      artworkUrl: artworkUrl || selectedProduct?.imageUrl || "",
      artworkVariant: artworkVariant || "black",
      thumbnailUrl: selectedProduct?.imageUrl || "",
      qrContent: content.url || "",
      pricing: pricing || null,
    };

    const endpoint = useTestEndpoints 
      ? "/api/test/templates/full-save" 
      : "/api/admin/templates/full-save";
    const response = await apiRequest("POST", endpoint, templateData);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to save template");
    }
    
    invalidateLibrary();
    
    return {
      success: true,
      message: `Template created with ${result.jobsQueued || 0} mockups queued`,
      templateId: result.template?.id,
      jobsQueued: result.jobsQueued,
    };
  };

  const saveAsTemplateMutation = useMutation({
    mutationFn: async (builderState: BuilderState): Promise<SaveResult> => {
      return saveAsTemplate(builderState, false);
    },
    onSuccess: () => {
      invalidateLibrary();
    },
  });

  const saveGraphics = async (builderState: BuilderState, useTestEndpoints = false): Promise<SaveResult> => {
    const { content, qrProductState, artworkUrl, qrOnlyUrl: qrOnlyUrlFromState } = builderState;
    
    const qrOnlyUrl = qrOnlyUrlFromState || "";
    const compositeUrl = artworkUrl || "";
    
    // At least one URL is required
    if (!qrOnlyUrl && !compositeUrl) {
      throw new Error("No graphic to save - generate a QR code first");
    }

    const graphicsPricing = (builderState as any).pricing;
    const graphicsData = {
      name: content.title || `Graphic - ${new Date().toLocaleDateString()}`,
      description: content.description || "",
      category: qrProductState?.line || "General",
      qrOnlyUrl: qrOnlyUrl,
      compositeUrl: compositeUrl,
      qrContent: content.url || "",
      pricing: graphicsPricing || null,
    };

    const endpoint = useTestEndpoints 
      ? "/api/test/graphics/save" 
      : "/api/admin/graphics/save";
    const response = await apiRequest("POST", endpoint, graphicsData);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || "Failed to save graphics");
    }
    
    invalidateLibrary();
    
    return {
      success: true,
      message: "Graphics saved to library",
      qrAssetId: result.qrAssetId || result.qrAsset?.id,
      compositeAssetId: result.compositeAssetId || result.compositeAsset?.id,
    };
  };

  const saveGraphicsMutation = useMutation({
    mutationFn: async (builderState: BuilderState): Promise<SaveResult> => {
      return saveGraphics(builderState, false);
    },
    onSuccess: () => {
      invalidateLibrary();
    },
  });

  const saveAllMutation = useMutation({
    mutationFn: async ({ store, channel, builderState, useTestEndpoints = false }: SaveToStoreParams): Promise<SaveResult[]> => {
      const results: SaveResult[] = [];

      // Save as template (includes batch mockup generation)
      try {
        const templateResult = await saveAsTemplate(builderState, useTestEndpoints);
        results.push(templateResult);
      } catch (e: any) {
        results.push({ success: false, message: `Template failed: ${e.message}` });
      }

      // Save graphics (QR-only and composite)
      try {
        const graphicsResult = await saveGraphics(builderState, useTestEndpoints);
        results.push(graphicsResult);
      } catch (e: any) {
        results.push({ success: false, message: `Graphics failed: ${e.message}` });
      }

      // Save to store with channel (admin only, skip in test mode)
      if (!useTestEndpoints) {
        try {
          const storeResult = await saveToStoreMutation.mutateAsync({ store, channel, builderState });
          results.push(storeResult);
        } catch (e: any) {
          results.push({ success: false, message: `Store failed: ${e.message}` });
        }
      }

      // Check if all failed
      const allFailed = results.every(r => !r.success);
      if (allFailed) {
        throw new Error(results.map(r => r.message).join("; "));
      }

      return results;
    },
  });

  return {
    saveToStore: saveToStoreMutation,
    saveAsTemplate: saveAsTemplateMutation,
    saveGraphics: saveGraphicsMutation,
    saveAll: saveAllMutation,
    // Direct functions for test mode
    saveAsTemplateWithOptions: saveAsTemplate,
    saveGraphicsWithOptions: saveGraphics,
    isSaving: saveToStoreMutation.isPending || saveAsTemplateMutation.isPending || saveGraphicsMutation.isPending || saveAllMutation.isPending,
  };
}
