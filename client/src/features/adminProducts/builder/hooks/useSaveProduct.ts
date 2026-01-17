import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PartnerStore } from "@shared/schema";

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
}

export function useSaveProduct() {
  const queryClient = useQueryClient();

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

  const saveAsTemplateMutation = useMutation({
    mutationFn: async (builderState: BuilderState): Promise<SaveResult> => {
      const { selectedProduct, qrProductState, content, colors, placements, artworkUrl, artworkVariant } = builderState;
      
      if (!selectedProduct?.id) {
        throw new Error("No product selected");
      }

      // Use full-save endpoint for batch mockup generation
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
      };

      const response = await apiRequest("POST", "/api/admin/templates/full-save", templateData);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to save template");
      }
      
      return {
        success: true,
        message: `Template created with ${result.jobsQueued || 0} mockups queued`,
        templateId: result.template?.id,
        jobsQueued: result.jobsQueued,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
    },
  });

  const saveGraphicsMutation = useMutation({
    mutationFn: async (builderState: BuilderState): Promise<SaveResult> => {
      const { content, qrProductState, artworkUrl, qrOnlyUrl: qrOnlyUrlFromState } = builderState;
      
      const qrOnlyUrl = qrOnlyUrlFromState || artworkUrl || "";
      const compositeUrl = artworkUrl || "";
      
      if (!compositeUrl) {
        throw new Error("No graphic to save");
      }

      const graphicsData = {
        name: content.title || `Graphic - ${new Date().toLocaleDateString()}`,
        description: content.description || "",
        category: qrProductState?.line || "General",
        qrOnlyUrl: qrOnlyUrl,
        compositeUrl: compositeUrl,
      };

      const response = await apiRequest("POST", "/api/admin/graphics/save", graphicsData);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to save graphics");
      }
      
      return {
        success: true,
        message: "Graphics saved to library",
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/library-assets"] });
    },
  });

  const saveAllMutation = useMutation({
    mutationFn: async ({ store, channel, builderState }: SaveToStoreParams): Promise<SaveResult[]> => {
      const results: SaveResult[] = [];

      // Save as template (includes batch mockup generation)
      try {
        const templateResult = await saveAsTemplateMutation.mutateAsync(builderState);
        results.push(templateResult);
      } catch (e: any) {
        results.push({ success: false, message: `Template failed: ${e.message}` });
      }

      // Save graphics (QR-only and composite)
      try {
        const graphicsResult = await saveGraphicsMutation.mutateAsync(builderState);
        results.push(graphicsResult);
      } catch (e: any) {
        results.push({ success: false, message: `Graphics failed: ${e.message}` });
      }

      // Save to store with channel
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
    isSaving: saveToStoreMutation.isPending || saveAsTemplateMutation.isPending || saveGraphicsMutation.isPending || saveAllMutation.isPending,
  };
}
