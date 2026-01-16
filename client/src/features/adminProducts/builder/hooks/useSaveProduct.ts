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
      const { selectedProduct, qrProductState, content } = builderState;
      
      const templateData = {
        name: content.title || `Template - ${new Date().toLocaleDateString()}`,
        description: content.description || "",
        category: qrProductState?.line || "General",
        thumbnailUrl: selectedProduct?.imageUrl || "",
        fullImageUrl: selectedProduct?.imageUrl || "",
        storageUrl: selectedProduct?.imageUrl || "",
        availableSizes: ["small", "medium", "large"],
        isActive: true,
      };

      const response = await apiRequest("POST", "/api/admin/templates", templateData);
      const result = await response.json();
      
      return {
        success: true,
        message: "Template saved to library",
        templateId: result.id,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] });
    },
  });

  const saveAllMutation = useMutation({
    mutationFn: async ({ store, channel, builderState }: SaveToStoreParams): Promise<SaveResult[]> => {
      const results: SaveResult[] = [];

      // Save as template
      try {
        const templateResult = await saveAsTemplateMutation.mutateAsync(builderState);
        results.push(templateResult);
      } catch (e: any) {
        results.push({ success: false, message: `Template failed: ${e.message}` });
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
    saveAll: saveAllMutation,
    isSaving: saveToStoreMutation.isPending || saveAsTemplateMutation.isPending || saveAllMutation.isPending,
  };
}
