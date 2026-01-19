import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Plus, Check } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { SharedViewer } from "@/features/shared/components/SharedViewer";
import { useStoreLibraryContext, ProductInfo } from "../StoreLibraryContext";

export function ProductGridModule() {
  const { 
    selectedStore, 
    selectedChannel, 
    selectedProducts,
    addToSelection,
    removeFromSelection 
  } = useStoreLibraryContext();

  const { data: products = [], isLoading, error } = useQuery<ProductInfo[]>({
    queryKey: [`/api/test/stores/${selectedStore?.id}/channels/${selectedChannel?.name}/products`],
    enabled: !!selectedStore && !!selectedChannel?.name,
  });

  if (!selectedStore || !selectedChannel) {
    return null;
  }

  const isSelected = (productId: string) => {
    return selectedProducts.some(p => p.id === productId);
  };

  const toggleProduct = (product: ProductInfo) => {
    if (isSelected(product.id)) {
      removeFromSelection(product.id);
    } else {
      addToSelection(product);
    }
  };

  return (
    <CollapsibleModule
      title="Products"
      badge={products.length > 0 ? `${products.length} items` : undefined}
      defaultOpen={true}
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
        <SharedViewer mode="grid" className="w-full">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="grid-products">
            {products.map((product) => (
              <div
                key={product.id}
                className={`relative border rounded-lg p-2 cursor-pointer transition-all ${
                  isSelected(product.id) 
                    ? "border-primary bg-primary/10 ring-2 ring-primary" 
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => toggleProduct(product)}
                data-testid={`product-card-${product.id}`}
              >
                <div className="aspect-square bg-muted rounded overflow-hidden mb-2">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium truncate">{product.name}</div>
                {product.enabledColors && product.enabledColors.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {product.enabledColors.length} colors
                  </div>
                )}
                <Button
                  size="icon"
                  variant={isSelected(product.id) ? "default" : "outline"}
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProduct(product);
                  }}
                  data-testid={`button-select-${product.id}`}
                >
                  {isSelected(product.id) ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </SharedViewer>
      )}
    </CollapsibleModule>
  );
}
