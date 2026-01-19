import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Library } from "lucide-react";
import { StoreLibraryProvider, useStoreLibraryContext, ProductInfo } from "./StoreLibraryContext";
import { StoreTypeFilterModule } from "./modules/StoreTypeFilterModule";
import { ProductGridModule } from "./modules/ProductGridModule";
import { SharedLightbox, LightboxItem } from "@/features/shared/components/SharedLightbox";
import { StoreLibrarySkin } from "./skins/StoreLibrarySkin";

function productToLightboxItem(product: ProductInfo): LightboxItem {
  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    subtitle: product.enabledColors?.length 
      ? `${product.enabledColors.length} colors` 
      : undefined,
  };
}

function StoreLibraryInner() {
  const { 
    selectedStore, 
    selectedChannel, 
    selectedProducts,
    removeFromSelection,
    clearSelection,
  } = useStoreLibraryContext();

  const lightboxItems = selectedProducts.map(productToLightboxItem);

  return (
    <div className="flex flex-col lg:flex-row gap-4" data-testid="container-store-library">
      <Card className="flex-1 min-w-0" data-testid="card-store-library">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" data-testid="title-store-library">
            <Library className="h-5 w-5" />
            Store Library
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StoreTypeFilterModule />
          
          {selectedStore && selectedChannel && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h3 className="font-semibold text-lg" data-testid="text-channel-title">
                {selectedChannel.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedStore.name} • {selectedStore.type}
              </p>
            </div>
          )}
          
          <ProductGridModule />
        </CardContent>
      </Card>

      <SharedLightbox
        items={lightboxItems}
        onRemoveItem={removeFromSelection}
        onClearAll={clearSelection}
        title="Selected Products"
        emptyMessage="Click products to select them"
        className="w-full lg:w-72 min-h-[300px] lg:min-h-[400px]"
        actionSlot={
          <StoreLibrarySkin 
            items={lightboxItems} 
            onClearSelection={clearSelection} 
          />
        }
      />
    </div>
  );
}

export function StoreLibraryHarness() {
  return (
    <StoreLibraryProvider>
      <StoreLibraryInner />
    </StoreLibraryProvider>
  );
}

export default StoreLibraryHarness;
