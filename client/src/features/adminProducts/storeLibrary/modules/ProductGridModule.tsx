import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { 
  StoreProductSkin, 
  StoreProductItem,
  StoreProductViewToggle,
  StoreProductViewLayout 
} from "@/features/shared/components/skins/StoreProductSkin";
import { useStoreLibraryContext, ProductInfo } from "../StoreLibraryContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useState } from "react";

function productToSkinItem(product: ProductInfo): StoreProductItem {
  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl || "",
    subtitle: product.baseProductId ? `Product: ${product.baseProductId}` : undefined,
    colorCount: product.enabledColors?.length,
    sizes: product.enabledSizes,
  };
}

export function ProductGridModule() {
  const [viewLayout, setViewLayout] = useState<StoreProductViewLayout>("grid");
  const { 
    selectedStore, 
    selectedChannel, 
    selectedProducts,
    addToSelection,
    removeFromSelection 
  } = useStoreLibraryContext();
  const { apiBase } = useAdminAuth();

  const { data: products = [], isLoading, error } = useQuery<ProductInfo[]>({
    queryKey: [`${apiBase}/stores/${selectedStore?.id}/channels/${selectedChannel?.name}/products`],
    enabled: !!selectedStore && !!selectedChannel?.name,
  });

  if (!selectedStore || !selectedChannel) {
    return null;
  }

  const selectedIds = new Set(selectedProducts.map(p => p.id));

  const handleSelect = (item: StoreProductItem) => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;
    
    if (selectedIds.has(product.id)) {
      removeFromSelection(product.id);
    } else {
      addToSelection(product);
    }
  };

  const skinItems = products.map(productToSkinItem);

  const viewToggle = (
    <StoreProductViewToggle layout={viewLayout} onChange={setViewLayout} />
  );

  return (
    <CollapsibleModule
      title="Products"
      badge={products.length > 0 ? `${products.length} items` : undefined}
      defaultOpen={true}
      headerRight={viewToggle}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8" data-testid="loader-products">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive p-2" data-testid="error-products">
          Failed to load products
        </div>
      ) : (
        <StoreProductSkin
          items={skinItems}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          layout={viewLayout}
          onLayoutChange={setViewLayout}
          showViewToggle={false}
          gridHeight="400px"
          emptyMessage="No products assigned to this channel yet"
        />
      )}
    </CollapsibleModule>
  );
}
