import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { authFetch } from "@/features/adminAuth/authFetch";
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

interface TextStyleConfig {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  warpPreset: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset: number;
  horizontalOffset: number;
}

interface BuilderState {
  selectedProduct: any;
  qrProductState: any;
  content: {
    url?: string;
    title?: string;
    description?: string;
    titleStyle?: TextStyleConfig;
    descriptionStyle?: TextStyleConfig;
  };
  colors?: Array<{ name: string; hex: string }>;
  placements?: string[];
  placementMethods?: Record<string, string>;
  artworkUrl?: string;
  qrOnlyUrl?: string;
  artworkVariant?: "black" | "white";
  pricing?: PricingData | null;
}

interface SaveToStoreParams {
  store: PartnerStore;
  channel: string;
  builderState: BuilderState;
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
  const { apiBase, getAuthHeaders } = useAdminAuth();

  const invalidateLibrary = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/library-assets"] });
    queryClient.invalidateQueries({ queryKey: [`${apiBase}/library-assets`] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
    queryClient.invalidateQueries({ queryKey: [`${apiBase}/templates`] });
  };

  const saveToStoreMutation = useMutation({
    mutationFn: async ({ store, channel, builderState }: SaveToStoreParams): Promise<SaveResult> => {
      const { selectedProduct, qrProductState, content } = builderState;
      
      if (!selectedProduct?.id) {
        throw new Error("No product selected");
      }

      const currentProductsRes = await authFetch(`${apiBase}/partner-stores/${store.id}/products`, getAuthHeaders);
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

  const saveAsTemplate = async (builderState: BuilderState): Promise<SaveResult> => {
    const { selectedProduct, qrProductState, content, colors, placements, artworkUrl, artworkVariant, placementMethods } = builderState;
    
    if (!selectedProduct?.id) {
      throw new Error("No product selected");
    }

    // Use full-save endpoint for batch mockup generation
    const pricing = (builderState as any).pricing;
    const titleText = content.titleStyle?.text || content.title || "";
    const descText = content.descriptionStyle?.text || content.description || "";
    const templateData = {
      name: titleText || `Template - ${new Date().toLocaleDateString()}`,
      description: descText,
      category: qrProductState?.line || "General",
      productId: selectedProduct.id,
      blueprintId: selectedProduct.blueprintId || 0,
      printProviderId: selectedProduct.printProviderId || 0,
      colors: colors || [],
      placements: placements || ["front"],
      placementMethods: placementMethods || {},
      qrSizes: ["small", "medium", "large"] as const,
      artworkUrl: artworkUrl || "",
      artworkVariant: artworkVariant || "black",
      thumbnailUrl: artworkUrl || "",
      qrContent: content.url || "",
      pricing: pricing || null,
    };

    const response = await apiRequest("POST", "/api/admin/templates/full-save", templateData);
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
      return saveAsTemplate(builderState);
    },
    onSuccess: () => {
      invalidateLibrary();
    },
  });

  const saveGraphics = async (builderState: BuilderState): Promise<SaveResult> => {
    const { content, qrProductState, artworkUrl, qrOnlyUrl: qrOnlyUrlFromState } = builderState;
    
    const qrOnlyUrl = qrOnlyUrlFromState || "";
    const compositeUrl = artworkUrl || "";
    
    // URLs are generated after packet creation, so no validation here

    const graphicsPricing = (builderState as any).pricing;
    const gfxTitleText = content.titleStyle?.text || content.title || "";
    const gfxDescText = content.descriptionStyle?.text || content.description || "";
    const graphicsData = {
      name: gfxTitleText || `Graphic - ${new Date().toLocaleDateString()}`,
      description: gfxDescText,
      category: qrProductState?.line || "General",
      qrOnlyUrl: qrOnlyUrl,
      compositeUrl: compositeUrl,
      qrContent: content.url || "",
      pricing: graphicsPricing || null,
    };

    const response = await apiRequest("POST", "/api/admin/graphics/save", graphicsData);
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
      return saveGraphics(builderState);
    },
    onSuccess: () => {
      invalidateLibrary();
    },
  });

  const saveAllMutation = useMutation({
    mutationFn: async ({ store, channel, builderState }: SaveToStoreParams): Promise<SaveResult[]> => {
      const results: SaveResult[] = [];

      try {
        const templateResult = await saveAsTemplate(builderState);
        results.push(templateResult);
      } catch (e: any) {
        results.push({ success: false, message: `Template failed: ${e.message}` });
      }

      try {
        const graphicsResult = await saveGraphics(builderState);
        results.push(graphicsResult);
      } catch (e: any) {
        results.push({ success: false, message: `Graphics failed: ${e.message}` });
      }

      try {
        const storeResult = await saveToStoreMutation.mutateAsync({ store, channel, builderState });
        results.push(storeResult);
      } catch (e: any) {
        results.push({ success: false, message: `Store failed: ${e.message}` });
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
    saveAsTemplateWithOptions: saveAsTemplate,
    saveGraphicsWithOptions: saveGraphics,
    isSaving: saveToStoreMutation.isPending || saveAsTemplateMutation.isPending || saveGraphicsMutation.isPending || saveAllMutation.isPending,
  };
}
