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
  segment: string;
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
    mutationFn: async ({ store, segment, builderState }: SaveToStoreParams): Promise<SaveResult> => {
      const { selectedProduct, qrProductState, content } = builderState;
      
      if (!selectedProduct?.id) {
        throw new Error("No product selected");
      }

      // Add product to partner store
      const currentProducts = await fetch(`/api/admin/partner-stores/${store.id}/products`)
        .then(r => r.json());
      
      const existingProductIds = currentProducts.map((p: any) => p.productId);
      
      // Add this product if not already in store
      if (!existingProductIds.includes(selectedProduct.id)) {
        await apiRequest("POST", `/api/admin/partner-stores/${store.id}/products`, {
          productIds: [...existingProductIds, selectedProduct.id],
        });
      }

      return {
        success: true,
        message: `Saved to ${store.name} → ${segment}`,
        productId: selectedProduct.id,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/partner-stores"] });
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
    mutationFn: async ({ store, segment, builderState }: SaveToStoreParams): Promise<SaveResult[]> => {
      const results: SaveResult[] = [];

      // Save as template
      try {
        const templateResult = await saveAsTemplateMutation.mutateAsync(builderState);
        results.push(templateResult);
      } catch (e: any) {
        results.push({ success: false, message: `Template: ${e.message}` });
      }

      // Save to store
      try {
        const storeResult = await saveToStoreMutation.mutateAsync({ store, segment, builderState });
        results.push(storeResult);
      } catch (e: any) {
        results.push({ success: false, message: `Store: ${e.message}` });
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
