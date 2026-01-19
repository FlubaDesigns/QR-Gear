import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutGrid, List, GalleryHorizontal } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { ScrollView, ScrollViewItem } from "@/features/shared/components/views/ScrollView";
import { useStoreLibraryContext, ProductInfo } from "../StoreLibraryContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";

type ViewLayout = "grid" | "vertical" | "horizontal";

function productToScrollItem(product: ProductInfo): ScrollViewItem {
  return {
    id: product.id,
    imageUrl: product.imageUrl || "",
    title: product.name,
    subtitle: product.baseProductId ? `Product: ${product.baseProductId}` : undefined,
    colorCount: product.enabledColors?.length,
    sizes: product.enabledSizes,
  };
}

export function ProductGridModule() {
  const [viewLayout, setViewLayout] = useState<ViewLayout>("grid");
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

  const isSelected = (productId: string) => {
    return selectedProducts.some(p => p.id === productId);
  };

  const handleSelect = (item: ScrollViewItem) => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;
    
    if (isSelected(product.id)) {
      removeFromSelection(product.id);
    } else {
      addToSelection(product);
    }
  };

  const scrollItems = products.map(productToScrollItem);
  const selectedId = selectedProducts.length > 0 ? selectedProducts[selectedProducts.length - 1].id : null;

  const viewToggle = (
    <div className="flex gap-1">
      <Button
        size="icon"
        variant={viewLayout === "grid" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => setViewLayout("grid")}
        data-testid="button-view-grid"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewLayout === "vertical" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => setViewLayout("vertical")}
        data-testid="button-view-list"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant={viewLayout === "horizontal" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => setViewLayout("horizontal")}
        data-testid="button-view-swipe"
      >
        <GalleryHorizontal className="h-4 w-4" />
      </Button>
    </div>
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
      ) : products.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg bg-muted/50" data-testid="empty-products">
          No products assigned to this channel yet
        </div>
      ) : (
        <ScrollView
          items={scrollItems}
          selectedId={selectedId}
          onSelect={handleSelect}
          layout={viewLayout}
          aspectRatio="square"
          gridHeight="400px"
          emptyMessage="No products in this channel"
        />
      )}
    </CollapsibleModule>
  );
}
